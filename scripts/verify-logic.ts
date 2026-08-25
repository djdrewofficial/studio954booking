/**
 * Checks the pure booking maths — allowance periods, membership drawdown and
 * pricing — none of which typecheck can vouch for. Run with `npm run verify`.
 */
import { periodFor, allowanceFor, coversDraw, describeRemaining, type Entitlement } from "../src/lib/membership";
import { quoteFor, parseMoneyToCents, formatMoney } from "../src/lib/pricing";
import {
  canManageSettings,
  canManageTeam,
  canManageClients,
  canManageBookings,
  canDeleteBookings,
  USER_ROLES,
} from "../src/lib/domain";

const TZ = "America/New_York";
let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n          got  ${g}\n          want ${w}`); }
};
const d = (iso: string) => new Date(iso);
const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });

console.log("\n— period maths —");
eq("mid-period: anchor 15th, on the 20th",
   (() => { const p = periodFor("2026-01-15", d("2026-03-20T12:00:00Z"), TZ); return [day(p.start), day(p.end)]; })(),
   ["2026-03-15", "2026-04-15"]);
eq("before the refill day rolls back a month",
   (() => { const p = periodFor("2026-01-15", d("2026-03-10T12:00:00Z"), TZ); return [day(p.start), day(p.end)]; })(),
   ["2026-02-15", "2026-03-15"]);
eq("anchor 31st clamps into February",
   (() => { const p = periodFor("2026-01-31", d("2026-02-15T12:00:00Z"), TZ); return [day(p.start), day(p.end)]; })(),
   ["2026-01-31", "2026-02-28"]);
eq("anchor 31st: the period starting in Feb ends Mar 31",
   (() => { const p = periodFor("2026-01-31", d("2026-03-05T12:00:00Z"), TZ); return [day(p.start), day(p.end)]; })(),
   ["2026-02-28", "2026-03-31"]);
// A driver parses a date column to UTC midnight; reading that day in the
// studio's timezone would shift it back one day.
eq("a UTC-midnight Date anchor matches the string form",
   (() => { const p = periodFor(new Date("2026-01-15T00:00:00Z"), d("2026-03-20T12:00:00Z"), TZ); return [day(p.start), day(p.end)]; })(),
   ["2026-03-15", "2026-04-15"]);
eq("Date and string anchors agree",
   (() => {
     const a = periodFor("2026-08-05", d("2026-08-22T12:00:00Z"), TZ);
     const b = periodFor(new Date("2026-08-05T00:00:00Z"), d("2026-08-22T12:00:00Z"), TZ);
     return [day(a.start) === day(b.start), day(a.start)];
   })(),
   [true, "2026-08-05"]);
eq("December period crosses the year boundary",
   (() => { const p = periodFor("2025-06-10", d("2025-12-20T12:00:00Z"), TZ); return [day(p.start), day(p.end)]; })(),
   ["2025-12-10", "2026-01-10"]);

console.log("\n— allowances: 3 podcasts + 2 any + 10 studio hours —");
const plan: Entitlement[] = [
  { entitlementKind: "appointment_count", bookingType: "podcast", amount: 3 },
  { entitlementKind: "appointment_count", bookingType: null, amount: 2 },
  { entitlementKind: "studio_hours", bookingType: null, amount: 600 },
];
const pod = (n: number) => Array.from({length:n},()=>({bookingType:"podcast" as const, minutes:60}));

eq("fresh plan: nothing used",
   allowanceFor(plan, []).map(l => [l.label, l.used, l.remaining, l.over]),
   [["Podcast",0,3,0],["Any appointment",0,2,0],["Studio time",0,600,0]]);
eq("2 podcasts draw the podcast line only",
   allowanceFor(plan, pod(2)).map(l => [l.label, l.used, l.remaining, l.over]),
   [["Podcast",2,1,0],["Any appointment",0,2,0],["Studio time",120,480,0]]);
eq("4th podcast spills onto the 'any' line",
   allowanceFor(plan, pod(4)).map(l => [l.label, l.used, l.remaining, l.over]),
   [["Podcast",3,0,0],["Any appointment",1,1,0],["Studio time",240,360,0]]);
eq("6 podcasts: one past everything, reported as overage",
   allowanceFor(plan, pod(6)).map(l => [l.label, l.used, l.remaining, l.over]),
   [["Podcast",3,0,0],["Any appointment",2,0,1],["Studio time",360,240,0]]);
eq("an unnamed type goes straight to the 'any' line",
   allowanceFor(plan, [{bookingType:"photoshoot", minutes:60}]).map(l => [l.label, l.used, l.remaining]),
   [["Podcast",0,3],["Any appointment",1,1],["Studio time",60,540]]);
eq("a long session can exhaust hours while sessions remain",
   allowanceFor(plan, [{bookingType:"podcast", minutes:660}]).map(l => [l.label, l.used, l.remaining, l.over]),
   [["Podcast",1,2,0],["Any appointment",0,2,0],["Studio time",600,0,60]]);

console.log("\n— coversDraw —");
eq("covered on a fresh plan", coversDraw(plan, [], {bookingType:"podcast", minutes:60}).covered, true);
eq("still covered at the spillover boundary", coversDraw(plan, pod(4), {bookingType:"podcast", minutes:60}).covered, true);
eq("refused once sessions run out", coversDraw(plan, pod(5), {bookingType:"podcast", minutes:60}).covered, false);
eq("refused when it would blow the hours", coversDraw(plan, [], {bookingType:"podcast", minutes:660}).covered, false);
eq("empty plan covers nothing", coversDraw([], [], {bookingType:"podcast", minutes:60}).covered, false);

console.log("\n— pricing —");
const rate = { bookingType: "podcast" as const, baseCents: 15000, hourlyCents: 5000 };
eq("internal is never billable",
   quoteFor({kind:"internal",bookingType:"podcast",minutes:120}, rate).billable, false);
eq("membership is never billable",
   quoteFor({kind:"membership",bookingType:"podcast",minutes:120}, rate).billable, false);
eq("external: base plus hourly",
   (() => { const q = quoteFor({kind:"external",bookingType:"podcast",minutes:120}, rate); return [q.lines.map(l=>[l.label,l.cents]), q.totalCents]; })(),
   [[["Session",15000],["Studio time",10000]], 25000]);
eq("add-ons ride along",
   quoteFor({kind:"external",bookingType:"podcast",minutes:60,addonCents:2500}, rate).totalCents, 22500);
eq("half hours are handled",
   quoteFor({kind:"external",bookingType:"podcast",minutes:90}, rate).totalCents, 22500);
eq("a type with no rate row still quotes",
   quoteFor({kind:"external",bookingType:"other",minutes:60}, undefined).totalCents, 0);
// Our crew and gear are included in a rental either way, so the ours/theirs
// choice on a booking must never move the price.
eq("crew and gear never appear as a surcharge",
   quoteFor({kind:"external",bookingType:"podcast",minutes:120}, rate).lines.some(l => /technician|equipment/i.test(l.label)),
   false);

console.log("\n— how a line reads —");
eq("appointments remaining", describeRemaining(allowanceFor(plan, pod(2))[0]), "1 of 3 left");
eq("appointments exhausted", describeRemaining(allowanceFor(plan, pod(3))[0]), "0 of 3 left");
eq("appointment overage", describeRemaining(allowanceFor(plan, pod(6))[1]), "1 over 2");
eq("studio time remaining", describeRemaining(allowanceFor(plan, pod(3))[2]), "7 hr of 10 hr left");
eq("studio time overage", describeRemaining(allowanceFor(plan, [{bookingType:"podcast", minutes:660}])[2]), "1 hr over 10 hr");

console.log("\n— who may do what —");
const grid = (fn: (r: typeof USER_ROLES[number]) => boolean) => USER_ROLES.map((r) => `${r}:${fn(r) ? "y" : "n"}`).join(" ");
eq("studio settings are admin only", grid(canManageSettings), "admin:y manager:n staff:n");
eq("the team is admin only", grid(canManageTeam), "admin:y manager:n staff:n");
eq("clients, memberships and rates reach manager", grid(canManageClients), "admin:y manager:y staff:n");
eq("everyone can take a booking", grid(canManageBookings), "admin:y manager:y staff:y");
eq("staff cannot delete or cancel", grid(canDeleteBookings), "admin:y manager:y staff:n");

console.log("\n— money parsing —");
eq("plain", parseMoneyToCents("1250"), 125000);
eq("with symbols", parseMoneyToCents("$1,250.00"), 125000);
eq("cents", parseMoneyToCents("99.99"), 9999);
eq("empty is zero", parseMoneyToCents(""), 0);
eq("rubbish is rejected", parseMoneyToCents("abc"), null);
eq("too many decimals rejected", parseMoneyToCents("1.234"), null);
eq("format whole dollars", formatMoney(125000), "$1,250");
eq("format with cents", formatMoney(9999), "$99.99");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
