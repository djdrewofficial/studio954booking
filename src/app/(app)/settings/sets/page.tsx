import type { Metadata } from "next";

import { FormError, SettingsForm } from "@/components/settings/form";
import { ArchiveToggle } from "@/components/settings/toggles";
import { Checkbox, Field, Input, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/domain";
import { saveStudioSet } from "@/server/actions/settings";
import { listStudioSets, type StudioSet } from "@/server/sets";

export const metadata: Metadata = { title: "Sets" };

export default async function SetsSettingsPage() {
  const user = await requireUser();
  const sets = await listStudioSets(true);
  const readOnly = !canManageSettings(user.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Studio sets</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The physical configurations the room can be built into. Archive a set instead of deleting
          it so past bookings keep their history.
        </p>
      </header>

      {!readOnly ? (
        <details className="mt-8 border-y border-line">
          <summary className="eyebrow cursor-pointer py-4 text-accent-ink">Add a set</summary>
          <div className="pb-6">
            <fieldset disabled={readOnly}>
              <SettingsForm action={saveStudioSet} submitLabel="Create set">
                <SetFields />
              </SettingsForm>
            </fieldset>
          </div>
        </details>
      ) : null}

      <ul className="mt-8">
        {sets.map((set) => (
          <li key={set.id} className="border-t border-line">
            <details>
              <summary className="flex cursor-pointer items-baseline justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="display block text-xl">{set.name}</span>
                  {set.description ? (
                    <span className="mt-1 block text-sm text-muted">{set.description}</span>
                  ) : null}
                </span>
                <span className="eyebrow shrink-0 text-muted">
                  {set.isActive ? "Active" : "Archived"}
                </span>
              </summary>

              <div className="pb-6">
                <fieldset disabled={readOnly}>
                  <SettingsForm action={saveStudioSet}>
                    <SetFields set={set} />
                  </SettingsForm>
                </fieldset>
                {!readOnly ? (
                  <div className="mt-4">
                    <ArchiveToggle kind="set" id={set.id} isActive={set.isActive} />
                  </div>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>

      {sets.length === 0 ? (
        <p className="border-t border-line py-10 text-sm text-muted">
          No sets yet. Add the first one above.
        </p>
      ) : null}
    </div>
  );
}

function SetFields({ set }: { set?: StudioSet }) {
  return (
    <>
      {set ? <input type="hidden" name="id" value={set.id} /> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name" errorSlot={<FormError name="name" />}>
          <Input name="name" defaultValue={set?.name ?? ""} placeholder="Podcast Lounge" required />
        </Field>
        <Field label="Image URL" hint="Shown when choosing a set." errorSlot={<FormError name="imageUrl" />}>
          <Input name="imageUrl" defaultValue={set?.imageUrl ?? ""} />
        </Field>
        <Field label="Description" className="sm:col-span-2" errorSlot={<FormError name="description" />}>
          <Textarea
            name="description"
            rows={2}
            defaultValue={set?.description ?? ""}
            placeholder="Two to four seats around a low table."
          />
        </Field>
      </div>
      <Checkbox name="isActive" label="Active" defaultChecked={set?.isActive ?? true} />
    </>
  );
}
