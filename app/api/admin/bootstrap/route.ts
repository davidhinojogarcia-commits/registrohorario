import { NextResponse } from "next/server";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";
import { getRawDb } from "@/db";
import { randomToken, sha256 } from "@/lib/security";

export async function POST(request: Request) {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });

  const db = getRawDb();
  const now = new Date();
  const nowIso = now.toISOString();
  let company = await db.prepare("SELECT id, name FROM companies WHERE owner_user_id = ? LIMIT 1").bind(supervisor.id).first<{ id: string; name: string }>();

  if (!company) {
    const companyId = crypto.randomUUID();
    const worksiteId = crypto.randomUUID();
    const workerId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO companies (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)").bind(companyId, "Mi empresa", supervisor.id, nowIso),
      db.prepare("INSERT INTO worksites (id, company_id, name, address, active, created_at) VALUES (?, ?, ?, ?, true, ?)").bind(worksiteId, companyId, "Obra de prueba", "Configura la dirección", nowIso),
      db.prepare("INSERT INTO workers (id, company_id, first_name, last_name, role, active, created_at) VALUES (?, ?, ?, ?, ?, true, ?)").bind(workerId, companyId, "Trabajador", "de prueba", "Oficial", nowIso),
      db.prepare("INSERT INTO assignments (id, company_id, worker_id, worksite_id, starts_on, active) VALUES (?, ?, ?, ?, ?, true)").bind(assignmentId, companyId, workerId, worksiteId, nowIso.slice(0, 10)),
      db.prepare("INSERT INTO audit_log (id, company_id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'supervisor', ?, 'bootstrap', 'company', ?, '{}', ?)").bind(crypto.randomUUID(), companyId, supervisor.id, companyId, nowIso),
    ]);
    company = { id: companyId, name: "Mi empresa" };
  }

  const worker = await db.prepare("SELECT id, first_name, last_name FROM workers WHERE company_id = ? AND active = true ORDER BY created_at LIMIT 1").bind(company.id).first<{ id: string; first_name: string; last_name: string }>();
  if (!worker) return NextResponse.json({ error: "No hay ningún trabajador activo." }, { status: 409 });

  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO invitations (id, company_id, worker_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), company.id, worker.id, tokenHash, expiresAt, nowIso).run();

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    company,
    worker: { id: worker.id, name: `${worker.first_name} ${worker.last_name}` },
    invitationUrl: `${origin}/trabajador/invitacion/${rawToken}`,
    expiresAt,
  });
}
