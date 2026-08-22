import type { Metadata } from "next";
import Link from "next/link";

import { BookingForm } from "@/components/booking-form";
import { requireUser } from "@/lib/auth";
import { loadBookingCatalogue, newBookingDefaults } from "@/server/booking-form";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; duplicate?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();

  const [catalogue, defaults] = await Promise.all([
    loadBookingCatalogue(),
    newBookingDefaults(user, {
      date: params.date,
      time: params.time,
      duplicateOf: params.duplicate,
    }),
  ]);

  const duplicating = Boolean(params.duplicate);

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="eyebrow text-muted">
            {duplicating ? "Duplicate booking" : "New booking"}
          </p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">
            {duplicating ? "Same setup, new date." : "Book the studio."}
          </h1>
        </div>
        <Link
          href="/bookings"
          className="eyebrow text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Cancel
        </Link>
      </div>

      <BookingForm catalogue={catalogue} initialValues={defaults} />
    </div>
  );
}
