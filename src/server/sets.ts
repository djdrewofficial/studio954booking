import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { addons, setOptionCategories, setOptionSets, setOptions, studioSets } from "@/db/schema";

export type StudioSet = typeof studioSets.$inferSelect;
export type SetOptionCategory = typeof setOptionCategories.$inferSelect;
export type Addon = typeof addons.$inferSelect;

export type SetOptionWithScope = typeof setOptions.$inferSelect & {
  /** Empty means the option is offered on every set. */
  studioSetIds: string[];
};

export type OptionCategoryWithOptions = SetOptionCategory & {
  options: SetOptionWithScope[];
};

export async function listStudioSets(includeArchived = false): Promise<StudioSet[]> {
  const rows = await db
    .select()
    .from(studioSets)
    .orderBy(asc(studioSets.sortOrder), asc(studioSets.name));
  return includeArchived ? rows : rows.filter((s) => s.isActive);
}

export async function getStudioSet(id: string): Promise<StudioSet | null> {
  const rows = await db.select().from(studioSets).where(eq(studioSets.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * The full customisation catalogue, grouped by category and annotated with the
 * sets each option belongs to. One query pair, then assembled in memory — the
 * catalogue is small and this keeps the call sites simple.
 */
export async function getOptionCatalogue(
  includeArchived = false,
): Promise<OptionCategoryWithOptions[]> {
  const [categories, options, scopes] = await Promise.all([
    db.select().from(setOptionCategories).orderBy(asc(setOptionCategories.sortOrder)),
    db.select().from(setOptions).orderBy(asc(setOptions.sortOrder), asc(setOptions.name)),
    db.select().from(setOptionSets),
  ]);

  const scopeByOption = new Map<string, string[]>();
  for (const s of scopes) {
    const list = scopeByOption.get(s.setOptionId) ?? [];
    list.push(s.studioSetId);
    scopeByOption.set(s.setOptionId, list);
  }

  return categories
    .filter((c) => includeArchived || c.isActive)
    .map((category) => ({
      ...category,
      options: options
        .filter((o) => o.categoryId === category.id)
        .filter((o) => includeArchived || o.isActive)
        .map((o) => ({ ...o, studioSetIds: scopeByOption.get(o.id) ?? [] })),
    }));
}

/** Narrows the catalogue to the options actually offered on one set. */
export function catalogueForSet(
  catalogue: OptionCategoryWithOptions[],
  studioSetId: string | null | undefined,
): OptionCategoryWithOptions[] {
  return catalogue
    .map((category) => ({
      ...category,
      options: category.options.filter(
        (o) => o.studioSetIds.length === 0 || (studioSetId ? o.studioSetIds.includes(studioSetId) : false),
      ),
    }))
    .filter((category) => category.options.length > 0);
}

export async function listAddons(includeArchived = false): Promise<Addon[]> {
  const rows = await db.select().from(addons).orderBy(asc(addons.sortOrder), asc(addons.name));
  return includeArchived ? rows : rows.filter((a) => a.isActive);
}
