import type { Metadata } from "next";

import { ImageUpload } from "@/components/image-upload";
import { FormError, SettingsForm } from "@/components/settings/form";
import { ArchiveToggle } from "@/components/settings/toggles";
import { Checkbox, Field, Input, Textarea } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/domain";
import { saveOptionCategory, saveSetOption } from "@/server/actions/settings";
import { getOptionCatalogue, listStudioSets, type SetOptionWithScope, type StudioSet } from "@/server/sets";

export const metadata: Metadata = { title: "Set options" };

export default async function SetOptionsPage() {
  const user = await requireUser();
  const [catalogue, sets] = await Promise.all([getOptionCatalogue(true), listStudioSets(true)]);
  const readOnly = !canManageSettings(user.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Set options</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Everything the room can be dressed with. An option left unassigned is offered on every
          set; assign it to specific sets to narrow where it appears.
        </p>
      </header>

      {catalogue.map((category) => (
        <section key={category.id} className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-3">
            <h3 className="display text-xl">{category.name}</h3>
            <span className="eyebrow text-muted">
              {category.allowsMultiple ? "Multiple" : "Single choice"}
              {category.isRequired ? " · Required" : ""}
              {category.isActive ? "" : " · Hidden"}
            </span>
          </div>

          <ul>
            {category.options.map((option) => (
              <li key={option.id} className="border-b border-line">
                <details>
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      {option.swatchHex ? (
                        <span
                          aria-hidden
                          className="size-3.5 shrink-0 rounded-[1px] ring-1 ring-ink/15"
                          style={{ backgroundColor: option.swatchHex }}
                        />
                      ) : null}
                      <span className="truncate text-[0.9375rem]">{option.name}</span>
                    </span>
                    <span className="eyebrow shrink-0 text-muted">
                      {option.studioSetIds.length === 0
                        ? "All sets"
                        : `${option.studioSetIds.length} set${option.studioSetIds.length === 1 ? "" : "s"}`}
                      {option.isActive ? "" : " · Archived"}
                    </span>
                  </summary>

                  <div className="pb-6">
                    <fieldset disabled={readOnly}>
                      <SettingsForm action={saveSetOption}>
                                                  <OptionFields
                            categoryId={category.id}
                            sets={sets}
                            option={option}
                          />
                      </SettingsForm>
                    </fieldset>
                    {!readOnly ? (
                      <div className="mt-4">
                        <ArchiveToggle kind="option" id={option.id} isActive={option.isActive} />
                      </div>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>

          {!readOnly ? (
            <details className="border-b border-line">
              <summary className="eyebrow cursor-pointer py-3 text-accent-ink">
                Add to {category.name}
              </summary>
              <div className="pb-6">
                <fieldset disabled={readOnly}>
                  <SettingsForm action={saveSetOption} submitLabel="Add option">
                                          <OptionFields categoryId={category.id} sets={sets} />
                  </SettingsForm>
                </fieldset>
              </div>
            </details>
          ) : null}
        </section>
      ))}

      {/* Categories are changed rarely, so they live at the bottom. */}
      <section className="mt-16 border-t-2 border-ink pt-6">
        <h3 className="display text-xl">Categories</h3>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The groups options are organised into — curtain, seating, lighting and so on.
        </p>

        <ul className="mt-6">
          {catalogue.map((category) => (
            <li key={category.id} className="border-t border-line">
              <details>
                <summary className="flex cursor-pointer items-baseline justify-between gap-4 py-3">
                  <span className="text-[0.9375rem]">{category.name}</span>
                  <span className="timecode text-[0.8125rem] text-muted">{category.slug}</span>
                </summary>
                <div className="pb-6">
                  <fieldset disabled={readOnly}>
                    <SettingsForm action={saveOptionCategory}>
                                              <>
                          <input type="hidden" name="id" value={category.id} />
                          <CategoryFields category={category} />
                        </>
                    </SettingsForm>
                  </fieldset>
                </div>
              </details>
            </li>
          ))}
        </ul>

        {!readOnly ? (
          <details className="border-y border-line">
            <summary className="eyebrow cursor-pointer py-3 text-accent-ink">Add a category</summary>
            <div className="pb-6">
              <fieldset disabled={readOnly}>
                <SettingsForm action={saveOptionCategory} submitLabel="Create category">
                  <CategoryFields />
                </SettingsForm>
              </fieldset>
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function OptionFields({
  categoryId,
  sets,
  option,
}: {
  categoryId: string;
  sets: StudioSet[];
  option?: SetOptionWithScope;
}) {
  return (
    <>
      <input type="hidden" name="categoryId" value={categoryId} />
      {option ? <input type="hidden" name="id" value={option.id} /> : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name" errorSlot={<FormError name="name" />}>
          <Input name="name" defaultValue={option?.name ?? ""} required />
        </Field>
        <Field label="Swatch colour" hint="Optional hex, e.g. #D8C7A8." errorSlot={<FormError name="swatchHex" />}>
          <Input name="swatchHex" defaultValue={option?.swatchHex ?? ""} placeholder="#D8C7A8" />
        </Field>
        <ImageUpload name="imageUrl" defaultValue={option?.imageUrl} label="Option photo" />
        <Field label="Description" errorSlot={<FormError name="description" />}>
          <Textarea name="description" rows={2} defaultValue={option?.description ?? ""} />
        </Field>
      </div>

      <fieldset>
        <legend className="eyebrow text-muted">Offered on</legend>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Leave every box unticked to offer this on all sets.
        </p>
        <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {sets.map((set) => (
            <Checkbox
              key={set.id}
              name="studioSetIds"
              value={set.id}
              label={set.name}
              defaultChecked={option?.studioSetIds.includes(set.id) ?? false}
            />
          ))}
        </div>
      </fieldset>

      <Checkbox name="isActive" label="Active" defaultChecked={option?.isActive ?? true} />
    </>
  );
}

function CategoryFields({
  category,
}: {
  category?: { name: string; slug: string; allowsMultiple: boolean; isRequired: boolean; isActive: boolean };
}) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Name" errorSlot={<FormError name="name" />}>
          <Input name="name" defaultValue={category?.name ?? ""} required />
        </Field>
        <Field label="Slug" hint="Lowercase, no spaces." errorSlot={<FormError name="slug" />}>
          <Input name="slug" defaultValue={category?.slug ?? ""} required />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-8">
        <Checkbox
          name="allowsMultiple"
          label="Allow several choices"
          defaultChecked={category?.allowsMultiple ?? false}
        />
        <Checkbox
          name="isRequired"
          label="Required"
          defaultChecked={category?.isRequired ?? false}
        />
        <Checkbox name="isActive" label="Active" defaultChecked={category?.isActive ?? true} />
      </div>
    </>
  );
}
