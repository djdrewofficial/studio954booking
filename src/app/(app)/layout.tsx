import { Masthead } from "@/components/masthead";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/server/actions/auth";
import { getStudioSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireUser(), getStudioSettings()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Masthead
        studioName={settings.studioName}
        logoUrl={settings.logoUrl}
        timezone={settings.timezone}
        user={user}
        signOut={signOut}
      />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
