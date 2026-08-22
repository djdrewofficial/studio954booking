"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BOOKING_STATUSES, BOOKING_STATUS_LABEL, NEXT_STATUS_ACTION } from "@/lib/domain";
import type { BookingStatus } from "@/lib/domain";
import { setStatusAction } from "@/server/actions/bookings";

import { useToast } from "./toast";
import { Button, Select, cx } from "./ui";

/**
 * The logical next move, as a single button. Running a session should never
 * mean hunting through a dropdown — though one is offered alongside for the
 * times when the room skips a step.
 */
export function StatusAction({
  bookingId,
  status,
  showOverride = false,
  size = "sm",
  className,
}: {
  bookingId: string;
  status: BookingStatus;
  showOverride?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const { toast, error } = useToast();
  const [pending, startTransition] = useTransition();
  // Optimistic: the button flips the moment it is pressed.
  const [optimistic, setOptimistic] = useState<BookingStatus | null>(null);

  const current = optimistic ?? status;
  const next = NEXT_STATUS_ACTION[current];

  function apply(target: BookingStatus, label: string) {
    setOptimistic(target);
    startTransition(async () => {
      const result = await setStatusAction(bookingId, target);
      if (result.ok) {
        toast(label);
        router.refresh();
      } else {
        setOptimistic(null);
        error(result.message);
      }
    });
  }

  if (current === "cancelled") {
    return <span className="eyebrow text-muted">Cancelled</span>;
  }

  return (
    <div className={cx("flex items-center gap-2", className)}>
      {showOverride ? (
        <Select
          aria-label="Change status"
          value={current}
          disabled={pending}
          onChange={(e) => {
            const target = e.target.value as BookingStatus;
            apply(target, `Status set to ${BOOKING_STATUS_LABEL[target]}`);
          }}
          className="h-8 w-auto text-[0.8125rem]"
        >
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      ) : null}

      {next ? (
        <Button
          variant="primary"
          size={size}
          disabled={pending}
          onClick={() => apply(next.next, `${next.label} · done`)}
        >
          {pending ? "Saving…" : next.label}
        </Button>
      ) : current === "complete" ? (
        <span className="eyebrow text-muted">Complete</span>
      ) : null}
    </div>
  );
}
