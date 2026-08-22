import type { BookingStatus } from "./domain";

/**
 * Pure schedule reasoning, shared by the server render and the client tick so
 * both always agree about what is happening in the room right now.
 */

export type SetupOption = {
  name: string;
  swatchHex: string | null;
  imageUrl: string | null;
};

export type SetupGroup = {
  categoryName: string;
  categorySlug: string;
  options: SetupOption[];
};

export type SessionView = {
  id: string;
  title: string;
  kind: string;
  bookingType: string;
  status: BookingStatus;
  clientName: string | null;
  startsAt: Date;
  endsAt: Date;
  setupMinutes: number;
  resetMinutes: number;
  blockedStart: Date;
  blockedEnd: Date;
  setName: string | null;
  attendeeCount: number;
  microphoneCount: number;
  notes: string | null;
  setup: SetupGroup[];
};

export type RoomState =
  | { phase: "live"; session: SessionView; minutesRemaining: number }
  | { phase: "setup"; session: SessionView; minutesUntilStart: number }
  | { phase: "reset"; session: SessionView; minutesRemaining: number }
  | { phase: "clear" };

/** What the room is doing at this instant. */
export function roomStateAt(sessions: SessionView[], now: Date): RoomState {
  const live = sessions.find(
    (s) => s.status !== "cancelled" && now >= s.startsAt && now < s.endsAt,
  );
  if (live) {
    return { phase: "live", session: live, minutesRemaining: minutesBetween(now, live.endsAt) };
  }

  const settingUp = sessions.find(
    (s) => s.status !== "cancelled" && now >= s.blockedStart && now < s.startsAt,
  );
  if (settingUp) {
    return {
      phase: "setup",
      session: settingUp,
      minutesUntilStart: minutesBetween(now, settingUp.startsAt),
    };
  }

  const resetting = sessions.find(
    (s) => s.status !== "cancelled" && now >= s.endsAt && now < s.blockedEnd,
  );
  if (resetting) {
    return {
      phase: "reset",
      session: resetting,
      minutesRemaining: minutesBetween(now, resetting.blockedEnd),
    };
  }

  return { phase: "clear" };
}

/**
 * The next session that has not started yet — excluding whichever session the
 * room is already working on, so "setting up for X" is never followed by
 * "next: X".
 */
export function nextSession(
  sessions: SessionView[],
  now: Date,
  exclude?: SessionView | null,
): SessionView | null {
  return (
    sessions.find(
      (s) => s.status !== "cancelled" && s.startsAt > now && s.id !== exclude?.id,
    ) ?? null
  );
}

/** How long the room stays free before the next hold begins. */
export function freeUntil(sessions: SessionView[], now: Date): Date | null {
  const upcoming = sessions
    .filter((s) => s.status !== "cancelled" && s.blockedStart > now)
    .sort((a, b) => a.blockedStart.getTime() - b.blockedStart.getTime());
  return upcoming[0]?.blockedStart ?? null;
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

/** "in 45 min" / "in 2 hr 10 min" / "now" */
export function relativeLead(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `in ${hrs} hr` : `in ${hrs} hr ${mins} min`;
}

export function isPast(session: SessionView, now: Date): boolean {
  return session.blockedEnd <= now;
}
