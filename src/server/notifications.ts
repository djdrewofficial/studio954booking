import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bookings, notificationLogs } from "@/db/schema";

/** The studio-wide send log, newest first. */
export async function recentNotifications(limit = 20) {
  return db
    .select({
      id: notificationLogs.id,
      kind: notificationLogs.kind,
      recipientEmail: notificationLogs.recipientEmail,
      status: notificationLogs.status,
      createdAt: notificationLogs.createdAt,
      bookingTitle: bookings.title,
    })
    .from(notificationLogs)
    .leftJoin(bookings, eq(bookings.id, notificationLogs.bookingId))
    .orderBy(desc(notificationLogs.createdAt))
    .limit(limit);
}
