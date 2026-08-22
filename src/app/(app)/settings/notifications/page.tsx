import type { Metadata } from "next";

import { SettingsForm } from "@/components/settings/form";
import { Checkbox, Field, Input } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/domain";
import { formatDate } from "@/lib/time";
import { saveNotificationSettings } from "@/server/actions/settings";
import { recentNotifications } from "@/server/notifications";
import { isEmailConfigured } from "@/server/email/mailer";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const [settings, log] = await Promise.all([getStudioSettings(), recentNotifications(20)]);
  const readOnly = !canManageSettings(user.role);
  const configured = isEmailConfigured();

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Notifications</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          What Studio 954 sends, and to whom. Attendees marked as notified on a booking receive the
          same messages as the organizer.
        </p>
      </header>

      {!configured ? (
        <p className="mt-6 border-l-2 border-accent bg-white px-4 py-3 text-sm">
          No email provider is connected, so messages are logged but not delivered. Set{" "}
          <code className="timecode text-[0.8125rem]">RESEND_API_KEY</code> and{" "}
          <code className="timecode text-[0.8125rem]">EMAIL_FROM</code> to start sending.
        </p>
      ) : null}

      <div className="mt-8">
        <fieldset disabled={readOnly}>
          <SettingsForm action={saveNotificationSettings}>
            {(errors) => (
              <>
                <div className="flex flex-col gap-1 border-y border-line py-4">
                  <Checkbox
                    name="notifyConfirmation"
                    label="Booking confirmation"
                    description="Sent as soon as a booking is created, with an calendar invitation attached."
                    defaultChecked={settings.notifyConfirmation}
                  />
                  <Checkbox
                    name="notifyReminder24h"
                    label="Reminder the day before"
                    description="Sent roughly 24 hours ahead of the session."
                    defaultChecked={settings.notifyReminder24h}
                  />
                  <Checkbox
                    name="notifyReminderSameDay"
                    label="Same-day reminder"
                    description="A short nudge shortly before the call time."
                    defaultChecked={settings.notifyReminderSameDay}
                  />
                </div>

                <Field
                  label="Same-day reminder lead"
                  htmlFor="sameDayReminderLeadMinutes"
                  hint="Minutes before the session starts."
                  error={errors.sameDayReminderLeadMinutes}
                  className="max-w-48"
                >
                  <Input
                    id="sameDayReminderLeadMinutes"
                    name="sameDayReminderLeadMinutes"
                    type="number"
                    min={15}
                    max={720}
                    step={15}
                    defaultValue={settings.sameDayReminderLeadMinutes}
                  />
                </Field>

                <div className="border-t border-line pt-7">
                  <Checkbox
                    name="notifyInternalTeam"
                    label="Notify the team"
                    description="Copy an internal address whenever a booking is created."
                    defaultChecked={settings.notifyInternalTeam}
                  />
                  <Field
                    label="Team address"
                    htmlFor="internalNotificationEmail"
                    error={errors.internalNotificationEmail}
                    className="mt-4 max-w-sm"
                  >
                    <Input
                      id="internalNotificationEmail"
                      name="internalNotificationEmail"
                      type="email"
                      defaultValue={settings.internalNotificationEmail ?? ""}
                    />
                  </Field>
                </div>
              </>
            )}
          </SettingsForm>
        </fieldset>
      </div>

      <section className="mt-14">
        <h3 className="eyebrow text-muted">Recent activity</h3>
        {log.length ? (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {log.map((entry) => (
              <li key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr_auto]">
                <span className="eyebrow text-ink">{entry.kind.replace(/_/g, " ")}</span>
                <span className="truncate text-sm text-muted">
                  {entry.recipientEmail}
                  {entry.bookingTitle ? ` · ${entry.bookingTitle}` : ""}
                </span>
                <span
                  className={
                    entry.status === "failed"
                      ? "eyebrow text-danger sm:text-right"
                      : "eyebrow text-muted sm:text-right"
                  }
                >
                  {entry.status} · {formatDate(entry.createdAt, settings.timezone)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Nothing has been sent yet.</p>
        )}
      </section>
    </div>
  );
}
