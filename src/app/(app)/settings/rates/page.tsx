import type { Metadata } from "next";

import { FormError, SettingsForm } from "@/components/settings/form";
import { Field, Input } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { BOOKING_TYPE_LABEL, canManageSettings } from "@/lib/domain";
import { saveRates } from "@/server/actions/settings";
import { listRates } from "@/server/rates";

export const metadata: Metadata = { title: "Rates" };

export default async function RatesSettingsPage() {
  const user = await requireUser();
  const rates = await listRates();
  const readOnly = !canManageSettings(user.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">What we charge</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Only external rentals are priced — internal shoots are our own time, and a membership
          session is already covered by the plan. Our technician and our equipment are included in
          every rental, so the price is the same whether the client uses them or brings their own.
          A price is captured on the booking when it is made, so changing anything here never
          rewrites an existing quote.
        </p>
      </header>

      <fieldset disabled={readOnly} className="mt-8">
        <SettingsForm action={saveRates} submitLabel="Save rates">
          <section>
            <h3 className="eyebrow text-muted">Per appointment</h3>
            <p className="mt-2 max-w-prose text-sm text-muted">
              A session can carry a flat price, an hourly rate, or both. Leave a row at zero if
              that type is never sold on its own.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <div className="hidden gap-4 px-1 sm:grid sm:grid-cols-[1fr_150px_150px]">
                <span className="eyebrow text-muted">Appointment</span>
                <span className="eyebrow text-muted">Flat price</span>
                <span className="eyebrow text-muted">Per hour</span>
              </div>

              {rates.map((rate) => (
                <div
                  key={rate.bookingType}
                  className="grid items-center gap-3 rounded-2xl bg-sand/50 p-4 sm:grid-cols-[1fr_150px_150px] sm:gap-4"
                >
                  <span className="font-semibold">
                    {BOOKING_TYPE_LABEL[rate.bookingType as keyof typeof BOOKING_TYPE_LABEL]}
                  </span>
                  <Field
                    label={`Flat price for ${BOOKING_TYPE_LABEL[rate.bookingType as keyof typeof BOOKING_TYPE_LABEL]}`}
                    labelHidden
                    errorSlot={<FormError name={`base.${rate.bookingType}`} />}
                  >
                    <Input
                      name={`base.${rate.bookingType}`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={(rate.baseCents / 100).toFixed(2)}
                    />
                  </Field>
                  <Field
                    label={`Hourly rate for ${BOOKING_TYPE_LABEL[rate.bookingType as keyof typeof BOOKING_TYPE_LABEL]}`}
                    labelHidden
                    errorSlot={<FormError name={`hourly.${rate.bookingType}`} />}
                  >
                    <Input
                      name={`hourly.${rate.bookingType}`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={(rate.hourlyCents / 100).toFixed(2)}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-line pt-7">
            <h3 className="eyebrow text-muted">Included in every rental</h3>
            <p className="mt-2 max-w-prose text-sm text-muted">
              Our technician and our equipment come with the room and are already in the prices
              above. A booking still records whose crew and gear are actually being used, because
              that changes how the room is prepared — but it never changes what is charged.
            </p>
          </section>

        </SettingsForm>
      </fieldset>
    </div>
  );
}
