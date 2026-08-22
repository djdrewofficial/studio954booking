import Link from "next/link";

import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-ink px-6 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="block h-5 w-1 bg-accent" aria-hidden />
          <span className="eyebrow-lg">Studio 954</span>
        </div>

        <h1 className="display mt-10 text-5xl sm:text-7xl">Nothing scheduled here.</h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">
          That page does not exist, or the booking has been removed.
        </p>

        <div className="mt-10 flex gap-3">
          <Link href="/today" className={buttonClass("primary")}>
            Go to Today
          </Link>
          <Link
            href="/calendar"
            className="inline-flex h-10 items-center rounded-sm border border-ink-line px-4 text-sm font-semibold transition-colors hover:border-white/40"
          >
            Open the calendar
          </Link>
        </div>
      </div>
    </main>
  );
}
