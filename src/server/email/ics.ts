import "server-only";

/**
 * A minimal iCalendar builder — enough for an "add to calendar" attachment,
 * without pulling in a library. Times are emitted as UTC instants so no
 * timezone definition needs to travel with the file.
 */

function stamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** RFC 5545 caps lines at 75 octets; continuations start with a single space. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    chunks.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(event: {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  organizer?: { name: string; email: string };
  attendees?: { name: string; email: string }[];
  cancelled?: boolean;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studio 954//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    fold(`SUMMARY:${escapeText(event.title)}`),
    event.description ? fold(`DESCRIPTION:${escapeText(event.description)}`) : null,
    event.location ? fold(`LOCATION:${escapeText(event.location)}`) : null,
    event.organizer
      ? fold(`ORGANIZER;CN=${escapeText(event.organizer.name)}:mailto:${event.organizer.email}`)
      : null,
    ...(event.attendees ?? []).map((a) =>
      fold(
        `ATTENDEE;CN=${escapeText(a.name)};RSVP=TRUE:mailto:${a.email}`,
      ),
    ),
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return `${lines.join("\r\n")}\r\n`;
}
