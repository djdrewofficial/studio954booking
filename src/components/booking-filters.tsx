"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cx } from "./ui";

const SCOPES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

const KINDS = [
  { value: "", label: "Everything" },
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
] as const;

/**
 * Search plus two filters. Anything more would be a reporting tool, and this
 * studio has one room.
 */
export function BookingFilters({
  scope,
  kind,
  search,
}: {
  scope: string;
  kind: string;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(search);
  const firstRender = useRef(true);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [query, params, pathname, router]);

  function hrefWith(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-y border-line py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterRow label="Show">
          {SCOPES.map((s) => (
            <FilterLink
              key={s.value}
              href={hrefWith("scope", s.value)}
              active={scope === s.value}
              label={s.label}
            />
          ))}
        </FilterRow>

        <FilterRow label="Type">
          {KINDS.map((k) => (
            <FilterLink
              key={k.value || "all"}
              href={hrefWith("kind", k.value)}
              active={kind === k.value}
              label={k.label}
            />
          ))}
        </FilterRow>
      </div>

      <label className="flex min-w-56 flex-1 items-center gap-2 sm:max-w-72">
        <span className="sr-only">Search bookings</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, client or organizer"
          className="h-9 w-full rounded-sm border border-line bg-white px-3 text-sm placeholder:text-muted/60 focus:border-ink focus:outline-none"
        />
      </label>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow text-line-strong">{label}</span>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={cx(
        "eyebrow border-b-2 pb-0.5 transition-colors",
        active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      {label}
    </a>
  );
}
