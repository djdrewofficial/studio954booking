# Studio 954 Booking

Internal booking and studio management for **Studio 954** — one production room,
one schedule. The app answers four questions fast: what is happening today, what
needs setting up next, how the room has to look, and who is coming.

Eventually served from `booking.studio954.com`.

---

## Stack

| Layer      | Choice                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + React 19 + TypeScript                        |
| Styling    | Tailwind v4, design tokens in `src/app/globals.css`                    |
| Database   | Postgres (Supabase), accessed server-side with Drizzle ORM             |
| Auth       | Session cookies in Postgres, bcrypt passwords, `admin` / `team` roles  |
| Validation | Zod schemas shared by the client form and the server action            |
| Email      | Resend, behind a `Mailer` interface so the provider is swappable       |
| Calendar   | Google Calendar, behind a layer that no-ops until credentials exist    |

There is no client-side database access and no RLS: every query runs on the
server behind an authenticated session.

---

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL
npm run db:migrate
npm run db:seed              # optional, realistic sample sessions
npm run dev
```

Open `http://localhost:3000`. The first visit shows a **first-run screen** that
creates the studio's admin account — no password is ever committed to the repo
or printed to a console.

### Getting `DATABASE_URL`

Supabase → your project → **Project Settings → Database → Connection string →
URI**. Use the **pooler** string (port `6543`) and replace `[YOUR-PASSWORD]`
with the database password.

---

## Scripts

| Command               | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `npm run dev`         | Development server                                                   |
| `npm run build`       | Production build                                                     |
| `npm run typecheck`   | `tsc --noEmit`                                                       |
| `npm run lint`        | ESLint                                                               |
| `npm run db:generate` | Regenerate SQL from `src/db/schema.ts` after a schema change         |
| `npm run db:migrate`  | Apply pending migrations (tracked, idempotent, never destructive)    |
| `npm run db:seed`     | Load sample sets, options, add-ons and sessions                      |

---

## How the room is protected from double booking

A booking occupies more than its session: it also holds the room for its setup
and reset buffers. That full window lives in `blocked_start` / `blocked_end`,
maintained by a database trigger, and is guarded by a Postgres exclusion
constraint:

```sql
EXCLUDE USING gist (tstzrange(blocked_start, blocked_end, '[)') WITH &&)
  WHERE (status <> 'cancelled')
```

So a session ending at 15:00 with a 30-minute reset genuinely blocks 15:00–15:30,
and the next booking may start at 15:30 but not at 15:00. Two simultaneous
requests cannot both win — the database refuses the second one.

The booking form also checks availability live, and the server re-checks before
writing, but the constraint is what makes the guarantee real.

---

## Project layout

```
src/
  app/
    (app)/            Authenticated shell — today, calendar, bookings, prep, settings
    login/            Sign-in and first-run admin creation
    api/cron/         Reminder dispatcher
  components/
    booking-form/     The stepped create/edit flow
    calendar/         Day/week time grid and month grid
    settings/         Shared settings form plumbing
  db/                 Drizzle schema and the lazy client
  lib/                Pure helpers — time, schedule, calendar maths, domain vocabulary, validation
  server/             Data access, server actions, email and Google Calendar
drizzle/              SQL migrations and seed data
```

`lib/` is pure and importable anywhere. `server/` is server-only and holds
every query and side effect.

---

## Timezone

Every timestamp is stored as an absolute instant (`timestamptz`) and rendered in
the studio's own timezone, set under **Settings → Studio**. Nothing in the UI
calls `toLocaleString` directly, so the iPad in the studio and a laptop
elsewhere always show the same clock time.

---

## Email

Confirmation and reminder emails run through `src/server/email/`. Until
`RESEND_API_KEY` and `EMAIL_FROM` are set, messages are **logged rather than
sent** — the notification log still records them as `skipped`, so the whole flow
can be exercised in development. Confirmations carry an `.ics` attachment, which
is how attendees get a calendar invitation in any calendar app.

### Reminders

`GET /api/cron/reminders` sends the day-before and same-day reminders. Point a
scheduler at it every 15–30 minutes:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://booking.studio954.com/api/cron/reminders
```

The windows are wider than the schedule interval and each send is guarded by the
notification log, so a missed run catches up and nobody is emailed twice.

---

## Google Calendar

Bookings mirror to a dedicated studio calendar, with the set, the exact room
setup and the setup/reset windows in the event description. Configure it under
**Settings → Calendar**, which also lists exactly which variables are missing.

The recommended setup is a **service account** shared onto the calendar with
"Make changes to events". Service accounts cannot invite Google attendees
without domain-wide delegation, which is why attendee invitations travel as the
`.ics` attachment instead.

Reading events created directly on the studio calendar — so they block
availability — is implemented in `fetchExternalBusyWindows` and stays dormant
until credentials are present.

---

## Roles

- **Admin** — everything, including settings, sets, options, add-ons and people.
- **Team** — calendar, bookings, status changes and prep sheets. Settings are
  visible but read-only.

---

## Not built yet

Phase 3 is deliberately unstarted: customer-facing self-service rentals and
Stripe payments. The schema already carries `addons`, `booking_addons` and the
internal/external split, and add-ons are manageable in Settings, so that work
does not require a migration of existing data.
