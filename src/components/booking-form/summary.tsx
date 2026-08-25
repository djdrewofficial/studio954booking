"use client";

import Link from "next/link";

import { SetupRecipe } from "@/components/setup-recipe";
import { cx } from "@/components/ui";
import { RECURRENCE_LABEL } from "@/lib/domain";
import { formatMoney } from "@/lib/pricing";
import { formatDuration } from "@/lib/time";
import type { AllowanceSummary, ConflictSummary } from "@/server/actions/bookings";

import type { BookingFormValues, OptionCategoryChoice, StudioSetChoice } from "./types";

/* ---------------------------------------------------------------------------
 * Wall-clock helpers. Every value in the form is already local to the studio,
 * so buffer maths is plain minute arithmetic — no timezone conversion needed.
 * ------------------------------------------------------------------------ */

function toMinutes(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function to12Hour(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const dayShift =
    totalMinutes < 0 ? " (prev day)" : totalMinutes >= 1440 ? " (next day)" : "";
  return `${h12}:${String(mins).padStart(2, "0")} ${suffix}${dayShift}`;
}

export function sessionMinutes(values: BookingFormValues): number | null {
  const start = toMinutes(values.startTime);
  const end = toMinutes(values.endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

/* ---------------------------------------------------------------------------
 * The panel
 * ------------------------------------------------------------------------ */

export function BookingSummary({
  values,
  sets,
  categories,
  conflicts,
  checking,
  occurrenceCount,
  allowance,
  quote,
}: {
  values: BookingFormValues;
  sets: StudioSetChoice[];
  categories: OptionCategoryChoice[];
  conflicts: ConflictSummary[];
  checking: boolean;
  occurrenceCount: number;
  /** Present only for a membership booking with a member chosen. */
  allowance: { covered: boolean; reason: string | null; lines: AllowanceSummary[] } | null;
  /** Present only for an external rental. */
  quote: { totalCents: number; lines: { label: string; detail: string | null; cents: number }[] } | null;
}) {
  const start = toMinutes(values.startTime);
  const end = toMinutes(values.endTime);
  const duration = sessionMinutes(values);
  const set = sets.find((s) => s.id === values.studioSetId) ?? null;

  const recipe = categories
    .map((category) => ({
      categoryName: category.name,
      categorySlug: category.slug,
      options: category.options
        .filter((o) => values.setOptionIds.includes(o.id))
        .map((o) => ({ name: o.name, swatchHex: o.swatchHex, imageUrl: o.imageUrl })),
    }))
    .filter((line) => line.options.length > 0);

  return (
    <aside className="lg:sticky lg:top-20">
      <h2 className="eyebrow text-muted">Studio hold</h2>

      {start !== null && end !== null && duration !== null ? (
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {values.setupMinutes > 0 ? (
            <SummaryRow
              label="Setup"
              value={`${to12Hour(start - values.setupMinutes)} – ${to12Hour(start)}`}
              muted
            />
          ) : null}
          <SummaryRow
            label="Session"
            value={`${to12Hour(start)} – ${to12Hour(end)}`}
            emphasis
          />
          {values.resetMinutes > 0 ? (
            <SummaryRow
              label="Reset"
              value={`${to12Hour(end)} – ${to12Hour(end + values.resetMinutes)}`}
              muted
            />
          ) : null}
          <SummaryRow label="Duration" value={formatDuration(duration)} />
          <SummaryRow
            label="Room held"
            value={formatDuration(duration + values.setupMinutes + values.resetMinutes)}
          />
        </dl>
      ) : (
        <p className="mt-4 border-y border-line py-4 text-sm text-muted">
          Pick a start and end time to see the studio hold.
        </p>
      )}

      {/* What the membership has left, or what the rental comes to. Both sit
          above availability because they change what the studio says on the
          phone, not just whether the room is free. */}
      {allowance ? (
        <div className="mt-5" aria-live="polite">
          <h2 className="eyebrow text-muted">Membership</h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {allowance.lines.map((line, i) => (
              <li
                key={i}
                className={cx(
                  "flex items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                  line.over ? "bg-danger-soft text-danger" : "bg-sand",
                )}
              >
                <span className="font-semibold">{line.label}</span>
                <span className={line.over ? "font-semibold" : "text-muted"}>{line.detail}</span>
              </li>
            ))}
          </ul>
          {allowance.reason ? (
            <p className="mt-3 border-l-2 border-prep bg-white px-4 py-3 text-sm text-prep">
              {allowance.reason} You can still book it — settle the extra separately.
            </p>
          ) : null}
        </div>
      ) : null}

      {quote && quote.lines.length > 0 ? (
        <div className="mt-5" aria-live="polite">
          <h2 className="eyebrow text-muted">Price</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {quote.lines.map((line, i) => (
              <SummaryRow
                key={i}
                label={line.detail ? `${line.label} · ${line.detail}` : line.label}
                value={formatMoney(line.cents)}
                muted
              />
            ))}
            <SummaryRow label="Total" value={formatMoney(quote.totalCents)} emphasis />
          </dl>
          {occurrenceCount > 1 ? (
            <p className="mt-2 text-sm text-muted">Per session, {occurrenceCount} in this repeat.</p>
          ) : null}
        </div>
      ) : null}

      {quote && quote.lines.length === 0 ? (
        <p className="mt-5 text-sm text-muted">
          No rate is set for this appointment yet, so it would be booked at no charge. Add one under
          Settings → Rates.
        </p>
      ) : null}

      {/* Availability — the one thing that must never be a surprise on save. */}
      <div className="mt-5" aria-live="polite">
        {checking ? (
          <p className="eyebrow text-muted">Checking availability…</p>
        ) : conflicts.length ? (
          <div className="border-l-2 border-danger bg-white px-4 py-3">
            <p className="eyebrow text-danger">Studio already held</p>
            <ul className="mt-2 space-y-1.5">
              {conflicts.map((c) => (
                <li key={c.id} className="text-[0.8125rem] leading-snug text-ink">
                  <Link href={`/bookings/${c.id}`} className="underline underline-offset-2">
                    {c.title}
                  </Link>
                  <span className="block text-muted">
                    holds the room {new Date(c.blockedStart).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(c.blockedEnd).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : start !== null && duration !== null ? (
          <p className="eyebrow text-accent-ink">Studio available</p>
        ) : null}
      </div>

      <h2 className="eyebrow mt-8 text-muted">Studio setup</h2>
      {set ? (
        <>
          <p className="display mt-3 text-xl">{set.name}</p>
          {recipe.length ? (
            <SetupRecipe setup={recipe} className="mt-4" />
          ) : (
            <p className="mt-3 text-sm text-muted">No options chosen yet.</p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No set chosen yet.</p>
      )}

      <h2 className="eyebrow mt-8 text-muted">People</h2>
      <p className="mt-3 text-sm text-ink">
        {values.organizerName || "Organizer not set"}
        {values.attendees.length
          ? ` · ${values.attendees.length} ${values.attendees.length === 1 ? "attendee" : "attendees"}`
          : ""}
      </p>

      {values.recurrence !== "none" ? (
        <>
          <h2 className="eyebrow mt-8 text-muted">Repeat</h2>
          <p className="mt-3 text-sm text-ink">
            {RECURRENCE_LABEL[values.recurrence]}
            {occurrenceCount > 1 ? ` · ${occurrenceCount} sessions` : ""}
          </p>
        </>
      ) : null}
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="eyebrow text-muted">{label}</dt>
      <dd
        className={cx(
          "timecode text-right text-sm",
          emphasis ? "font-medium text-ink" : muted ? "text-muted" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
