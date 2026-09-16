CREATE TABLE "trips" (
  "id" text PRIMARY KEY NOT NULL,
  "company_id" text NOT NULL,
  "worker_id" text NOT NULL,
  "worksite_id" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "status" text DEFAULT 'active' NOT NULL,
  "distance_meters" integer DEFAULT 0 NOT NULL,
  "point_count" integer DEFAULT 0 NOT NULL,
  "purpose" text DEFAULT 'Desplazamiento de trabajo' NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_worksite_id_worksites_id_fk" FOREIGN KEY ("worksite_id") REFERENCES "public"."worksites"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "trips_worker_idx" ON "trips" USING btree ("worker_id","started_at");
--> statement-breakpoint
CREATE INDEX "trips_company_idx" ON "trips" USING btree ("company_id","started_at");
--> statement-breakpoint
CREATE TABLE "trip_points" (
  "id" text PRIMARY KEY NOT NULL,
  "trip_id" text NOT NULL,
  "captured_at" timestamp with time zone NOT NULL,
  "latitude" text NOT NULL,
  "longitude" text NOT NULL,
  "accuracy" text,
  "speed" text,
  "heading" text
);
--> statement-breakpoint
ALTER TABLE "trip_points" ADD CONSTRAINT "trip_points_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "trip_points_trip_idx" ON "trip_points" USING btree ("trip_id","captured_at");
