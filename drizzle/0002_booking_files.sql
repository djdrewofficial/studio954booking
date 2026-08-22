-- Files attached to a booking. Today that means teleprompter scripts, which
-- clients upload ahead of time so the copy is already loaded when they walk
-- in; the `kind` column leaves room for reference images and the like without
-- another table.

--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "uses_teleprompter" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "booking_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL,
  "kind" text DEFAULT 'teleprompter_script' NOT NULL,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "content_type" text,
  "size_bytes" integer,
  "uploaded_by_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_files" ADD CONSTRAINT "booking_files_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "booking_files" ADD CONSTRAINT "booking_files_uploaded_by_id_users_id_fk"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "booking_files" ADD CONSTRAINT "booking_files_kind_check"
  CHECK ("kind" IN ('teleprompter_script', 'reference'));
--> statement-breakpoint
CREATE INDEX "booking_files_booking_id_idx" ON "booking_files" USING btree ("booking_id");
