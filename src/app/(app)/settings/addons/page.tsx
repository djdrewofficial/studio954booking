import type { Metadata } from "next";

import { FormError, SettingsForm } from "@/components/settings/form";
import { ArchiveToggle } from "@/components/settings/toggles";
import { Checkbox, Field, Input, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/domain";
import { saveAddon } from "@/server/actions/settings";
import { listAddons, type Addon } from "@/server/sets";

export const metadata: Metadata = { title: "Add-ons" };

export default async function AddonsSettingsPage() {
  const user = await requireUser();
  const addons = await listAddons(true);
  const readOnly = !canManageSettings(user.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Rental add-ons</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Extras offered on external rentals — crew, gear and services. Prices are captured on the
          booking, so changing one here never rewrites what a past client was quoted.
        </p>
      </header>

      {!readOnly ? (
        <details className="mt-8 border-y border-line">
          <summary className="eyebrow cursor-pointer py-4 text-accent-ink">Add an add-on</summary>
          <div className="pb-6">
            <fieldset disabled={readOnly}>
              <SettingsForm action={saveAddon} submitLabel="Create add-on">
                <AddonFields />
              </SettingsForm>
            </fieldset>
          </div>
        </details>
      ) : null}

      <ul className="mt-8">
        {addons.map((addon) => (
          <li key={addon.id} className="border-t border-line">
            <details>
              <summary className="flex cursor-pointer items-baseline justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block text-[0.9375rem]">{addon.name}</span>
                  {addon.description ? (
                    <span className="mt-1 block text-sm text-muted">{addon.description}</span>
                  ) : null}
                </span>
                <span className="timecode shrink-0 text-sm text-muted">
                  ${(addon.priceCents / 100).toFixed(2)}
                  {addon.isActive ? "" : " · archived"}
                </span>
              </summary>

              <div className="pb-6">
                <fieldset disabled={readOnly}>
                  <SettingsForm action={saveAddon}>
                    <AddonFields addon={addon} />
                  </SettingsForm>
                </fieldset>
                {!readOnly ? (
                  <div className="mt-4">
                    <ArchiveToggle kind="addon" id={addon.id} isActive={addon.isActive} />
                  </div>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>

      {addons.length === 0 ? (
        <p className="border-t border-line py-10 text-sm text-muted">No add-ons configured.</p>
      ) : null}
    </div>
  );
}

function AddonFields({ addon }: { addon?: Addon }) {
  return (
    <>
      {addon ? <input type="hidden" name="id" value={addon.id} /> : null}
      <div className="grid gap-6 sm:grid-cols-[1fr_160px]">
        <Field label="Name" errorSlot={<FormError name="name" />}>
          <Input name="name" defaultValue={addon?.name ?? ""} required />
        </Field>
        <Field label="Price (USD)" errorSlot={<FormError name="priceCents" />}>
          <Input
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={addon ? (addon.priceCents / 100).toFixed(2) : "0.00"}
          />
        </Field>
        <Field label="Description" className="sm:col-span-2" errorSlot={<FormError name="description" />}>
          <Textarea name="description" rows={2} defaultValue={addon?.description ?? ""} />
        </Field>
      </div>
      <Checkbox name="isActive" label="Offered" defaultChecked={addon?.isActive ?? true} />
    </>
  );
}
