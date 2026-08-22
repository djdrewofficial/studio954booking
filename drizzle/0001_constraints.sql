-- Studio 954: integrity rules that Drizzle's schema DSL cannot express.
--
-- The headline rule is `bookings_no_overlap`: the studio is one physical room,
-- so no two live bookings may claim overlapping time *including* their setup
-- and reset buffers. This is enforced by Postgres itself, which means a race
-- between two simultaneous requests cannot produce a double booking.

--> statement-breakpoint
ALTER TABLE "studio_settings" ADD CONSTRAINT "studio_settings_singleton" CHECK ("id" = 1);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('admin', 'team'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_kind_check" CHECK ("kind" IN ('internal', 'external'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_type_check" CHECK ("booking_type" IN (
  'podcast', 'interview', 'social_content', 'photoshoot', 'product_shoot', 'livestream', 'other'
));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check" CHECK ("status" IN (
  'upcoming', 'setting_up', 'ready', 'checked_in', 'in_session',
  'finished', 'resetting', 'complete', 'cancelled'
));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_order_check" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_buffer_check" CHECK (
  "setup_minutes" >= 0 AND "setup_minutes" <= 480
  AND "reset_minutes" >= 0 AND "reset_minutes" <= 480
);
--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_status_check"
  CHECK ("status" IN ('sent', 'failed', 'skipped'));

-- blocked_start / blocked_end hold the full window the studio is occupied,
-- buffers included. They are maintained by a trigger rather than a GENERATED
-- column because timestamptz interval maths is only STABLE, and generated
-- columns require IMMUTABLE expressions.
--> statement-breakpoint
CREATE OR REPLACE FUNCTION studio954_set_blocked_window() RETURNS trigger AS $$
BEGIN
  NEW.blocked_start := NEW.starts_at - make_interval(mins => NEW.setup_minutes);
  NEW.blocked_end   := NEW.ends_at   + make_interval(mins => NEW.reset_minutes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER bookings_blocked_window
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, setup_minutes, reset_minutes
  ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION studio954_set_blocked_window();

-- One room, one booking at a time. Cancelled bookings release their slot.
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (tstzrange("blocked_start", "blocked_end", '[)') WITH &&)
  WHERE ("status" <> 'cancelled');
