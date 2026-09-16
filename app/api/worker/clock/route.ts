import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { sha256 } from "@/lib/security";
import { getWorkerSession } from "@/lib/worker-auth";

const allowedNext: Record<string, string[]> = { none: ["entry"], entry: ["pause", "exit"], pause: ["resume"], resume: ["pause", "exit"], exit: [] };

export async function POST(request: Request) {
  const session = await getWorkerSession();
  if (!session) return NextResponse.json({ error: "La sesión ha caducado." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const eventType = typeof body?.eventType === "string" ? body.eventType : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!["entry", "pause", "resume", "exit"].includes(eventType) || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    return NextResponse.json({ error: "Marcaje no válido." }, { status: 400 });
  }

  const db = getRawDb();
  const duplicate = await db.prepare("SELECT id, event_type, occurred_at FROM clock_events WHERE worker_id = ? AND idempotency_key = ? LIMIT 1").bind(session.worker_id, idempotencyKey).first();
  if (duplicate) return NextResponse.json({ event: duplicate, duplicate: true });

  const today = new Date().toISOString().slice(0, 10);
  const latest = await db.prepare("SELECT event_type, integrity_hash FROM clock_events WHERE worker_id = ? AND occurred_at::date = ?::date ORDER BY occurred_at DESC LIMIT 1")
    .bind(session.worker_id, today).first<{ event_type: string; integrity_hash: string }>();
  const current = latest?.event_type ?? "none";
  if (!allowedNext[current]?.includes(eventType)) return NextResponse.json({ error: "Ese marcaje no corresponde con el estado actual de la jornada." }, { status: 409 });

  const occurredAt = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const timezone = typeof body?.timezone === "string" ? body.timezone.slice(0, 64) : "Europe/Madrid";
  const location = body?.location && typeof body.location === "object" ? body.location as Record<string, unknown> : null;
  const locationStatus = location ? "captured" : "not_available";
  const integrityHash = await sha256([latest?.integrity_hash ?? "GENESIS", eventId, session.worker_id, session.worksite_id, eventType, occurredAt].join("|"));
  await db.batch([
    db.prepare(`INSERT INTO clock_events
      (id, company_id, worker_id, worksite_id, event_type, occurred_at, client_occurred_at, timezone, latitude, longitude, accuracy, location_status, idempotency_key, previous_hash, integrity_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(eventId, session.company_id, session.worker_id, session.worksite_id, eventType, occurredAt,
        typeof body?.clientOccurredAt === "string" ? body.clientOccurredAt : null, timezone,
        typeof location?.latitude === "number" ? String(location.latitude) : null,
        typeof location?.longitude === "number" ? String(location.longitude) : null,
        typeof location?.accuracy === "number" ? String(location.accuracy) : null,
        locationStatus, idempotencyKey, latest?.integrity_hash ?? null, integrityHash),
    db.prepare("INSERT INTO audit_log (id, company_id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'worker', ?, 'clock_event', 'clock_event', ?, ?, ?)")
      .bind(crypto.randomUUID(), session.company_id, session.worker_id, eventId, JSON.stringify({ eventType, locationStatus }), occurredAt),
  ]);
  return NextResponse.json({ event: { id: eventId, event_type: eventType, occurred_at: occurredAt, location_status: locationStatus, integrity_hash: integrityHash } });
}
