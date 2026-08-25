"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui";

const ITEMS = [
  { href: "/settings", label: "Studio" },
  { href: "/settings/sets", label: "Sets" },
  { href: "/settings/options", label: "Set options" },
  { href: "/settings/addons", label: "Add-ons" },
  { href: "/settings/clients", label: "Clients" },
  { href: "/settings/memberships", label: "Memberships" },
  { href: "/settings/rates", label: "Rates" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/team", label: "Team" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections">
      <ul className="flex gap-x-5 gap-y-2 overflow-x-auto border-b border-line pb-3 lg:flex-col lg:border-b-0 lg:border-l lg:pb-0">
        {ITEMS.map((item) => {
          const active =
            item.href === "/settings" ? pathname === "/settings" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "eyebrow block whitespace-nowrap transition-colors lg:-ml-px lg:border-l-2 lg:py-1.5 lg:pl-4",
                  active
                    ? "text-ink lg:border-accent"
                    : "text-muted hover:text-ink lg:border-transparent",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
