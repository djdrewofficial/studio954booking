-- Three roles instead of two.
--
-- "team" carried every ability except changing settings, which left no way to
-- say "this person runs the room but does not touch clients or pricing".
--
--   admin   — everything, including studio configuration and the team itself
--   manager — bookings, clients, memberships and rates; not studio config
--   staff   — the schedule, running sessions and prep sheets
--
-- Existing "team" members become managers rather than staff. They can already
-- delete bookings and the migration must not quietly take that away; narrowing
-- someone to staff should be a deliberate act on the Team screen.

--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";
--> statement-breakpoint
UPDATE "users" SET "role" = 'manager' WHERE "role" = 'team';
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check"
  CHECK ("role" IN ('admin', 'manager', 'staff'));
