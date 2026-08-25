import type { ComponentProps, ReactNode } from "react";

/** Tiny class joiner — no runtime dependency needed for something this small. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------------------
 * Type furniture
 * ------------------------------------------------------------------------ */

export function Eyebrow({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "h2" | "h3" | "span" | "p";
}) {
  return <Tag className={cx("label", className)}>{children}</Tag>;
}

/** A section heading with room to breathe. */
export function SectionTitle({
  children,
  hint,
  action,
  className,
}: {
  children: ReactNode;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div>
        <h2 className="display text-2xl">{children}</h2>
        {hint ? <p className="mt-1 text-[0.9375rem] text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Rule({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

/* ---------------------------------------------------------------------------
 * Buttons — deliberately large. These get tapped on an iPad in a dim studio.
 * ------------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-soft hover:bg-[#e0117f] hover:shadow-lift",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink hover:bg-sand",
  ghost: "text-muted hover:bg-sand hover:text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[0.9375rem]",
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
    />
  );
}

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className);
}

/* ---------------------------------------------------------------------------
 * Form fields
 * ------------------------------------------------------------------------ */

const CONTROL =
  "w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink " +
  "placeholder:text-muted/50 transition-colors " +
  "hover:border-muted/50 focus:border-accent focus:outline-none " +
  "disabled:bg-sand disabled:text-muted";

export function Field({
  label,
  labelHidden,
  hint,
  error,
  errorSlot,
  htmlFor,
  children,
  className,
}: {
  label: string;
  /**
   * Hides the label visually but keeps it for screen readers. For grids like
   * the rate card, where a column heading already says what the field is and
   * repeating it on every row would only add noise.
   */
  labelHidden?: boolean;
  hint?: string;
  /** A message already in hand — used by the fully client-side forms. */
  error?: string;
  /**
   * A node that renders the server-side error for this field, used by forms
   * whose page is a Server Component and cannot pass a callback down.
   */
  errorSlot?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className={cx("label text-ink", labelHidden && "sr-only")}>
        {label}
      </label>
      {children}
      {errorSlot}
      {error ? <p className="text-[0.9375rem] font-medium text-danger">{error}</p> : null}
      {hint && !error ? <p className="text-[0.9375rem] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(CONTROL, "h-12", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(CONTROL, "min-h-28 py-3 leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cx(CONTROL, "h-12 appearance-none pr-10", className)}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: ComponentProps<"input"> & { label: string; description?: string }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-sand",
        className,
      )}
    >
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 size-5 shrink-0 rounded-md border-2 border-line-strong accent-accent"
      />
      <span className="leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="block text-[0.9375rem] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** A friendly pill switch — used for internal/external and calendar views. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  name,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cx("inline-flex rounded-full border border-line bg-sand p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-full px-5 py-2.5 text-[0.9375rem] font-semibold transition-all",
              active ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * States
 * ------------------------------------------------------------------------ */

export function EmptyState({
  headline,
  body,
  action,
}: {
  headline: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card mt-6 px-6 py-16 text-center">
      <p className="display text-2xl text-ink">{headline}</p>
      {body ? <p className="mx-auto mt-3 max-w-md text-muted">{body}</p> : null}
      {action ? <div className="mt-8 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("shimmer rounded-xl", className)} aria-hidden />;
}

/* ---------------------------------------------------------------------------
 * Status
 * ------------------------------------------------------------------------ */

export type StatusTone = "live" | "ready" | "prep" | "neutral" | "done" | "off";

const TONE: Record<StatusTone, string> = {
  live: "bg-accent text-white",
  ready: "bg-ready-soft text-ready",
  prep: "bg-prep-soft text-prep",
  neutral: "bg-sand text-muted",
  done: "bg-ink text-white",
  off: "bg-sand text-muted line-through",
};

export function StatusChip({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.9375rem] font-semibold",
        TONE[tone],
        className,
      )}
    >
      {tone === "live" ? <span className="tally size-2 rounded-full bg-white" aria-hidden /> : null}
      {label}
    </span>
  );
}
