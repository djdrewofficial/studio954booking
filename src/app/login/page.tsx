import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getStudioSettings } from "@/server/settings";
import { hasAnyUser } from "@/server/actions/auth";

import { FirstRunForm, LoginForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/today");

  const [settings, claimed] = await Promise.all([getStudioSettings(), hasAnyUser()]);

  return (
    <main className="flex min-h-dvh flex-col bg-ink text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_minmax(0,380px)] lg:items-center lg:gap-24">
          {/* Editorial half — the studio, stated plainly and at scale. */}
          <div>
            <div className="flex items-center gap-3">
              <span className="block h-6 w-1 bg-accent" aria-hidden />
              <span className="eyebrow-lg">{settings.studioName}</span>
            </div>

            <h1 className="display mt-10 text-5xl text-white sm:text-7xl">
              Booking and
              <br />
              studio operations.
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              One room, one schedule. See what is happening today, how the studio needs to look,
              and who is walking through the door.
            </p>

            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-ink-line pt-6">
              {["Podcasts", "Interviews", "Social Content", "Photography", "Livestreams"].map(
                (item) => (
                  <span key={item} className="eyebrow text-ink-muted">
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          {/* Form half */}
          <div className="lg:border-l lg:border-ink-line lg:pl-16">
            <h2 className="eyebrow-lg mb-8 text-white">
              {claimed ? "Sign in" : "Set up the studio"}
            </h2>
            {claimed ? <LoginForm /> : <FirstRunForm />}
          </div>
        </div>
      </div>
    </main>
  );
}
