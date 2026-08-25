import type { Metadata } from "next";

import { FormError, SettingsForm } from "@/components/settings/form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  BOOKING_TYPES,
  BOOKING_TYPE_LABEL,
  ENTITLEMENT_KINDS,
  ENTITLEMENT_KIND_LABEL,
  canManageSettings,
} from "@/lib/domain";
import { formatMoney } from "@/lib/pricing";
import { formatDuration } from "@/lib/time";
import {
  removePlanEntitlement,
  saveMembershipPlan,
  savePlanEntitlement,
} from "@/server/actions/settings";
import { listPlans, type MembershipPlan, type PlanEntitlement } from "@/server/clients";

export const metadata: Metadata = { title: "Memberships" };

export default async function MembershipsSettingsPage() {
  const user = await requireUser();
  const plans = await listPlans(true);
  const readOnly = !canManageSettings(user.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Membership plans</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          What a member gets each month. A plan is a list of lines — a pool of studio time, a
          number of a particular appointment, or a number of anything at all — so one plan can
          read &ldquo;10 studio hours, 3 podcasts and 2 content days&rdquo;.
        </p>
        <p className="mt-3 max-w-prose text-sm text-muted">
          Allowances refill on the day of the month the membership started and do not roll over.
          Cancelling a booking hands the allowance straight back.
        </p>
      </header>

      {!readOnly ? (
        <details className="mt-8 border-y border-line">
          <summary className="eyebrow cursor-pointer py-4 text-accent-ink">Add a plan</summary>
          <div className="pb-6">
            <SettingsForm action={saveMembershipPlan} submitLabel="Create plan">
              <PlanFields />
            </SettingsForm>
          </div>
        </details>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        {plans.map((plan) => (
          <section key={plan.id} className="rounded-3xl bg-sand/50 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-xl font-bold">
                {plan.name}
                {plan.isActive ? null : (
                  <span className="ml-2 text-sm font-medium text-muted">archived</span>
                )}
              </h3>
              <span className="timecode text-muted">{formatMoney(plan.priceCents)} a month</span>
            </div>
            {plan.description ? (
              <p className="mt-2 max-w-prose text-sm text-muted">{plan.description}</p>
            ) : null}

            <h4 className="eyebrow mt-6 text-muted">Included each month</h4>
            {plan.entitlements.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing yet — this plan would not cover any session.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {plan.entitlements.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-paper px-4 py-3"
                  >
                    <span>{describeEntitlement(line)}</span>
                    {!readOnly ? (
                      <form action={removePlanEntitlement}>
                        <input type="hidden" name="id" value={line.id} />
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {!readOnly ? (
              <details className="mt-4">
                <summary className="eyebrow cursor-pointer py-2 text-accent-ink">
                  Add to this plan
                </summary>
                <div className="pb-2">
                  <SettingsForm action={savePlanEntitlement} submitLabel="Add line">
                    <EntitlementFields planId={plan.id} />
                  </SettingsForm>
                </div>
              </details>
            ) : null}

            {!readOnly ? (
              <details className="mt-2 border-t border-line pt-2">
                <summary className="eyebrow cursor-pointer py-2 text-muted">Edit plan</summary>
                <div className="pb-2">
                  <SettingsForm action={saveMembershipPlan}>
                    <PlanFields plan={plan} />
                  </SettingsForm>
                </div>
              </details>
            ) : null}
          </section>
        ))}
      </div>

      {plans.length === 0 ? (
        <p className="border-t border-line py-10 text-sm text-muted">
          No plans yet. Add one above, then attach it to a client under Clients.
        </p>
      ) : null}
    </div>
  );
}

/** "3 podcasts", "2 of any appointment", "10 hr of studio time". */
function describeEntitlement(line: PlanEntitlement): string {
  if (line.entitlementKind === "studio_hours") {
    return `${formatDuration(line.amount)} of studio time`;
  }
  if (!line.bookingType) {
    return `${line.amount} × any appointment`;
  }
  const label = BOOKING_TYPE_LABEL[line.bookingType as keyof typeof BOOKING_TYPE_LABEL];
  return `${line.amount} × ${label}`;
}

function PlanFields({ plan }: { plan?: MembershipPlan }) {
  return (
    <>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <div className="grid gap-6 sm:grid-cols-[1fr_180px]">
        <Field label="Plan name" errorSlot={<FormError name="name" />}>
          <Input name="name" defaultValue={plan?.name ?? ""} required />
        </Field>
        <Field label="Price a month (USD)" errorSlot={<FormError name="priceCents" />}>
          <Input
            name="price"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={plan ? (plan.priceCents / 100).toFixed(2) : "0.00"}
          />
        </Field>
        <Field label="Description" className="sm:col-span-2" errorSlot={<FormError name="description" />}>
          <Textarea name="description" rows={2} defaultValue={plan?.description ?? ""} />
        </Field>
      </div>
      <Checkbox name="isActive" label="Offered" defaultChecked={plan?.isActive ?? true} />
    </>
  );
}

function EntitlementFields({ planId }: { planId: string }) {
  return (
    <>
      <input type="hidden" name="planId" value={planId} />
      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="What kind" errorSlot={<FormError name="entitlementKind" />}>
          <Select name="entitlementKind" defaultValue="appointment_count">
            {ENTITLEMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ENTITLEMENT_KIND_LABEL[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Which appointment"
          hint="Leave as any for a line that covers everything."
          errorSlot={<FormError name="bookingType" />}
        >
          <Select name="bookingType" defaultValue="">
            <option value="">Any appointment</option>
            {BOOKING_TYPES.map((type) => (
              <option key={type} value={type}>
                {BOOKING_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="How many"
          hint="Hours for studio time, otherwise a count."
          errorSlot={<FormError name="amount" />}
        >
          <Input name="amount" type="number" min={1} step="0.5" inputMode="decimal" required />
        </Field>
      </div>
    </>
  );
}
