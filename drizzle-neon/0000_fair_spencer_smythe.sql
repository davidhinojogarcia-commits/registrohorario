CREATE TABLE "activation_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"worksite_id" text NOT NULL,
	"starts_on" text NOT NULL,
	"ends_on" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"detail" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clock_events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"worksite_id" text NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"client_occurred_at" timestamp with time zone,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"latitude" text,
	"longitude" text,
	"accuracy" text,
	"location_status" text DEFAULT 'not_requested' NOT NULL,
	"idempotency_key" text NOT NULL,
	"previous_hash" text,
	"integrity_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" text DEFAULT 'Trabajador' NOT NULL,
	"pin_hash" text,
	"pin_salt" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worksites" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worksites" ADD CONSTRAINT "worksites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_worker_idx" ON "assignments" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "assignments_worksite_idx" ON "assignments" USING btree ("worksite_id");--> statement-breakpoint
CREATE INDEX "audit_company_date_idx" ON "audit_log" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clock_events_idempotency_idx" ON "clock_events" USING btree ("worker_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "clock_events_worker_date_idx" ON "clock_events" USING btree ("worker_id","occurred_at");--> statement-breakpoint
CREATE INDEX "clock_events_company_idx" ON "clock_events" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_owner_idx" ON "companies" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_worker_idx" ON "invitations" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_sessions_token_idx" ON "worker_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "worker_sessions_worker_idx" ON "worker_sessions" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "workers_company_idx" ON "workers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "worksites_company_idx" ON "worksites" USING btree ("company_id");
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_dates_check"
CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");
--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_type_check"
CHECK ("event_type" IN ('entry', 'pause', 'resume', 'exit'));
--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_location_status_check"
CHECK ("location_status" IN ('captured', 'denied', 'unavailable', 'not_available', 'not_requested'));
--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_idempotency_length_check"
CHECK (char_length("idempotency_key") BETWEEN 8 AND 120);
--> statement-breakpoint
ALTER TABLE "activation_attempts" ADD CONSTRAINT "activation_attempts_nonnegative_check"
CHECK ("attempts" >= 0);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_immutable_time_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'immutable_record';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER clock_events_immutable
BEFORE UPDATE OR DELETE ON "clock_events"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_time_record();
--> statement-breakpoint
CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_time_record();
--> statement-breakpoint
COMMENT ON TABLE "clock_events" IS 'Registros originales de jornada: solo inserción; las correcciones se guardarán separadamente.';
