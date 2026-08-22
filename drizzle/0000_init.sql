CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_addons" (
	"booking_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_cents_at_booking" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "booking_addons_booking_id_addon_id_pk" PRIMARY KEY("booking_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "booking_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"notify" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_set_options" (
	"booking_id" uuid NOT NULL,
	"set_option_id" uuid NOT NULL,
	CONSTRAINT "booking_set_options_booking_id_set_option_id_pk" PRIMARY KEY("booking_id","set_option_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'internal' NOT NULL,
	"booking_type" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"client_name" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"setup_minutes" integer DEFAULT 30 NOT NULL,
	"reset_minutes" integer DEFAULT 30 NOT NULL,
	"studio_set_id" uuid,
	"organizer_name" text NOT NULL,
	"organizer_email" text NOT NULL,
	"organizer_phone" text,
	"notes" text,
	"internal_notes" text,
	"microphone_count" integer DEFAULT 0 NOT NULL,
	"recurrence_group_id" uuid,
	"google_event_id" text,
	"google_synced_at" timestamp with time zone,
	"created_by_id" uuid,
	"cancelled_at" timestamp with time zone,
	"blocked_start" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_end" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"calendar_id" text NOT NULL,
	"account_email" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"kind" text NOT NULL,
	"recipient_email" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_option_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"allows_multiple" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_option_sets" (
	"set_option_id" uuid NOT NULL,
	"studio_set_id" uuid NOT NULL,
	CONSTRAINT "set_option_sets_set_option_id_studio_set_id_pk" PRIMARY KEY("set_option_id","studio_set_id")
);
--> statement-breakpoint
CREATE TABLE "set_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"swatch_hex" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"studio_name" text DEFAULT 'Studio 954' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"contact_email" text,
	"logo_url" text,
	"arrival_instructions" text,
	"external_setup_minutes" integer DEFAULT 30 NOT NULL,
	"external_reset_minutes" integer DEFAULT 30 NOT NULL,
	"internal_setup_minutes" integer DEFAULT 15 NOT NULL,
	"internal_reset_minutes" integer DEFAULT 15 NOT NULL,
	"notify_confirmation" boolean DEFAULT true NOT NULL,
	"notify_reminder_24h" boolean DEFAULT true NOT NULL,
	"notify_reminder_same_day" boolean DEFAULT true NOT NULL,
	"same_day_reminder_lead_minutes" integer DEFAULT 120 NOT NULL,
	"notify_internal_team" boolean DEFAULT false NOT NULL,
	"internal_notification_email" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'team' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_set_options" ADD CONSTRAINT "booking_set_options_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_set_options" ADD CONSTRAINT "booking_set_options_set_option_id_set_options_id_fk" FOREIGN KEY ("set_option_id") REFERENCES "public"."set_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studio_set_id_studio_sets_id_fk" FOREIGN KEY ("studio_set_id") REFERENCES "public"."studio_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_option_sets" ADD CONSTRAINT "set_option_sets_set_option_id_set_options_id_fk" FOREIGN KEY ("set_option_id") REFERENCES "public"."set_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_option_sets" ADD CONSTRAINT "set_option_sets_studio_set_id_studio_sets_id_fk" FOREIGN KEY ("studio_set_id") REFERENCES "public"."studio_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_options" ADD CONSTRAINT "set_options_category_id_set_option_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."set_option_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_attendees_booking_id_idx" ON "booking_attendees" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_recurrence_group_idx" ON "bookings" USING btree ("recurrence_group_id");--> statement-breakpoint
CREATE INDEX "notification_logs_booking_id_idx" ON "notification_logs" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "notification_logs_kind_idx" ON "notification_logs" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "set_option_categories_slug_key" ON "set_option_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "set_options_category_id_idx" ON "set_options" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");