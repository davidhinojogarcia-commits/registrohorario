CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`worksite_id` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worksite_id`) REFERENCES `worksites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assignments_worker_idx` ON `assignments` (`worker_id`);--> statement-breakpoint
CREATE INDEX `assignments_worksite_idx` ON `assignments` (`worksite_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_company_date_idx` ON `audit_log` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clock_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`worksite_id` text NOT NULL,
	`event_type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`client_occurred_at` text,
	`timezone` text DEFAULT 'Europe/Madrid' NOT NULL,
	`latitude` text,
	`longitude` text,
	`accuracy` text,
	`location_status` text DEFAULT 'not_requested' NOT NULL,
	`idempotency_key` text NOT NULL,
	`previous_hash` text,
	`integrity_hash` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worksite_id`) REFERENCES `worksites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clock_events_idempotency_idx` ON `clock_events` (`worker_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `clock_events_worker_date_idx` ON `clock_events` (`worker_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `clock_events_company_idx` ON `clock_events` (`company_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_owner_idx` ON `companies` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`worker_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_idx` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invitations_worker_idx` ON `invitations` (`worker_id`);--> statement-breakpoint
CREATE TABLE `worker_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worker_sessions_token_idx` ON `worker_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `worker_sessions_worker_idx` ON `worker_sessions` (`worker_id`);--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`role` text DEFAULT 'Trabajador' NOT NULL,
	`pin_hash` text,
	`pin_salt` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workers_company_idx` ON `workers` (`company_id`);--> statement-breakpoint
CREATE TABLE `worksites` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `worksites_company_idx` ON `worksites` (`company_id`);