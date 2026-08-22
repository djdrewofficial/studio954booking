"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthFormState } from "@/server/actions/auth";
import { createFirstAdmin, signIn } from "@/server/actions/auth";

const FIELD =
  "h-11 w-full rounded-sm border border-ink-line bg-transparent px-3 text-sm text-white " +
  "placeholder:text-ink-muted transition-colors hover:border-white/30 focus:border-white focus:outline-none";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-sm bg-accent text-sm font-semibold text-ink transition-colors hover:bg-[#ff45a8] disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function DarkField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="eyebrow text-ink-muted">{label}</label>
      {children}
      {error ? <p className="text-[0.8125rem] text-accent">{error}</p> : null}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="border-l-2 border-accent bg-white/5 px-3 py-2 text-[0.8125rem] text-white">
      {message}
    </p>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.errors?.form} />

      <DarkField label="Email" error={state.errors?.email}>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          placeholder="you@studio954.com"
          className={FIELD}
        />
      </DarkField>

      <DarkField label="Password" error={state.errors?.password}>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </DarkField>

      <Submit label="Sign in" pendingLabel="Signing in…" />
    </form>
  );
}

export function FirstRunForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(createFirstAdmin, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.errors?.form} />

      <DarkField label="Your name" error={state.errors?.name}>
        <input name="name" autoComplete="name" autoFocus required className={FIELD} />
      </DarkField>

      <DarkField label="Email" error={state.errors?.email}>
        <input name="email" type="email" autoComplete="username" required className={FIELD} />
      </DarkField>

      <DarkField label="Password" error={state.errors?.password}>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={FIELD}
        />
      </DarkField>

      <p className="text-[0.8125rem] leading-relaxed text-ink-muted">
        This becomes the studio&rsquo;s admin account. You can add the rest of the team from
        Settings afterwards.
      </p>

      <Submit label="Create admin account" pendingLabel="Creating…" />
    </form>
  );
}
