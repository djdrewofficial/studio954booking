import type { Metadata } from "next";

import { FormError, SettingsForm } from "@/components/settings/form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MEMBERSHIP_STATUSES, MEMBERSHIP_STATUS_LABEL, canManageSettings } from "@/lib/domain";
import { describeRemaining } from "@/lib/membership";
import { formatMoney } from "@/lib/pricing";
import { formatDate } from "@/lib/time";
import { saveClient, saveClientMembership } from "@/server/actions/settings";
import {
  listClientAllowances,
  listPlans,
  type Client,
  type ClientMembership,
  type PlanWithEntitlements,
} from "@/server/clients";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsSettingsPage() {
  const user = await requireUser();
  const settings = await getStudioSettings();
  const [rows, plans] = await Promise.all([
    // Three queries however many clients there are, rather than a pair each.
    listClientAllowances(new Date(), settings.timezone, true),
    listPlans(true),
  ]);
  const readOnly = !canManageSettings(user.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Clients</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The people and businesses who book the room. A client can hold one membership at a time;
          what is left on it is worked out from their bookings, so it is always current.
        </p>
      </header>

      {!readOnly ? (
        <details className="mt-8 border-y border-line">
          <summary className="eyebrow cursor-pointer py-4 text-accent-ink">Add a client</summary>
          <div className="pb-6">
            <SettingsForm action={saveClient} submitLabel="Create client">
              <ClientFields />
            </SettingsForm>
          </div>
        </details>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        {rows.map(({ client, membership, planName, period, lines }) => {
          const summary = membership && period ? { membership, planName, period, lines } : null;
          return (
            <section key={client.id} className="rounded-3xl bg-sand/50 p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-xl font-bold">
                  {client.name}
                  {client.isActive ? null : (
                    <span className="ml-2 text-sm font-medium text-muted">archived</span>
                  )}
                </h3>
                {summary ? (
                  <span className="rounded-full bg-ready-soft px-3 py-1 text-sm font-semibold text-ready">
                    {summary.planName ?? "Membership"}
                  </span>
                ) : (
                  <span className="text-sm text-muted">No membership</span>
                )}
              </div>

              {client.contactName || client.email || client.phone ? (
                <p className="mt-2 text-sm text-muted">
                  {[client.contactName, client.email, client.phone].filter(Boolean).join(" · ")}
                </p>
              ) : null}

              {summary ? (
                <div className="mt-5">
                  <h4 className="eyebrow text-muted">
                    Left this period · refills {formatDate(summary.period.end, settings.timezone)}
                  </h4>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {summary.lines.map((line, i) => (
                      <li
                        key={i}
                        className={
                          line.over > 0
                            ? "rounded-full bg-danger-soft px-4 py-2 text-sm font-semibold text-danger"
                            : "rounded-full bg-paper px-4 py-2 text-sm"
                        }
                      >
                        <span className="font-semibold">{line.label}</span>{" "}
                        <span className={line.over > 0 ? "" : "text-muted"}>
                          {describeRemaining(line)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {summary.lines.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      This plan has no lines yet, so it covers nothing.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!readOnly ? (
                <>
                  <details className="mt-5">
                    <summary className="eyebrow cursor-pointer py-2 text-accent-ink">
                      {summary ? "Change membership" : "Start a membership"}
                    </summary>
                    <div className="pb-2">
                      {plans.length === 0 ? (
                        <p className="py-3 text-sm text-muted">
                          No plans exist yet — create one under Memberships first.
                        </p>
                      ) : (
                        <SettingsForm
                          action={saveClientMembership}
                          submitLabel={summary ? "Save membership" : "Start membership"}
                        >
                          <MembershipFields
                            clientId={client.id}
                            plans={plans}
                            current={summary?.membership ?? null}
                            currentPlanId={summary ? plans.find((p) => p.id === summary.membership.planId)?.id : undefined}
                            timezone={settings.timezone}
                          />
                        </SettingsForm>
                      )}
                    </div>
                  </details>

                  <details className="mt-2 border-t border-line pt-2">
                    <summary className="eyebrow cursor-pointer py-2 text-muted">
                      Edit client
                    </summary>
                    <div className="pb-2">
                      <SettingsForm action={saveClient}>
                        <ClientFields client={client} />
                      </SettingsForm>
                    </div>
                  </details>
                </>
              ) : null}
            </section>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-line py-10 text-sm text-muted">
          No clients yet. Add one above to start tracking memberships.
        </p>
      ) : null}
    </div>
  );
}

function ClientFields({ client }: { client?: Client }) {
  return (
    <>
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Client name" hint="The business, or the person." errorSlot={<FormError name="name" />}>
          <Input name="name" defaultValue={client?.name ?? ""} required />
        </Field>
        <Field label="Main contact" errorSlot={<FormError name="contactName" />}>
          <Input name="contactName" defaultValue={client?.contactName ?? ""} />
        </Field>
        <Field label="Email" errorSlot={<FormError name="email" />}>
          <Input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Phone" errorSlot={<FormError name="phone" />}>
          <Input name="phone" defaultValue={client?.phone ?? ""} />
        </Field>
        <Field label="Notes" className="sm:col-span-2" errorSlot={<FormError name="notes" />}>
          <Textarea name="notes" rows={2} defaultValue={client?.notes ?? ""} />
        </Field>
      </div>
      <Checkbox name="isActive" label="Active" defaultChecked={client?.isActive ?? true} />
    </>
  );
}

function MembershipFields({
  clientId,
  plans,
  current,
  currentPlanId,
  timezone,
}: {
  clientId: string;
  plans: PlanWithEntitlements[];
  current: ClientMembership | null;
  currentPlanId?: string;
  timezone: string;
}) {
  const today = formatIsoDate(new Date(), timezone);

  return (
    <>
      <input type="hidden" name="clientId" value={clientId} />
      {current ? <input type="hidden" name="id" value={current.id} /> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Plan" errorSlot={<FormError name="planId" />}>
          <Select name="planId" defaultValue={currentPlanId ?? ""} required>
            <option value="" disabled>
              Choose a plan
            </option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {formatMoney(plan.priceCents)}/mo
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" errorSlot={<FormError name="status" />}>
          <Select name="status" defaultValue={current?.status ?? "active"}>
            {MEMBERSHIP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {MEMBERSHIP_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Started on"
          hint="Also the day each month the allowance refills."
          errorSlot={<FormError name="startedOn" />}
        >
          <Input
            name="startedOn"
            type="date"
            defaultValue={asDateValue(current?.startedOn) ?? today}
            required
          />
        </Field>
        <Field label="Ended on" hint="Leave empty while it runs." errorSlot={<FormError name="endedOn" />}>
          <Input name="endedOn" type="date" defaultValue={asDateValue(current?.endedOn) ?? ""} />
        </Field>
        <Field label="Notes" className="sm:col-span-2" errorSlot={<FormError name="notes" />}>
          <Textarea name="notes" rows={2} defaultValue={current?.notes ?? ""} />
        </Field>
      </div>
    </>
  );
}

/** A date column arrives as "YYYY-MM-DD"; a raw driver may hand back a Date. */
function asDateValue(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function formatIsoDate(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}
