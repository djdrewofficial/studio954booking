import type { Metadata } from "next";

import { SettingsForm } from "@/components/settings/form";
import { Field, Input, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/domain";
import { saveStudioSettings } from "@/server/actions/settings";
import { getStudioSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Studio settings" };

export default async function StudioSettingsPage() {
  const user = await requireUser();
  const settings = await getStudioSettings();
  const readOnly = !canManageSettings(user.role);

  return (
    <fieldset disabled={readOnly} className="min-w-0">
      <SettingsForm action={saveStudioSettings}>
        {(errors) => (
          <>
            <section>
              <h2 className="eyebrow text-muted">Identity</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <Field label="Studio name" htmlFor="studioName" error={errors.studioName}>
                  <Input id="studioName" name="studioName" defaultValue={settings.studioName} />
                </Field>
                <Field
                  label="Timezone"
                  htmlFor="timezone"
                  hint="IANA name, e.g. America/New_York."
                  error={errors.timezone}
                >
                  <Input id="timezone" name="timezone" defaultValue={settings.timezone} />
                </Field>
                <Field
                  label="Booking contact email"
                  htmlFor="contactEmail"
                  error={errors.contactEmail}
                >
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={settings.contactEmail ?? ""}
                  />
                </Field>
                <Field
                  label="Logo URL"
                  htmlFor="logoUrl"
                  hint="Shown in the masthead. Leave empty for the wordmark."
                  error={errors.logoUrl}
                >
                  <Input id="logoUrl" name="logoUrl" defaultValue={settings.logoUrl ?? ""} />
                </Field>
              </div>
            </section>

            <section className="border-t border-line pt-7">
              <h2 className="eyebrow text-muted">Address</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <Field label="Street" htmlFor="addressLine1" className="sm:col-span-2">
                  <Input
                    id="addressLine1"
                    name="addressLine1"
                    defaultValue={settings.addressLine1 ?? ""}
                  />
                </Field>
                <Field label="Suite or unit" htmlFor="addressLine2" className="sm:col-span-2">
                  <Input
                    id="addressLine2"
                    name="addressLine2"
                    defaultValue={settings.addressLine2 ?? ""}
                  />
                </Field>
                <Field label="City" htmlFor="city">
                  <Input id="city" name="city" defaultValue={settings.city ?? ""} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="State" htmlFor="region">
                    <Input id="region" name="region" defaultValue={settings.region ?? ""} />
                  </Field>
                  <Field label="ZIP" htmlFor="postalCode">
                    <Input
                      id="postalCode"
                      name="postalCode"
                      defaultValue={settings.postalCode ?? ""}
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="border-t border-line pt-7">
              <h2 className="eyebrow text-muted">Default buffers</h2>
              <p className="mt-2 max-w-prose text-sm text-muted">
                How long the room is held before and after a session. External rentals usually need
                longer than an internal shoot.
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-4">
                <Field
                  label="Internal setup"
                  htmlFor="internalSetupMinutes"
                  error={errors.internalSetupMinutes}
                >
                  <Input
                    id="internalSetupMinutes"
                    name="internalSetupMinutes"
                    type="number"
                    min={0}
                    max={480}
                    step={5}
                    defaultValue={settings.internalSetupMinutes}
                  />
                </Field>
                <Field
                  label="Internal reset"
                  htmlFor="internalResetMinutes"
                  error={errors.internalResetMinutes}
                >
                  <Input
                    id="internalResetMinutes"
                    name="internalResetMinutes"
                    type="number"
                    min={0}
                    max={480}
                    step={5}
                    defaultValue={settings.internalResetMinutes}
                  />
                </Field>
                <Field
                  label="External setup"
                  htmlFor="externalSetupMinutes"
                  error={errors.externalSetupMinutes}
                >
                  <Input
                    id="externalSetupMinutes"
                    name="externalSetupMinutes"
                    type="number"
                    min={0}
                    max={480}
                    step={5}
                    defaultValue={settings.externalSetupMinutes}
                  />
                </Field>
                <Field
                  label="External reset"
                  htmlFor="externalResetMinutes"
                  error={errors.externalResetMinutes}
                >
                  <Input
                    id="externalResetMinutes"
                    name="externalResetMinutes"
                    type="number"
                    min={0}
                    max={480}
                    step={5}
                    defaultValue={settings.externalResetMinutes}
                  />
                </Field>
              </div>
            </section>

            <section className="border-t border-line pt-7">
              <Field
                label="Arrival instructions"
                htmlFor="arrivalInstructions"
                hint="Included in confirmation and reminder emails."
              >
                <Textarea
                  id="arrivalInstructions"
                  name="arrivalInstructions"
                  rows={3}
                  defaultValue={settings.arrivalInstructions ?? ""}
                />
              </Field>
            </section>
          </>
        )}
      </SettingsForm>
    </fieldset>
  );
}
