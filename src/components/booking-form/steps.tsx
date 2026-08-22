"use client";

import Image from "next/image";

import {
  BOOKING_KINDS,
  BOOKING_KIND_LABEL,
  BOOKING_TYPES,
  BOOKING_TYPE_LABEL,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_LABEL,
} from "@/lib/domain";
import { ScriptUpload } from "@/components/script-upload";
import { Button, Checkbox, Field, Input, Segmented, Select, Textarea, cx } from "@/components/ui";

import type { BookingFormValues, OptionCategoryChoice, StudioSetChoice } from "./types";

type Patch = (patch: Partial<BookingFormValues>) => void;
type Errors = Record<string, string>;

/* ---------------------------------------------------------------------------
 * 01 — Booking
 * ------------------------------------------------------------------------ */

export function StepBooking({
  values,
  patch,
  errors,
}: {
  values: BookingFormValues;
  patch: Patch;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-7">
      <Field label="Booking type">
        <Segmented
          name="Booking type"
          value={values.kind}
          onChange={(kind) => patch({ kind })}
          options={BOOKING_KINDS.map((k) => ({ value: k, label: BOOKING_KIND_LABEL[k] }))}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" error={errors.title} className="sm:col-span-2">
          <Input
            id="title"
            value={values.title}
            autoFocus
            placeholder="FAMA Podcast"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </Field>

        <Field
          label={values.kind === "external" ? "Client" : "Team or brand"}
          htmlFor="clientName"
          error={errors.clientName}
        >
          <Input
            id="clientName"
            value={values.clientName}
            placeholder={values.kind === "external" ? "Overtime Media" : "Xpress Entertainment"}
            onChange={(e) => patch({ clientName: e.target.value })}
          />
        </Field>

        <Field label="Session" htmlFor="bookingType" error={errors.bookingType}>
          <Select
            id="bookingType"
            value={values.bookingType}
            onChange={(e) => patch({ bookingType: e.target.value as BookingFormValues["bookingType"] })}
          >
            {BOOKING_TYPES.map((t) => (
              <option key={t} value={t}>
                {BOOKING_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="border-t border-line pt-7">
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Date" htmlFor="date" error={errors.date}>
            <Input
              id="date"
              type="date"
              value={values.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </Field>
          <Field label="Start" htmlFor="startTime" error={errors.startTime}>
            <Input
              id="startTime"
              type="time"
              step={300}
              value={values.startTime}
              onChange={(e) => patch({ startTime: e.target.value })}
            />
          </Field>
          <Field label="End" htmlFor="endTime" error={errors.endTime}>
            <Input
              id="endTime"
              type="time"
              step={300}
              value={values.endTime}
              onChange={(e) => patch({ endTime: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Field
            label="Setup buffer"
            htmlFor="setupMinutes"
            hint="Minutes the room is held before the session."
            error={errors.setupMinutes}
          >
            <Input
              id="setupMinutes"
              type="number"
              min={0}
              max={480}
              step={5}
              value={values.setupMinutes}
              onChange={(e) => patch({ setupMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Reset buffer"
            htmlFor="resetMinutes"
            hint="Minutes to strike and reset afterwards."
            error={errors.resetMinutes}
          >
            <Input
              id="resetMinutes"
              type="number"
              min={0}
              max={480}
              step={5}
              value={values.resetMinutes}
              onChange={(e) => patch({ resetMinutes: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 02 — Set
 * ------------------------------------------------------------------------ */

export function StepSet({
  sets,
  values,
  patch,
}: {
  sets: StudioSetChoice[];
  values: BookingFormValues;
  patch: Patch;
}) {
  if (!sets.length) {
    return (
      <p className="border-t border-line py-12 text-sm text-muted">
        No sets have been created yet. An admin can add them under Settings → Sets.
      </p>
    );
  }

  return (
    <div className="grid gap-px bg-line sm:grid-cols-2">
      {sets.map((set) => {
        const selected = values.studioSetId === set.id;
        return (
          <button
            key={set.id}
            type="button"
            aria-pressed={selected}
            onClick={() => patch({ studioSetId: selected ? "" : set.id })}
            className={cx(
              "group relative flex flex-col bg-paper p-5 text-left transition-colors",
              selected ? "bg-white" : "hover:bg-white",
            )}
          >
            {selected ? (
              <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden />
            ) : null}

            <div className="relative mb-4 aspect-[16/9] w-full overflow-hidden bg-paper-sunk">
              {set.imageUrl ? (
                <Image
                  src={set.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 400px"
                  unoptimized
                />
              ) : (
                // No photo yet — the set still needs to read at a glance.
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="eyebrow text-line-strong">No photo yet</span>
                </span>
              )}
            </div>

            <span className="display text-xl">{set.name}</span>
            {set.description ? (
              <span className="mt-1.5 text-sm leading-relaxed text-muted">{set.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 03 — Customize
 * ------------------------------------------------------------------------ */

export function StepCustomize({
  categories,
  values,
  patch,
  errors,
}: {
  categories: OptionCategoryChoice[];
  values: BookingFormValues;
  patch: Patch;
  errors: Errors;
}) {
  if (!values.studioSetId) {
    return (
      <p className="border-t border-line py-12 text-sm text-muted">
        Choose a set first and its customisation options will appear here.
      </p>
    );
  }

  if (!categories.length) {
    return (
      <p className="border-t border-line py-12 text-sm text-muted">
        This set has no customisation options configured.
      </p>
    );
  }

  function toggle(category: OptionCategoryChoice, optionId: string) {
    const inCategory = new Set(category.options.map((o) => o.id));
    const others = values.setOptionIds.filter((id) => !inCategory.has(id));
    const selectedHere = values.setOptionIds.filter((id) => inCategory.has(id));

    if (category.allowsMultiple) {
      const next = selectedHere.includes(optionId)
        ? selectedHere.filter((id) => id !== optionId)
        : [...selectedHere, optionId];
      patch({ setOptionIds: [...others, ...next] });
    } else {
      const next = selectedHere.includes(optionId) ? [] : [optionId];
      patch({ setOptionIds: [...others, ...next] });
    }
  }

  return (
    <div className="divide-y divide-line border-y border-line">
      {categories.map((category) => (
        <fieldset key={category.id} className="py-6">
          <legend className="eyebrow text-muted">
            {category.name}
            {category.isRequired ? <span className="ml-2 text-accent-ink">Required</span> : null}
            {category.allowsMultiple ? (
              <span className="ml-2 normal-case tracking-normal text-muted/70">
                (choose any)
              </span>
            ) : null}
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {category.options.map((option) => {
              const selected = values.setOptionIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggle(category, option.id)}
                  title={option.description ?? undefined}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-line-strong",
                  )}
                >
                  {option.swatchHex ? (
                    <span
                      aria-hidden
                      className="size-3 rounded-[1px] ring-1 ring-white/25"
                      style={{ backgroundColor: option.swatchHex }}
                    />
                  ) : null}
                  {option.name}
                </button>
              );
            })}
          </div>

          {errors[`category:${category.id}`] ? (
            <p className="mt-2 text-[0.8125rem] text-danger">{errors[`category:${category.id}`]}</p>
          ) : null}
        </fieldset>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 04 — People and notes
 * ------------------------------------------------------------------------ */

export function StepPeople({
  values,
  patch,
  errors,
  isEditing,
}: {
  values: BookingFormValues;
  patch: Patch;
  errors: Errors;
  isEditing: boolean;
}) {
  function updateAttendee(index: number, next: Partial<BookingFormValues["attendees"][number]>) {
    patch({
      attendees: values.attendees.map((a, i) => (i === index ? { ...a, ...next } : a)),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="eyebrow text-muted">Organizer</h3>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          <Field label="Name" htmlFor="organizerName" error={errors.organizerName}>
            <Input
              id="organizerName"
              value={values.organizerName}
              onChange={(e) => patch({ organizerName: e.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="organizerEmail" error={errors.organizerEmail}>
            <Input
              id="organizerEmail"
              type="email"
              value={values.organizerEmail}
              onChange={(e) => patch({ organizerEmail: e.target.value })}
            />
          </Field>
          <Field label="Phone" htmlFor="organizerPhone" error={errors.organizerPhone}>
            <Input
              id="organizerPhone"
              type="tel"
              value={values.organizerPhone}
              onChange={(e) => patch({ organizerPhone: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-line pt-7">
        <div className="flex items-center justify-between">
          <h3 className="eyebrow text-muted">Attendees</h3>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              patch({ attendees: [...values.attendees, { name: "", email: "", notify: true }] })
            }
          >
            Add attendee
          </Button>
        </div>

        {values.attendees.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Just the organizer so far. Add anyone who should receive the confirmation and reminders.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {values.attendees.map((attendee, index) => (
              <li key={index} className="grid gap-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Name" error={errors[`attendees.${index}.name`]}>
                  <Input
                    value={attendee.name}
                    placeholder="Full name"
                    onChange={(e) => updateAttendee(index, { name: e.target.value })}
                  />
                </Field>
                <Field label="Email" error={errors[`attendees.${index}.email`]}>
                  <Input
                    type="email"
                    value={attendee.email}
                    placeholder="name@company.com"
                    onChange={(e) => updateAttendee(index, { email: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-4 pb-2">
                  <Checkbox
                    label="Notify"
                    checked={attendee.notify}
                    onChange={(e) => updateAttendee(index, { notify: e.target.checked })}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ attendees: values.attendees.filter((_, i) => i !== index) })
                    }
                    className="text-[0.8125rem] text-muted underline-offset-2 hover:text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line pt-7">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <Field label="Notes" htmlFor="notes" hint="Shared with the organizer and attendees.">
            <Textarea
              id="notes"
              value={values.notes}
              rows={3}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Field>
          <Field label="Microphones" htmlFor="microphoneCount" className="sm:w-36">
            <Input
              id="microphoneCount"
              type="number"
              min={0}
              max={24}
              value={values.microphoneCount}
              onChange={(e) => patch({ microphoneCount: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="mt-6 rounded-2xl bg-sand p-5">
          <Checkbox
            label="Using the teleprompter"
            description="Upload the script now and it will be loaded before anyone arrives."
            checked={values.usesTeleprompter}
            onChange={(e) => patch({ usesTeleprompter: e.target.checked })}
          />
          {values.usesTeleprompter ? (
            <div className="mt-4">
              <ScriptUpload
                files={values.teleprompterFiles}
                onChange={(teleprompterFiles) => patch({ teleprompterFiles })}
              />
            </div>
          ) : null}
        </div>

        <Field
          label="Internal notes"
          htmlFor="internalNotes"
          hint="Only ever seen by the Studio 954 team."
          className="mt-6"
        >
          <Textarea
            id="internalNotes"
            value={values.internalNotes}
            rows={2}
            onChange={(e) => patch({ internalNotes: e.target.value })}
          />
        </Field>
      </div>

      {!isEditing ? (
        <div className="border-t border-line pt-7">
          <h3 className="eyebrow text-muted">Repeat</h3>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <Field label="Frequency" htmlFor="recurrence">
              <Select
                id="recurrence"
                value={values.recurrence}
                onChange={(e) =>
                  patch({ recurrence: e.target.value as BookingFormValues["recurrence"] })
                }
              >
                {RECURRENCE_FREQUENCIES.map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
            {values.recurrence !== "none" ? (
              <Field label="Repeat until" htmlFor="recurrenceUntil" error={errors.recurrenceUntil}>
                <Input
                  id="recurrenceUntil"
                  type="date"
                  min={values.date}
                  value={values.recurrenceUntil}
                  onChange={(e) => patch({ recurrenceUntil: e.target.value })}
                />
              </Field>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
