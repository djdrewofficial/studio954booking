"use client";

import { createContext, useActionState, useContext, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import type { SettingsFormState } from "@/server/actions/settings";

/**
 * Every settings form behaves the same way: submit, show field errors in
 * place, confirm with a toast.
 *
 * Field errors travel by context rather than by a render callback, because the
 * settings pages are Server Components and a function cannot cross the
 * server/client boundary.
 */

const FormErrorsContext = createContext<Record<string, string>>({});

export function SettingsForm({
  action,
  submitLabel = "Save changes",
  children,
}: {
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState<SettingsFormState, FormData>(action, {});
  const { toast, error } = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    else if (state.ok === false && state.message) error(state.message);
  }, [state, toast, error]);

  return (
    <FormErrorsContext.Provider value={state.errors ?? {}}>
      <form action={formAction} className="flex flex-col gap-7">
        {children}
        <div className="flex items-center gap-3 border-t border-line pt-6">
          <SubmitButton label={submitLabel} />
        </div>
      </form>
    </FormErrorsContext.Provider>
  );
}

/** Renders the server-side error for one field, if there is one. */
export function FormError({ name }: { name: string }) {
  const errors = useContext(FormErrorsContext);
  const message = errors[name];
  if (!message) return null;
  return <p className="text-[0.9375rem] font-medium text-danger">{message}</p>;
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
          ? "rounded-full px-4 py-2 font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          : "rounded-full px-4 py-2 font-semibold text-muted transition-colors hover:bg-sand hover:text-ink"
      }
    >
      {children}
    </button>
  );
}
