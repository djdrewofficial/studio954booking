import type { Metadata } from "next";

import { FormError, SettingsForm } from "@/components/settings/form";
import { UserActiveToggle } from "@/components/settings/toggles";
import { Field, Input, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { USER_ROLES, USER_ROLE_LABEL, canManageSettings, type UserRole } from "@/lib/domain";
import { saveUser } from "@/server/actions/settings";
import { listUsers } from "@/server/users";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const currentUser = await requireUser();
  const people = await listUsers();
  const readOnly = !canManageSettings(currentUser.role);

  return (
    <div className="min-w-0">
      <header>
        <h2 className="display text-2xl">Team</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Admins manage settings, sets and people. Team members run the room — calendar, bookings,
          statuses and prep sheets.
        </p>
      </header>

      {!readOnly ? (
        <details className="mt-8 border-y border-line">
          <summary className="eyebrow cursor-pointer py-4 text-accent-ink">Add someone</summary>
          <div className="pb-6">
            <fieldset disabled={readOnly}>
              <SettingsForm action={saveUser} submitLabel="Create account">
                <UserFields isNew />
              </SettingsForm>
            </fieldset>
          </div>
        </details>
      ) : null}

      <ul className="mt-8">
        {people.map((person) => (
          <li key={person.id} className="border-t border-line">
            <details>
              <summary className="flex cursor-pointer items-baseline justify-between gap-4 py-4">
                <span className="min-w-0">
                  <span className="block text-[0.9375rem]">{person.name}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{person.email}</span>
                </span>
                <span className="eyebrow shrink-0 text-muted">
                  {USER_ROLE_LABEL[person.role as UserRole]}
                  {person.isActive ? "" : " · Inactive"}
                </span>
              </summary>

              <div className="pb-6">
                <fieldset disabled={readOnly}>
                  <SettingsForm action={saveUser}>
                                          <>
                        <input type="hidden" name="id" value={person.id} />
                        <UserFields user={person} />
                      </>
                  </SettingsForm>
                </fieldset>
                {!readOnly ? (
                  <div className="mt-4">
                    <UserActiveToggle
                      id={person.id}
                      isActive={person.isActive}
                      isSelf={person.id === currentUser.id}
                    />
                  </div>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserFields({
  user,
  isNew,
}: {
  user?: { name: string; email: string; role: string };
  isNew?: boolean;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field label="Name" errorSlot={<FormError name="name" />}>
        <Input name="name" defaultValue={user?.name ?? ""} required />
      </Field>
      <Field label="Email" errorSlot={<FormError name="email" />}>
        <Input name="email" type="email" defaultValue={user?.email ?? ""} required />
      </Field>
      <Field label="Role" errorSlot={<FormError name="role" />}>
        <Select name="role" defaultValue={user?.role ?? "team"}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={isNew ? "Password" : "New password"}
        hint={isNew ? "At least 10 characters." : "Leave blank to keep the current one."}
        errorSlot={<FormError name="password" />}
      >
        <Input name="password" type="password" autoComplete="new-password" minLength={10} />
      </Field>
    </div>
  );
}
