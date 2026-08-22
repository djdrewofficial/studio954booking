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
 * A horizontal header rather than a sidebar — four destinations is few enough
 * that they belong across the top, which leaves the whole width of the screen
 * for the schedule. The active tab is a filled pill, which reads faster than
 * an underline for people who are not used to software.
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
      <div className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/today" className="flex items-center gap-2.5" aria-label={`${studioName} home`}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={studioName}
              width={140}
              height={28}
              className="h-7 w-auto object-contain"
              unoptimized
            />
          ) : (
            <>
              {/* Placeholder mark — add a logo in Settings and it takes over. */}
              <span className="block size-3 rounded-full bg-accent" aria-hidden />
              <span className="text-lg font-extrabold tracking-tight">{studioName}</span>
            </>
          )}
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "block rounded-full px-5 py-2.5 font-semibold transition-colors",
                      active ? "bg-white text-ink" : "text-ink-muted hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {item.label}
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
      <nav aria-label="Primary" className="border-t border-ink-line px-2 pb-2 md:hidden">
        <ul className="grid grid-cols-4 gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-11 items-center justify-center rounded-full text-[0.9375rem] font-semibold transition-colors",
                    active ? "bg-white text-ink" : "text-ink-muted",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

/** Studio-local wall clock. Renders a placeholder until mounted so hydration matches. */
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
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [timezone]);

  return (
    <span className="timecode hidden text-ink-muted sm:block" suppressHydrationWarning>
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
        aria-label={`Account menu for ${user.name}`}
        className="flex size-11 items-center justify-center rounded-full bg-white/10 font-bold text-white transition-colors hover:bg-white/20"
      >
        {initials || "—"}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="rise absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-ink-line bg-ink-raised p-2 shadow-lift"
          >
            <div className="px-3 py-3">
              <p className="truncate font-semibold text-white">{user.name}</p>
              <p className="truncate text-[0.9375rem] text-ink-muted">{user.email}</p>
              <p className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-[0.8125rem] font-semibold capitalize text-white">
                {user.role}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-xl px-3 py-3 text-left font-semibold text-white transition-colors hover:bg-white/10"
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
