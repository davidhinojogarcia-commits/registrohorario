import { boolean, index, pgTable, text, timestamp, uniqueIndex, integer } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [uniqueIndex("companies_owner_idx").on(table.ownerUserId)]);

export const worksites = pgTable("worksites", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [index("worksites_company_idx").on(table.companyId)]);

export const workers = pgTable("workers", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("Trabajador"),
  pinHash: text("pin_hash"),
  pinSalt: text("pin_salt"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [index("workers_company_idx").on(table.companyId)]);

export const assignments = pgTable("assignments", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  workerId: text("worker_id").notNull().references(() => workers.id),
  worksiteId: text("worksite_id").notNull().references(() => worksites.id),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  active: boolean("active").notNull().default(true),
}, (table) => [index("assignments_worker_idx").on(table.workerId), index("assignments_worksite_idx").on(table.worksiteId)]);

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  workerId: text("worker_id").notNull().references(() => workers.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [uniqueIndex("invitations_token_idx").on(table.tokenHash), index("invitations_worker_idx").on(table.workerId)]);

export const workerSessions = pgTable("worker_sessions", {
  id: text("id").primaryKey(),
  workerId: text("worker_id").notNull().references(() => workers.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [uniqueIndex("worker_sessions_token_idx").on(table.tokenHash), index("worker_sessions_worker_idx").on(table.workerId)]);

export const activationAttempts = pgTable("activation_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "string" }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
});

export const clockEvents = pgTable("clock_events", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  workerId: text("worker_id").notNull().references(() => workers.id),
  worksiteId: text("worksite_id").notNull().references(() => worksites.id),
  eventType: text("event_type", { enum: ["entry", "pause", "resume", "exit"] }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
  clientOccurredAt: timestamp("client_occurred_at", { withTimezone: true, mode: "string" }),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  accuracy: text("accuracy"),
  locationStatus: text("location_status").notNull().default("not_requested"),
  idempotencyKey: text("idempotency_key").notNull(),
  previousHash: text("previous_hash"),
  integrityHash: text("integrity_hash").notNull(),
}, (table) => [uniqueIndex("clock_events_idempotency_idx").on(table.workerId, table.idempotencyKey), index("clock_events_worker_date_idx").on(table.workerId, table.occurredAt), index("clock_events_company_idx").on(table.companyId)]);

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  detail: text("detail").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table) => [index("audit_company_date_idx").on(table.companyId, table.createdAt)]);
