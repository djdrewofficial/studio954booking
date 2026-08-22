"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import type { SettingsFormState } from "@/server/actions/settings";

/**
 * Every settings form behaves the same way: submit, show field errors in
 * place, confirm with a toast. This wrapper owns that so the individual pages
 * stay declarative.
 */
export function SettingsForm({
  action,
  submitLabel = "Save changes",
  children,
  onSaved,
}: {
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  submitLabel?: string;
  children: (errors: Record<string, string>) => React.ReactNode;
  onSaved?: () => void;
}) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(action, {});
  const { toast, error } = useToast();

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      onSaved?.();
    } else if (state.ok === false && state.message) {
      error(state.message);
    }
    // Intentionally keyed on the state object so each submit reports once.
  }, [state, toast, error, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {children(state.errors ?? {})}
      <div className="flex items-center gap-3 border-t border-line pt-6">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/** Toggle used by the archive/restore buttons on list rows. */
export function RowAction({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "text-[0.8125rem] text-muted underline-offset-2 hover:text-danger hover:underline"
          : "text-[0.8125rem] text-muted underline-offset-2 hover:text-ink hover:underline"
      }
    >
      {children}
    </button>
  );
}
