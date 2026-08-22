import "server-only";

import { BOOKING_TYPE_LABEL, type BookingType } from "@/lib/domain";
import { formatDayLong, formatTimeRange } from "@/lib/time";
import type { SetupLine } from "@/server/bookings";
import type { StudioSettings } from "@/server/settings";
import { formatStudioAddress } from "@/server/settings";

/**
 * Emails are built as plain strings rather than a component library: they need
 * to survive Outlook, and the templates are few enough that a helper or two is
 * cheaper than a rendering dependency.
 */

export type EmailBooking = {
  id: string;
  title: string;
  bookingType: string;
  startsAt: Date;
  endsAt: Date;
  organizerName: string;
  setName: string | null;
  notes: string | null;
  setup: SetupLine[];
};

const INK = "#0a0a0b";
const ACCENT = "#f92998";
const PAPER = "#faf9f6";
const LINE = "#e3e0d9";
const MUTED = "#6e6b64";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${LINE};width:34%;
                 font:600 11px/1 -apple-system,Segoe UI,Arial,sans-serif;
                 letter-spacing:.14em;text-transform:uppercase;color:${MUTED};
                 vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${LINE};
                 font:400 15px/1.45 -apple-system,Segoe UI,Arial,sans-serif;color:${INK};
                 vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`;
}

function shell(opts: {
  studioName: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  footer: string;
}): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(opts.headline)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<span style="display:none;font-size:1px;color:${PAPER};">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:560px;background:#ffffff;border:1px solid ${LINE};">

      <tr><td style="background:${INK};padding:18px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:3px;background:${ACCENT};height:16px;"></td>
          <td style="padding-left:10px;font:600 13px/1 -apple-system,Segoe UI,Arial,sans-serif;
                     letter-spacing:.2em;text-transform:uppercase;color:#ffffff;">
            ${escapeHtml(opts.studioName)}</td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:32px 28px 8px;">
        <div style="font:600 11px/1 -apple-system,Segoe UI,Arial,sans-serif;letter-spacing:.16em;
                    text-transform:uppercase;color:${MUTED};">${escapeHtml(opts.eyebrow)}</div>
        <h1 style="margin:14px 0 0;font:600 28px/1.1 -apple-system,Segoe UI,Arial,sans-serif;
                   letter-spacing:-.02em;color:${INK};">${escapeHtml(opts.headline)}</h1>
      </td></tr>

      <tr><td style="padding:20px 28px 0;">${opts.body}</td></tr>

      ${
        opts.ctaLabel && opts.ctaHref
          ? `<tr><td style="padding:28px 28px 0;">
               <a href="${opts.ctaHref}"
                  style="display:inline-block;background:${ACCENT};color:${INK};text-decoration:none;
                         padding:12px 20px;font:600 14px/1 -apple-system,Segoe UI,Arial,sans-serif;">
                 ${escapeHtml(opts.ctaLabel)}</a>
             </td></tr>`
          : ""
      }

      <tr><td style="padding:28px;">
        <p style="margin:0;font:400 13px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:${MUTED};">
          ${opts.footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function setupRows(booking: EmailBooking): string {
  if (!booking.setup.length) return "";
  return booking.setup
    .map((line) => row(line.categoryName, line.options.map((o) => o.name).join(" + ")))
    .join("");
}

function detailTable(booking: EmailBooking, settings: StudioSettings): string {
  const address = formatStudioAddress(settings);
  const typeLabel = BOOKING_TYPE_LABEL[booking.bookingType as BookingType] ?? "Session";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row("Date", formatDayLong(booking.startsAt, settings.timezone))}
    ${row("Time", formatTimeRange(booking.startsAt, booking.endsAt, settings.timezone))}
    ${row("Session", typeLabel)}
    ${booking.setName ? row("Set", booking.setName) : ""}
    ${setupRows(booking)}
    ${row("Organizer", booking.organizerName)}
    ${address ? row("Location", address) : ""}
  </table>`;
}

function plainDetails(booking: EmailBooking, settings: StudioSettings): string {
  const lines = [
    `Date: ${formatDayLong(booking.startsAt, settings.timezone)}`,
    `Time: ${formatTimeRange(booking.startsAt, booking.endsAt, settings.timezone)}`,
    booking.setName ? `Set: ${booking.setName}` : null,
    ...booking.setup.map((l) => `${l.categoryName}: ${l.options.map((o) => o.name).join(" + ")}`),
    `Organizer: ${booking.organizerName}`,
    formatStudioAddress(settings) ? `Location: ${formatStudioAddress(settings)}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/* ---------------------------------------------------------------------------
 * Templates
 * ------------------------------------------------------------------------ */

export function confirmationEmail(booking: EmailBooking, settings: StudioSettings) {
  const arrival = settings.arrivalInstructions
    ? `<p style="margin:24px 0 0;font:400 14px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:${INK};">
         ${escapeHtml(settings.arrivalInstructions)}</p>`
    : "";

  return {
    subject: `You're booked at ${settings.studioName}`,
    html: shell({
      studioName: settings.studioName,
      preheader: `${booking.title} — ${formatDayLong(booking.startsAt, settings.timezone)}`,
      eyebrow: "Booking confirmed",
      headline: booking.title,
      body: detailTable(booking, settings) + arrival,
      footer: `Questions? Reply to this email${
        settings.contactEmail ? ` or write to ${escapeHtml(settings.contactEmail)}` : ""
      }. The attached invitation adds this session to your calendar.`,
    }),
    text: [
      `You're booked at ${settings.studioName}`,
      "",
      booking.title,
      plainDetails(booking, settings),
      settings.arrivalInstructions ? `\n${settings.arrivalInstructions}` : "",
    ].join("\n"),
  };
}

export function reminderEmail(
  booking: EmailBooking,
  settings: StudioSettings,
  variant: "day_before" | "same_day",
) {
  const isDayBefore = variant === "day_before";
  return {
    subject: isDayBefore
      ? `Your ${settings.studioName} session is tomorrow`
      : `Your ${settings.studioName} session is today`,
    html: shell({
      studioName: settings.studioName,
      preheader: `${booking.title} — ${formatTimeRange(booking.startsAt, booking.endsAt, settings.timezone)}`,
      eyebrow: isDayBefore ? "Tomorrow" : "Today",
      headline: booking.title,
      body: detailTable(booking, settings),
      footer: settings.arrivalInstructions
        ? escapeHtml(settings.arrivalInstructions)
        : "See you at the studio.",
    }),
    text: [
      isDayBefore
        ? `Your ${settings.studioName} session is tomorrow`
        : `Your ${settings.studioName} session is today`,
      "",
      booking.title,
      plainDetails(booking, settings),
    ].join("\n"),
  };
}
