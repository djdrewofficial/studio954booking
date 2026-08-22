"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const missingDatabase = error.message.includes("DATABASE_URL");

  return (
    <div className="pt-20">
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
          "The error has been logged. Try again, and if it keeps happening the details are in the server console."
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
    </div>
  );
}
