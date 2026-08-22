"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cx } from "./ui";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/bookings", label: "Bookings" },
  { href: "/settings", label: "Settings" },
] as const;

/**
 * The masthead is a horizontal black band, not a sidebar. Four destinations is
 * few enough that they belong in the header, which keeps the whole width of
 * the screen available for the schedule itself.
 */
export function Masthead({
  studioName,
  logoUrl,
  timezone,
  user,
  signOut,
}: {
  studioName: string;
  logoUrl: string | null;
  timezone: string;
  user: { name: string; email: string; role: string };
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <header data-print="hide" className="sticky top-0 z-40 bg-ink text-white">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/today" className="flex items-center gap-2.5" aria-label={`${studioName} home`}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={studioName}
              width={120}
              height={24}
              className="h-6 w-auto object-contain"
              unoptimized
            />
          ) : (
            <>
              {/* Placeholder mark — drop a logo into Settings and it takes over. */}
              <span className="block h-[18px] w-[3px] bg-accent" aria-hidden />
              <span className="eyebrow-lg text-white">{studioName}</span>
            </>
          )}
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden md:block">
          <ul className="flex items-stretch">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "eyebrow relative flex h-14 items-center px-4 transition-colors",
                      active ? "text-white" : "text-ink-muted hover:text-white",
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" aria-hidden />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <StudioClock timezone={timezone} />
          <UserMenu user={user} signOut={signOut} />
        </div>
      </div>

      {/* On narrow screens the nav drops to its own full-width row. */}
      <nav aria-label="Primary" className="border-t border-ink-line md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "eyebrow relative flex h-11 items-center justify-center transition-colors",
                    active ? "text-white" : "text-ink-muted",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-4 bottom-0 h-0.5 bg-accent" aria-hidden />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

/** Studio-local wall clock. Renders nothing until mounted to avoid a hydration mismatch. */
function StudioClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: timezone,
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [timezone]);

  return (
    <span
      className="timecode hidden text-sm text-ink-muted tabular-nums sm:block"
      suppressHydrationWarning
    >
      {now ?? "—"}
    </span>
  );
}

function UserMenu({
  user,
  signOut,
}: {
  user: { name: string; email: string; role: string };
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="eyebrow flex size-8 items-center justify-center rounded-sm border border-ink-line text-white transition-colors hover:border-white/40"
      >
        {initials || "—"}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="rise absolute right-0 z-20 mt-2 w-56 rounded-sm border border-ink-line bg-ink-raised p-1 shadow-xl"
          >
            <div className="border-b border-ink-line px-3 py-2.5">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-[0.8125rem] text-ink-muted">{user.email}</p>
              <p className="eyebrow mt-1.5 text-ink-muted">{user.role}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-[2px] px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
