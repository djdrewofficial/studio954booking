-- Our technician and our equipment are always included in an external rental,
-- whether or not the client chooses to use them. They are not surcharges, so
-- the two modifier columns come out again — they were added in 0003 and never
-- carried a non-zero value.
--
-- `bookings.technician_provider` and `bookings.equipment_provider` stay. Who
-- actually runs the session and whose gear is in the room is something the
-- studio needs to know to set the room up; it just never changes the price.

--> statement-breakpoint
ALTER TABLE "studio_settings" DROP COLUMN IF EXISTS "our_technician_hourly_cents";
--> statement-breakpoint
ALTER TABLE "studio_settings" DROP COLUMN IF EXISTS "our_equipment_flat_cents";
