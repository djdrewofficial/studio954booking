import type { Metadata } from "next";

import { Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/time";
import { getCalendarStatus } from "@/server/google/calendar";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Calendar sync" };

const ENV_DOCS: { name: string; description: string }[] = [
  {
    name: "GOOGLE_CALENDAR_ID",
    description:
      "The calendar to write to. Usually the studio calendar's address, ending in @group.calendar.google.com.",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    description: "The service account's client email, from its JSON key file.",
  },
  {
    name: "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    description:
      "The matching private key. Keep the literal \\n escapes — they are converted at runtime.",
  },
];

export default async function CalendarSettingsPage() {
  await requireUser();
  const [status, settings] = await Promise.all([getCalendarStatus(), getStudioSettings()]);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Google Calendar</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Bookings are mirrored to a dedicated Studio 954 calendar, including the set, the exact
          room setup and the setup and reset windows.
        </p>
      </header>

      <dl className="mt-8 divide-y divide-line border-y border-line">
        <Row label="Status" value={status.configured ? "Connected" : "Not connected"} />
        <Row label="Calendar" value={status.calendarId ?? "Not set"} />
        <Row
          label="Credentials"
          value={
            status.mode === "service_account"
              ? "Service account"
              : status.mode === "oauth"
                ? "OAuth refresh token"
                : "None"
          }
        />
        <Row
          label="Last sync"
          value={
            status.lastSyncAt
              ? `${formatDate(status.lastSyncAt, settings.timezone)} at ${formatTime(status.lastSyncAt, settings.timezone)}`
              : "Never"
          }
        />
        {status.lastError ? <Row label="Last error" value={status.lastError} danger /> : null}
      </dl>

      {!status.configured ? (
        <section className="mt-10">
          <Eyebrow as="h3">To connect</Eyebrow>
          <ol className="mt-4 max-w-prose list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted marker:text-line-strong">
            <li>Create a Google Cloud service account and download its JSON key.</li>
            <li>
              In Google Calendar, open the Studio 954 calendar&rsquo;s settings and share it with the
              service account&rsquo;s email, granting{" "}
              <span className="text-ink">Make changes to events</span>.
            </li>
            <li>
              Add the variables below to <code className="timecode text-[0.8125rem]">.env.local</code>{" "}
              and restart the app.
            </li>
          </ol>

          <ul className="mt-6 divide-y divide-line border-y border-line">
            {ENV_DOCS.map((item) => (
              <li key={item.name} className="py-3">
                <p className="timecode text-[0.8125rem] text-ink">{item.name}</p>
                <p className="mt-1 max-w-prose text-sm text-muted">{item.description}</p>
              </li>
            ))}
          </ul>

          {status.missing.length ? (
            <p className="mt-6 border-l-2 border-accent bg-white px-4 py-3 text-sm">
              Still missing: <span className="timecode">{status.missing.join(", ")}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-12 border-t border-line pt-6">
        <Eyebrow as="h3">Good to know</Eyebrow>
        <ul className="mt-4 max-w-prose space-y-2 text-sm leading-relaxed text-muted">
          <li>
            Attendees are invited through the calendar file attached to the confirmation email,
            which works in every calendar app. Adding Google attendees directly to the event would
            require domain-wide delegation.
          </li>
          <li>
            Cancelling a booking removes its event; deleting a booking removes it too. Nothing else
            on the calendar is touched.
          </li>
          <li>
            Events created directly on the studio calendar can be read back to block availability —
            the reader is in place and switched off until credentials are present.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]">
      <dt className="eyebrow pt-0.5 text-muted">{label}</dt>
      <dd
        className={
          danger ? "break-words text-sm text-danger" : "break-words text-sm text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}
