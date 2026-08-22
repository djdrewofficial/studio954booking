import type { SetupGroup } from "@/lib/schedule";
import { cx } from "./ui";

/**
 * The room recipe. Used inline on the Today rundown, as a full block on the
 * booking detail, and again on the printed prep sheet — one component so the
 * studio always reads the same thing in the same order.
 */
export function SetupRecipe({
  setup,
  layout = "inline",
  className,
}: {
  setup: SetupGroup[];
  /** `inline` wraps compactly; `block` gives each line its own row. */
  layout?: "inline" | "block";
  className?: string;
}) {
  if (!setup.length) return null;

  if (layout === "block") {
    return (
      <dl className={cx("divide-y divide-line border-y border-line", className)}>
        {setup.map((group) => (
          <div key={group.categorySlug} className="grid grid-cols-[minmax(96px,26%)_1fr] gap-4 py-3">
            <dt className="eyebrow pt-1 text-muted">{group.categoryName}</dt>
            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-ink">
              {group.options.map((option, i) => (
                <span key={option.name} className="inline-flex items-center gap-1.5">
                  {i > 0 ? <span className="text-line-strong">+</span> : null}
                  <Swatch hex={option.swatchHex} />
                  {option.name}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={cx("flex flex-wrap gap-x-7 gap-y-3", className)}>
      {setup.map((group) => (
        <div key={group.categorySlug}>
          <dt className="eyebrow text-muted">{group.categoryName}</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink">
            {group.options.map((option, i) => (
              <span key={option.name} className="inline-flex items-center gap-1.5">
                {i > 0 ? <span className="text-line-strong">+</span> : null}
                <Swatch hex={option.swatchHex} />
                {option.name}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A small square chip for options that carry a colour (curtains, lighting). */
function Swatch({ hex }: { hex: string | null }) {
  if (!hex) return null;
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 rounded-[1px] ring-1 ring-ink/15"
      style={{ backgroundColor: hex }}
    />
  );
}

/** One-line version for dense contexts such as calendar blocks. */
export function setupOneLine(setup: SetupGroup[]): string {
  return setup
    .map((group) => group.options.map((o) => o.name).join(" + "))
    .filter(Boolean)
    .join(" · ");
}
