"use client";

import { useEffect } from "react";

import { Button } from "./ui";

/**
 * Shared by the app-shell and root error boundaries. A missing database is by
 * far the most likely failure during setup, so it gets its own explanation
 * rather than a generic apology.
 */
export function ErrorScreen({
  error,
  reset,
  standalone = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Root boundary renders its own full-page frame; the app shell does not. */
  standalone?: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const missingDatabase = error.message.includes("DATABASE_URL");

  const body = (
    <>
      <p className="eyebrow text-muted">Something went wrong</p>
      <h1 className="display mt-4 max-w-2xl text-4xl sm:text-5xl">
        {missingDatabase
          ? "The studio database is not connected."
          : "That page could not be loaded."}
      </h1>

      <p className="mt-5 max-w-prose text-base leading-relaxed text-muted">
        {missingDatabase ? (
          <>
            Copy <code className="timecode text-sm text-ink">.env.example</code> to{" "}
            <code className="timecode text-sm text-ink">.env.local</code>, fill in{" "}
            <code className="timecode text-sm text-ink">DATABASE_URL</code>, then restart the
            server.
          </>
        ) : (
          "The error has been logged. Try again — if it keeps happening, the details are in the server console."
        )}
      </p>

      {error.digest ? (
        <p className="timecode mt-4 text-[0.8125rem] text-line-strong">Reference {error.digest}</p>
      ) : null}

      <div className="mt-8">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </>
  );

  if (!standalone) return <div className="pt-20">{body}</div>;

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-12 flex items-center gap-3">
          <span className="block h-5 w-1 bg-accent" aria-hidden />
          <span className="eyebrow-lg">Studio 954</span>
        </div>
        {body}
      </div>
    </main>
  );
}
