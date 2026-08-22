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
  as?: "div" | "h2" | "h3" | "span";
}) {
  return <Tag className={cx("eyebrow text-muted", className)}>{children}</Tag>;
}

/** A hairline. Used instead of wrapping regions in cards. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

/* ---------------------------------------------------------------------------
 * Buttons
 * ------------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-semibold " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  // Magenta fill carries near-black type: 5.2:1, and it reads far more
  // confidently than white-on-pink.
  primary: "bg-accent text-ink hover:bg-[#ff45a8] active:bg-[#e01286]",
  secondary: "border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-white",
  ghost: "text-muted hover:bg-paper-sunk hover:text-ink",
  danger: "border border-danger/40 text-danger hover:bg-danger hover:text-white",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
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

/** Same visual language as Button, for links that act like actions. */
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
  "w-full rounded-sm border border-line bg-white px-3 text-sm text-ink " +
  "placeholder:text-muted/60 transition-colors " +
  "hover:border-line-strong focus:border-ink focus:outline-none " +
  "disabled:bg-paper-sunk disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="eyebrow text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.8125rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(CONTROL, "h-10", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(CONTROL, "min-h-24 py-2 leading-relaxed", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={cx(CONTROL, "h-10 appearance-none pr-8", className)}>
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
    <label className={cx("flex cursor-pointer items-start gap-2.5 py-1", className)}>
      <input
        type="checkbox"
        {...props}
        className="mt-0.5 size-4 shrink-0 rounded-[2px] border border-line-strong accent-accent"
      />
      <span className="text-sm leading-snug">
        <span className="text-ink">{label}</span>
        {description ? <span className="block text-[0.8125rem] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/**
 * A ruled segmented control — used for internal/external and the calendar view
 * switch. Reads as one object rather than a row of pills.
 */
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
      className={cx("inline-flex rounded-sm border border-line bg-white p-0.5", className)}
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
              "eyebrow rounded-[2px] px-3 py-2 transition-colors",
              active ? "bg-ink text-white" : "text-muted hover:text-ink",
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
    <div className="border-t border-line py-16 text-center">
      <p className="display text-2xl text-ink">{headline}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("shimmer rounded-sm", className)} aria-hidden />;
}

/**
 * Status is almost entirely monochrome on purpose. Only a live session earns
 * the accent — everything else is a small ruled tag.
 */
export function StatusChip({
  label,
  live = false,
  muted = false,
  className,
}: {
  label: string;
  live?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "eyebrow inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1",
        live
          ? "border-accent bg-accent text-ink"
          : muted
            ? "border-line text-muted"
            : "border-line-strong text-ink",
        className,
      )}
    >
      {live ? <span className="tally size-1.5 rounded-full bg-ink" aria-hidden /> : null}
      {label}
    </span>
  );
}
