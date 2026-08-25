"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useToast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import {
  checkConflictsAction,
  checkMembershipAction,
  createBookingAction,
  quotePreviewAction,
  updateBookingAction,
  type AllowanceSummary,
  type ConflictSummary,
} from "@/server/actions/bookings";

import { StepBooking, StepCustomize, StepPeople, StepSet } from "./steps";
import { BookingSummary, sessionMinutes } from "./summary";
import { categoriesForSet, type BookingCatalogue, type BookingFormValues } from "./types";

const STEPS = ["Booking", "Set", "Customize", "People"] as const;

export function BookingForm({
  catalogue,
  initialValues,
  bookingId,
}: {
  catalogue: BookingCatalogue;
  initialValues: BookingFormValues;
  /** Present when editing an existing booking. */
  bookingId?: string;
}) {
  const router = useRouter();
  const { toast, error: toastError } = useToast();
  const isEditing = Boolean(bookingId);

  const [values, setValues] = useState<BookingFormValues>(initialValues);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<ConflictSummary[]>([]);
  const [checking, setChecking] = useState(false);
  const [allowance, setAllowance] = useState<{
    covered: boolean;
    reason: string | null;
    lines: AllowanceSummary[];
  } | null>(null);
  const [quote, setQuote] = useState<{
    totalCents: number;
    lines: { label: string; detail: string | null; cents: number }[];
  } | null>(null);
  const [saving, startSaving] = useTransition();
  const [dirty, setDirty] = useState(false);
  // Once someone edits a buffer we stop overwriting it when the kind changes.
  const buffersTouched = useRef(false);
  const savedRef = useRef(false);

  const patch = useCallback(
    (next: Partial<BookingFormValues>) => {
      setDirty(true);
      if ("setupMinutes" in next || "resetMinutes" in next) buffersTouched.current = true;

      setValues((current) => {
        const merged = { ...current, ...next };

        // Internal shoots turn the room around faster than paid rentals.
        if (next.kind && next.kind !== current.kind && !buffersTouched.current) {
          const defaults = catalogue.defaults[next.kind];
          merged.setupMinutes = defaults.setupMinutes;
          merged.resetMinutes = defaults.resetMinutes;
        }

        // Switching sets drops any option the new set does not offer.
        if (next.studioSetId !== undefined && next.studioSetId !== current.studioSetId) {
          const allowed = new Set(
            categoriesForSet(catalogue.categories, next.studioSetId).flatMap((c) =>
              c.options.map((o) => o.id),
            ),
          );
          merged.setOptionIds = merged.setOptionIds.filter((id) => allowed.has(id));
        }

        return merged;
      });
    },
    [catalogue],
  );

  const visibleCategories = useMemo(
    () => (values.studioSetId ? categoriesForSet(catalogue.categories, values.studioSetId) : []),
    [catalogue.categories, values.studioSetId],
  );

  const occurrenceCount = useMemo(() => {
    if (values.recurrence === "none" || !values.recurrenceUntil) return 1;
    const step = values.recurrence === "weekly" ? 7 : 14;
    const start = new Date(`${values.date}T12:00:00Z`);
    const until = new Date(`${values.recurrenceUntil}T12:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(until.getTime()) || until < start) return 1;
    return Math.min(52, Math.floor((until.getTime() - start.getTime()) / (step * 86_400_000)) + 1);
  }, [values.recurrence, values.recurrenceUntil, values.date]);

  /* ---- Live availability ------------------------------------------------ */

  const { date, startTime, endTime, setupMinutes, resetMinutes } = values;
  // Held conflicts are only meaningful once the times parse, so rather than
  // clearing state we simply stop trusting it.
  const timesValid = Boolean(date) && sessionMinutes(values) !== null;

  useEffect(() => {
    if (!timesValid) return;

    let cancelled = false;
    const id = setTimeout(async () => {
      setChecking(true);
      try {
        const result = await checkConflictsAction({
          date,
          startTime,
          endTime,
          setupMinutes,
          resetMinutes,
          excludeBookingId: bookingId,
        });
        if (!cancelled) setConflicts(result.conflicts);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [timesValid, date, startTime, endTime, setupMinutes, resetMinutes, bookingId]);

  /* ---- What the membership has left ------------------------------------- */

  const { kind, bookingType, clientMembershipId } = values;

  // Same approach as the conflict check above: when the booking is not a
  // membership the stale result is simply not shown, rather than cleared.
  const showAllowance = kind === "membership" && Boolean(clientMembershipId) && timesValid;

  useEffect(() => {
    if (!showAllowance) return;

    let cancelled = false;
    const id = setTimeout(async () => {
      const result = await checkMembershipAction({
        clientMembershipId,
        bookingType,
        date,
        startTime,
        endTime,
        excludeBookingId: bookingId,
      });
      if (!cancelled) setAllowance(result);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [showAllowance, clientMembershipId, bookingType, date, startTime, endTime, bookingId]);

  /* ---- What an external rental comes to --------------------------------- */

  const showQuote = kind === "external" && timesValid;

  useEffect(() => {
    if (!showQuote) return;

    let cancelled = false;
    const id = setTimeout(async () => {
      const result = await quotePreviewAction({
        kind: "external",
        bookingType,
        date,
        startTime,
        endTime,
      });
      if (!cancelled) setQuote(result.billable ? result : null);
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [showQuote, bookingType, date, startTime, endTime]);

  /* ---- Unsaved changes -------------------------------------------------- */

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---- Save ------------------------------------------------------------- */

  const save = useCallback(() => {
    const payload = {
      ...values,
      clientName: values.clientName || undefined,
      clientId: values.clientId || undefined,
      clientMembershipId: values.clientMembershipId || undefined,
      studioSetId: values.studioSetId || undefined,
      organizerPhone: values.organizerPhone || undefined,
      notes: values.notes || undefined,
      internalNotes: values.internalNotes || undefined,
      recurrenceUntil: values.recurrenceUntil || undefined,
      attendees: values.attendees
        .filter((a) => a.name.trim())
        .map((a) => ({ ...a, email: a.email || undefined })),
    };

    startSaving(async () => {
      const result = bookingId
        ? await updateBookingAction(bookingId, payload)
        : await createBookingAction(payload);

      if (result.ok) {
        savedRef.current = true;
        setDirty(false);
        toast(bookingId ? "Booking updated" : "Booking created");
        router.push(`/bookings/${result.bookingId}`);
        router.refresh();
        return;
      }

      setErrors(result.errors ?? {});
      if (result.conflicts?.length) setConflicts(result.conflicts);
      toastError(result.message);

      // Send the user to the step that actually holds the problem.
      const firstError = Object.keys(result.errors ?? {})[0];
      if (firstError?.startsWith("attendees") || firstError?.startsWith("organizer")) setStep(3);
      else if (firstError) setStep(0);
    });
  }, [values, bookingId, router, toast, toastError]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="grid gap-12 pt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
      <div>
        {/* Stepper — numbered like a shot list. */}
        <ol className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-4">
          {STEPS.map((label, index) => {
            const active = index === step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className={cx(
                    "eyebrow flex items-baseline gap-2 transition-colors",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  <span className={cx("timecode", active ? "text-accent-ink" : "text-line-strong")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="py-8">
          {step === 0 ? (
            <StepBooking
              values={values}
              patch={patch}
              errors={errors}
              clients={catalogue.clients}
            />
          ) : null}
          {step === 1 ? <StepSet sets={catalogue.sets} values={values} patch={patch} /> : null}
          {step === 2 ? (
            <StepCustomize
              categories={visibleCategories}
              values={values}
              patch={patch}
              errors={errors}
            />
          ) : null}
          {step === 3 ? (
            <StepPeople values={values} patch={patch} errors={errors} isEditing={isEditing} />
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>

          <div className="flex items-center gap-3">
            <span className="eyebrow hidden text-muted sm:block">⌘↵ to save</span>
            {isLastStep ? (
              <Button type="button" variant="primary" disabled={saving} onClick={save}>
                {saving ? "Saving…" : isEditing ? "Save changes" : "Create booking"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>

      <BookingSummary
        values={values}
        allowance={showAllowance ? allowance : null}
        quote={showQuote ? quote : null}
        sets={catalogue.sets}
        categories={visibleCategories}
        conflicts={timesValid ? conflicts : []}
        checking={checking}
        occurrenceCount={occurrenceCount}
      />
    </div>
  );
}
