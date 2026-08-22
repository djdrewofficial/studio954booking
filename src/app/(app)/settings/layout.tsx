import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { canManageSettings } from "@/lib/domain";

import { SettingsNav } from "./nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = canManageSettings(user.role);

  return (
    <div className="pt-10">
      <p className="eyebrow text-muted">Settings</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">How the studio runs.</h1>

      {!isAdmin ? (
        <p className="mt-6 border-l-2 border-line-strong pl-4 text-sm text-muted">
          You have team access. Settings are read-only — ask an admin to make changes.
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-16">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>

      {!isAdmin ? (
        <p className="sr-only">
          Read-only view. Changes require an administrator account.
        </p>
      ) : null}

      <p className="mt-16 text-[0.8125rem] text-muted">
        Need something that is not here?{" "}
        <Link href="/today" className="underline underline-offset-2">
          Back to Today
        </Link>
      </p>
    </div>
  );
}
