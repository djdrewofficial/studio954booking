import Image from "next/image";

import type { SetupGroup, SetupOption } from "@/lib/schedule";
import { cx } from "./ui";

/**
 * How the room has to look, shown as picture tiles rather than a table of
 * words. Whoever is dressing the set should be able to recognise every choice
 * at a glance without reading a single label.
 *
 * Used on the Today rundown, the booking detail and the printed prep sheet.
 */
export function SetupRecipe({
  setup,
  size = "md",
  className,
}: {
  setup: SetupGroup[];
  /** `sm` for dense rundown rows, `md` for the booking detail. */
  size?: "sm" | "md";
  className?: string;
}) {
  if (!setup.length) return null;

  return (
    <ul className={cx("flex flex-wrap gap-2.5", className)}>
      {setup.flatMap((group) =>
        group.options.map((option) => (
          <li key={`${group.categorySlug}-${option.name}`}>
            <OptionTile option={option} category={group.categoryName} size={size} />
          </li>
        )),
      )}
    </ul>
  );
}

function OptionTile({
  option,
  category,
  size,
}: {
  option: SetupOption;
  category: string;
  size: "sm" | "md";
}) {
  const thumb = size === "sm" ? "size-9" : "size-12";

  return (
    <div
      className={cx(
        "flex items-center gap-3 rounded-2xl bg-sand pr-4",
        size === "sm" ? "p-1.5" : "p-2",
      )}
    >
      <span
        className={cx(
          "relative shrink-0 overflow-hidden rounded-xl bg-line",
          thumb,
        )}
        style={option.imageUrl ? undefined : { backgroundColor: option.swatchHex ?? undefined }}
        aria-hidden
      >
        {option.imageUrl ? (
          <Image
            src={option.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="48px"
            unoptimized
          />
        ) : null}
      </span>

      <span className="min-w-0 leading-tight">
        <span className="block text-[0.8125rem] text-muted">{category}</span>
        <span
          className={cx(
            "block truncate font-semibold text-ink",
            size === "sm" ? "text-[0.9375rem]" : "text-base",
          )}
        >
          {option.name}
        </span>
      </span>
    </div>
  );
}

/** One-line version for dense contexts such as calendar blocks. */
export function setupOneLine(setup: SetupGroup[]): string {
  return setup
    .map((group) => group.options.map((o) => o.name).join(" + "))
    .filter(Boolean)
    .join(" · ");
}

/** Plain rows, for the printed prep sheet where photos may not help. */
export function SetupList({ setup, className }: { setup: SetupGroup[]; className?: string }) {
  if (!setup.length) return null;
  return (
    <dl className={cx("grid gap-x-10 sm:grid-cols-2", className)}>
      {setup.map((group) => (
        <div
          key={group.categorySlug}
          className="flex items-baseline justify-between gap-4 border-b border-line py-3"
        >
          <dt className="label">{group.categoryName}</dt>
          <dd className="text-right font-semibold">
            {group.options.map((o) => o.name).join(" + ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
