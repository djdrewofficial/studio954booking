-- Clients, memberships and money.
--
-- Three things arrive together because they depend on each other:
--
--   1. `clients` — the keystone. Until now a booking carried a free-text
--      client name, which is fine for a schedule but cannot own a membership
--      or a balance. Every recurring relationship hangs off this table.
--
--   2. Memberships — a plan is a list of *entitlement lines*, each either a
--      pool of studio time or a count of a particular appointment type. That
--      lets one plan read "10 studio hours + 3 podcasts + 2 content days"
--      without a schema change per plan shape.
--
--      Allowances refill monthly and do not roll over, so there is no balance
--      ledger: usage is derived by counting the bookings already attached to
--      a membership inside the current period. Cancelling a booking hands the
--      allowance straight back, with nothing to reconcile.
--
--   3. Rates — what an external client pays. Base and hourly live per
--      appointment type; supplying our technician or our equipment adds a
--      configurable amount on top.

--> statement-breakpoint
CREATE TABLE "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "contact_name" text,
  "email" text,
  "phone" text,
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");
--> statement-breakpoint

CREATE TABLE "membership_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price_cents" integer DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- One line of what a plan includes. `amount` is minutes when the line is
-- studio time and a plain count when it is appointments.
CREATE TABLE "membership_plan_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL,
  "entitlement_kind" text NOT NULL,
  "booking_type" text,
  "amount" integer NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_plan_entitlements" ADD CONSTRAINT "membership_plan_entitlements_plan_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "membership_plan_entitlements" ADD CONSTRAINT "membership_plan_entitlements_kind_check"
  CHECK ("entitlement_kind" IN ('studio_hours', 'appointment_count'));
--> statement-breakpoint
-- A pool of studio time is never tied to one appointment type. An appointment
-- line with a NULL type means "any type".
ALTER TABLE "membership_plan_entitlements" ADD CONSTRAINT "membership_plan_entitlements_type_check"
  CHECK ("entitlement_kind" <> 'studio_hours' OR "booking_type" IS NULL);
--> statement-breakpoint
ALTER TABLE "membership_plan_entitlements" ADD CONSTRAINT "membership_plan_entitlements_amount_check"
  CHECK ("amount" > 0);
--> statement-breakpoint
CREATE INDEX "membership_plan_entitlements_plan_id_idx"
  ON "membership_plan_entitlements" USING btree ("plan_id");
--> statement-breakpoint

-- A client's subscription. `started_on` is also the billing anchor: the day of
-- the month the allowance refills.
CREATE TABLE "client_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "started_on" date NOT NULL,
  "ended_on" date,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_client_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_plan_id_fk"
  FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_status_check"
  CHECK ("status" IN ('active', 'paused', 'cancelled'));
--> statement-breakpoint
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_date_order_check"
  CHECK ("ended_on" IS NULL OR "ended_on" >= "started_on");
--> statement-breakpoint
CREATE INDEX "client_memberships_client_id_idx" ON "client_memberships" USING btree ("client_id");
--> statement-breakpoint
-- A client may hold only one live membership at a time.
CREATE UNIQUE INDEX "client_memberships_one_active_idx"
  ON "client_memberships" ("client_id") WHERE "status" = 'active';
--> statement-breakpoint

-- What an external booking costs, before add-ons.
CREATE TABLE "booking_type_rates" (
  "booking_type" text PRIMARY KEY NOT NULL,
  "base_cents" integer DEFAULT 0 NOT NULL,
  "hourly_cents" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_type_rates" ADD CONSTRAINT "booking_type_rates_type_check"
  CHECK ("booking_type" IN (
    'podcast', 'interview', 'social_content', 'content_day',
    'photoshoot', 'product_shoot', 'livestream', 'other'));
--> statement-breakpoint
INSERT INTO "booking_type_rates" ("booking_type") VALUES
  ('podcast'), ('interview'), ('social_content'), ('content_day'),
  ('photoshoot'), ('product_shoot'), ('livestream'), ('other')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Charges for supplying our own people and gear.
ALTER TABLE "studio_settings"
  ADD COLUMN "our_technician_hourly_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "studio_settings"
  ADD COLUMN "our_equipment_flat_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Bookings gain a real client, the membership they draw from, who is bringing
-- the crew and the gear, and what the whole thing costs.
ALTER TABLE "bookings" ADD COLUMN "client_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "client_membership_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "technician_provider" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "equipment_provider" text DEFAULT 'studio' NOT NULL;
--> statement-breakpoint
-- Captured at booking time, like booking_addons.price_cents_at_booking, so
-- editing the rate card never rewrites what someone was already quoted.
ALTER TABLE "bookings" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Set when someone types a price by hand; stops the rate card overwriting it.
ALTER TABLE "bookings" ADD COLUMN "price_manual" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_membership_id_fk"
  FOREIGN KEY ("client_membership_id") REFERENCES "public"."client_memberships"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_provider_check"
  CHECK ("technician_provider" IN ('studio', 'client', 'none'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_equipment_provider_check"
  CHECK ("equipment_provider" IN ('studio', 'client'));
--> statement-breakpoint
CREATE INDEX "bookings_client_id_idx" ON "bookings" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "bookings_client_membership_idx" ON "bookings" USING btree ("client_membership_id");
--> statement-breakpoint

-- Membership joins internal and external as a third kind of booking.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_kind_check";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_kind_check"
  CHECK ("kind" IN ('internal', 'membership', 'external'));
--> statement-breakpoint
-- A membership booking must say which membership it draws from.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_membership_link_check"
  CHECK ("kind" <> 'membership' OR "client_membership_id" IS NOT NULL);
--> statement-breakpoint

-- "Content day" is a distinct product from a one-off social clip.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_type_check";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_type_check"
  CHECK ("booking_type" IN (
    'podcast', 'interview', 'social_content', 'content_day',
    'photoshoot', 'product_shoot', 'livestream', 'other'));
