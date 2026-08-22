import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingForm } from "@/components/booking-form";
import { requireUser } from "@/lib/auth";
import { bookingToFormValues, loadBookingCatalogue } from "@/server/booking-form";

export const metadata: Metadata = { title: "Edit booking" };

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const [catalogue, values] = await Promise.all([
    loadBookingCatalogue(),
    bookingToFormValues(id),
  ]);

  if (!values) notFound();

  return (
    <div className="pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="eyebrow text-muted">Edit booking</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{values.title}</h1>
        </div>
        <Link
          href={`/bookings/${id}`}
          className="eyebrow text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Cancel
        </Link>
      </div>

      <BookingForm catalogue={catalogue} initialValues={values} bookingId={id} />
    </div>
  );
}
