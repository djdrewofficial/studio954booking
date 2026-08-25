"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteBookingAction,
  sendConfirmationAction,
  setStatusAction,
} from "@/server/actions/bookings";

import { Modal } from "./modal";
import { useToast } from "./toast";
import { Button, buttonClass } from "./ui";

/**
 * The row of things you can do to a booking. Destructive choices always ask
 * first, and a recurring booking makes you say whether you mean this session
 * or the whole run.
 */
export function BookingActions({
  bookingId,
  isCancelled,
  isRecurring,
  emailConfigured,
  canDelete,
}: {
  bookingId: string;
  isCancelled: boolean;
  isRecurring: boolean;
  emailConfigured: boolean;
  /**
   * Staff run sessions but do not remove them. The server enforces this too —
   * hiding a button is a courtesy, never the guard.
   */
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast, error } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  function remove(scope: "one" | "series") {
    startTransition(async () => {
      const result = await deleteBookingAction(bookingId, scope);
      if (result.ok) {
        toast(scope === "series" ? "Series deleted" : "Booking deleted");
        router.push("/bookings");
        router.refresh();
      } else {
        error(result.message);
      }
      setConfirmDelete(false);
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await setStatusAction(bookingId, "cancelled");
      if (result.ok) {
        toast("Booking cancelled");
        router.refresh();
      } else {
        error(result.message);
      }
      setConfirmCancel(false);
    });
  }

  function resend() {
    startTransition(async () => {
      const result = await sendConfirmationAction(bookingId);
      if (result.ok) toast("Confirmation sent");
      else error(result.message);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" data-print="hide">
        <Link href={`/bookings/${bookingId}/edit`} className={buttonClass("secondary")}>
          Edit
        </Link>
        <Link
          href={`/bookings/new?duplicate=${bookingId}`}
          className={buttonClass("secondary")}
        >
          Duplicate
        </Link>
        {emailConfigured ? (
          <Button variant="ghost" disabled={pending} onClick={resend}>
            Send confirmation
          </Button>
        ) : null}
        {canDelete && !isCancelled ? (
          <Button variant="ghost" disabled={pending} onClick={() => setConfirmCancel(true)}>
            Cancel booking
          </Button>
        ) : null}
        {canDelete ? (
          <Button variant="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        ) : null}
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this booking?"
        description="The session stays on record but releases its hold on the studio, so the time becomes bookable again."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={pending} onClick={cancel}>
            {pending ? "Cancelling…" : "Cancel booking"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this booking?"
        description={
          isRecurring
            ? "This booking repeats. Choose whether to remove only this session or every session from here onwards. Deleting cannot be undone."
            : "This removes the booking, its attendees and its studio setup for good. Deleting cannot be undone."
        }
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          {isRecurring ? (
            <Button variant="danger" disabled={pending} onClick={() => remove("series")}>
              Delete this and later
            </Button>
          ) : null}
          <Button variant="danger" disabled={pending} onClick={() => remove("one")}>
            {pending ? "Deleting…" : "Delete this session"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
