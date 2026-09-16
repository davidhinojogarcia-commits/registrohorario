CREATE TABLE "supervisors" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "password_salt" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "supervisors_email_idx" ON "supervisors" USING btree ("email");
--> statement-breakpoint
CREATE TABLE "supervisor_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "supervisor_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supervisor_sessions" ADD CONSTRAINT "supervisor_sessions_supervisor_id_supervisors_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."supervisors"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "supervisor_sessions_token_idx" ON "supervisor_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "supervisor_sessions_supervisor_idx" ON "supervisor_sessions" USING btree ("supervisor_id");
