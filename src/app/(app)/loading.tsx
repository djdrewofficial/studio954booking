import { Skeleton } from "@/components/ui";

/**
 * Shared skeleton for the app shell. It mirrors the rundown rhythm — a heading,
 * a dark band, then ruled rows — so the page does not jump when data lands.
 */
export default function Loading() {
  return (
    <div className="pt-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-5 h-12 w-80 max-w-full" />

      <div className="mt-8 grid gap-px bg-line md:grid-cols-[1.6fr_1fr]">
        <div className="bg-paper-sunk px-6 py-7 sm:px-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-5 h-10 w-64 max-w-full" />
          <Skeleton className="mt-4 h-3 w-48" />
        </div>
        <div className="bg-paper-sunk px-6 py-7 sm:px-8">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-5 h-7 w-40" />
          <Skeleton className="mt-4 h-3 w-28" />
        </div>
      </div>

      <div className="mt-12">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="grid grid-cols-[76px_1fr] gap-x-4 border-t border-line py-6 sm:grid-cols-[132px_1fr] sm:gap-x-8"
          >
            <div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="mt-2 h-3 w-14" />
            </div>
            <div>
              <Skeleton className="h-7 w-56 max-w-full" />
              <Skeleton className="mt-3 h-3 w-40" />
              <div className="mt-5 flex flex-wrap gap-6">
                {[0, 1, 2, 3].map((chip) => (
                  <div key={chip}>
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="mt-2 h-3.5 w-20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
