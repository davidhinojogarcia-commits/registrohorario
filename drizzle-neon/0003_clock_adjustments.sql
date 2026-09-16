CREATE TABLE IF NOT EXISTS "clock_adjustments" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "worker_id" text NOT NULL,
  "worksite_id" text NOT NULL,
  "original_event_id" text,
  "event_type" text NOT NULL,
  "effective_at" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "adjustment_type" text NOT NULL,
  "created_by_supervisor_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_original_event_id_clock_events_id_fk" FOREIGN KEY ("original_event_id") REFERENCES "public"."clock_events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clock_adjustments" ADD CONSTRAINT "clock_adjustments_created_by_supervisor_id_supervisors_id_fk" FOREIGN KEY ("created_by_supervisor_id") REFERENCES "public"."supervisors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clock_adjustments_worker_date_idx" ON "clock_adjustments" USING btree ("worker_id","effective_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clock_adjustments_company_idx" ON "clock_adjustments" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clock_adjustments_original_event_idx" ON "clock_adjustments" USING btree ("original_event_id");
