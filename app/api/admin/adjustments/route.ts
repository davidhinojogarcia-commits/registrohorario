import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

type EventType = "entry" | "pause" | "resume" | "exit";
const allowedTypes: EventType[] = ["entry", "pause", "resume", "exit"];

async function companyForSupervisor(supervisorId: string) {
  return getRawDb().prepare("SELECT id, name FROM companies WHERE owner_user_id = ? LIMIT 1")
    .bind(supervisorId)
    .first<{ id: string; name: string }>();
}

export async function GET(request: Request) {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });
  const company = await companyForSupervisor(supervisor.id);
  if (!company) return NextResponse.json({ adjustments: [] });

  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") ?? "";
  const db = getRawDb();
  const result = await db.prepare(`
    SELECT ca.id, ca.worker_id, ca.worksite_id, ca.original_event_id, ca.event_type,
           ca.effective_at, ca.reason, ca.adjustment_type, ca.created_at, ca.revoked_at, ca.revoked_reason,
           w.first_name, w.last_name, ws.name AS worksite_name,
           ce.occurred_at AS original_occurred_at, ce.event_type AS original_event_type
    FROM clock_adjustments ca
    JOIN workers w ON w.id = ca.worker_id AND w.company_id = ca.company_id
    JOIN worksites ws ON ws.id = ca.worksite_id AND ws.company_id = ca.company_id
    LEFT JOIN clock_events ce ON ce.id = ca.original_event_id AND ce.company_id = ca.company_id
    WHERE ca.company_id = ? AND (? = '' OR ca.worker_id = ?)
    ORDER BY ca.created_at DESC
    LIMIT 200
  `).bind(company.id, workerId, workerId).all();

  return NextResponse.json({ adjustments: result.results });
}

export async function POST(request: Request) {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });
  const company = await companyForSupervisor(supervisor.id);
  if (!company) return NextResponse.json({ error: "Primero configura la empresa." }, { status: 409 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  const db = getRawDb();
  const now = new Date().toISOString();

  if (body.action === "create") {
    const workerId = typeof body.workerId === "string" ? body.workerId : "";
    const worksiteId = typeof body.worksiteId === "string" ? body.worksiteId : "";
    const originalEventId = typeof body.originalEventId === "string" && body.originalEventId ? body.originalEventId : null;
    const eventType = typeof body.eventType === "string" ? body.eventType as EventType : "entry";
    const effectiveAt = typeof body.effectiveAt === "string" ? body.effectiveAt : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const adjustmentType = originalEventId ? "correction" : "missing_event";

    if (!workerId || !worksiteId || !allowedTypes.includes(eventType) || reason.length < 5 || Number.isNaN(new Date(effectiveAt).getTime())) {
      return NextResponse.json({ error: "Completa correctamente trabajador, obra, tipo, fecha/hora y motivo." }, { status: 400 });
    }
    const worker = await db.prepare("SELECT id FROM workers WHERE id = ? AND company_id = ?").bind(workerId, company.id).first();
    const worksite = await db.prepare("SELECT id FROM worksites WHERE id = ? AND company_id = ?").bind(worksiteId, company.id).first();
    if (!worker || !worksite) return NextResponse.json({ error: "Trabajador u obra no válidos." }, { status: 404 });

    if (originalEventId) {
      const original = await db.prepare("SELECT id, worker_id FROM clock_events WHERE id = ? AND company_id = ?").bind(originalEventId, company.id).first<{ id: string; worker_id: string }>();
      if (!original || original.worker_id !== workerId) return NextResponse.json({ error: "El fichaje original no pertenece al trabajador seleccionado." }, { status: 400 });
      const activeCorrection = await db.prepare("SELECT id FROM clock_adjustments WHERE original_event_id = ? AND company_id = ? AND revoked_at IS NULL LIMIT 1").bind(originalEventId, company.id).first();
      if (activeCorrection) return NextResponse.json({ error: "Ese fichaje ya tiene una corrección activa. Revócala antes de crear otra." }, { status: 409 });
    }

    const id = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO clock_adjustments
        (id, company_id, worker_id, worksite_id, original_event_id, event_type, effective_at, reason, adjustment_type, created_by_supervisor_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, company.id, workerId, worksiteId, originalEventId, eventType, new Date(effectiveAt).toISOString(), reason, adjustmentType, supervisor.id, now),
      db.prepare("INSERT INTO audit_log (id, company_id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'supervisor', ?, 'clock_adjustment_created', 'clock_adjustment', ?, ?, ?)")
        .bind(crypto.randomUUID(), company.id, supervisor.id, id, JSON.stringify({ workerId, worksiteId, originalEventId, eventType, effectiveAt, reason, adjustmentType }), now),
    ]);
    return NextResponse.json({ id });
  }

  if (body.action === "revoke") {
    const id = typeof body.id === "string" ? body.id : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!id || reason.length < 5) return NextResponse.json({ error: "Indica el motivo de la revocación." }, { status: 400 });
    const adjustment = await db.prepare("SELECT id FROM clock_adjustments WHERE id = ? AND company_id = ? AND revoked_at IS NULL").bind(id, company.id).first();
    if (!adjustment) return NextResponse.json({ error: "Ajuste no encontrado o ya revocado." }, { status: 404 });
    await db.batch([
      db.prepare("UPDATE clock_adjustments SET revoked_at = ?, revoked_reason = ? WHERE id = ? AND company_id = ?").bind(now, reason, id, company.id),
      db.prepare("INSERT INTO audit_log (id, company_id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'supervisor', ?, 'clock_adjustment_revoked', 'clock_adjustment', ?, ?, ?)")
        .bind(crypto.randomUUID(), company.id, supervisor.id, id, JSON.stringify({ reason }), now),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
