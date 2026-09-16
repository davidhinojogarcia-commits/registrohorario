import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";
import { randomToken, sha256 } from "@/lib/security";

async function companyForSupervisor(supervisorId: string) {
  return getRawDb().prepare("SELECT id, name FROM companies WHERE owner_user_id = ? LIMIT 1")
    .bind(supervisorId)
    .first<{ id: string; name: string }>();
}

export async function GET() {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });
  const db = getRawDb();
  const company = await companyForSupervisor(supervisor.id);
  if (!company) return NextResponse.json({ company: null, worksites: [], workers: [] });

  const worksites = await db.prepare(`
    SELECT id, name, address, active, created_at
    FROM worksites WHERE company_id = ? ORDER BY active DESC, name
  `).bind(company.id).all();
  const workers = await db.prepare(`
    SELECT w.id, w.first_name, w.last_name, w.role, w.active, w.created_at,
           a.worksite_id, ws.name AS worksite_name
    FROM workers w
    LEFT JOIN assignments a ON a.worker_id = w.id AND a.active = true
    LEFT JOIN worksites ws ON ws.id = a.worksite_id
    WHERE w.company_id = ?
    ORDER BY w.active DESC, w.first_name, w.last_name
  `).bind(company.id).all();

  return NextResponse.json({ company, worksites: worksites.results, workers: workers.results });
}

export async function POST(request: Request) {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  const db = getRawDb();
  let company = await companyForSupervisor(supervisor.id);
  const now = new Date().toISOString();

  if (body.action === "ensure_company") {
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Mi empresa";
    if (!company) {
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO companies (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, name, supervisor.id, now).run();
      company = { id, name };
    } else if (company.name !== name) {
      await db.prepare("UPDATE companies SET name = ? WHERE id = ? AND owner_user_id = ?")
        .bind(name, company.id, supervisor.id).run();
      company.name = name;
    }
    return NextResponse.json({ company });
  }

  if (!company) return NextResponse.json({ error: "Primero configura la empresa." }, { status: 409 });

  if (body.action === "create_worksite") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (name.length < 2) return NextResponse.json({ error: "Indica el nombre de la obra." }, { status: 400 });
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO worksites (id, company_id, name, address, active, created_at) VALUES (?, ?, ?, ?, true, ?)")
      .bind(id, company.id, name, address, now).run();
    return NextResponse.json({ id });
  }

  if (body.action === "update_worksite") {
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const active = body.active !== false;
    if (!id || name.length < 2) return NextResponse.json({ error: "Datos de obra no válidos." }, { status: 400 });
    const owned = await db.prepare("SELECT id FROM worksites WHERE id = ? AND company_id = ?").bind(id, company.id).first();
    if (!owned) return NextResponse.json({ error: "Obra no encontrada." }, { status: 404 });
    await db.prepare("UPDATE worksites SET name = ?, address = ?, active = ? WHERE id = ? AND company_id = ?")
      .bind(name, address, active, id, company.id).run();
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_worker") {
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "Trabajador";
    const worksiteId = typeof body.worksiteId === "string" ? body.worksiteId : "";
    if (firstName.length < 2 || lastName.length < 2 || !worksiteId) return NextResponse.json({ error: "Completa nombre, apellidos y obra." }, { status: 400 });
    const worksite = await db.prepare("SELECT id FROM worksites WHERE id = ? AND company_id = ? AND active = true").bind(worksiteId, company.id).first();
    if (!worksite) return NextResponse.json({ error: "La obra seleccionada no es válida." }, { status: 400 });
    const workerId = crypto.randomUUID();
    const assignmentId = crypto.randomUUID();
    await db.batch([
      db.prepare("INSERT INTO workers (id, company_id, first_name, last_name, role, active, created_at) VALUES (?, ?, ?, ?, ?, true, ?)")
        .bind(workerId, company.id, firstName, lastName, role, now),
      db.prepare("INSERT INTO assignments (id, company_id, worker_id, worksite_id, starts_on, active) VALUES (?, ?, ?, ?, ?, true)")
        .bind(assignmentId, company.id, workerId, worksiteId, now.slice(0, 10)),
    ]);
    return NextResponse.json({ id: workerId });
  }

  if (body.action === "update_worker") {
    const id = typeof body.id === "string" ? body.id : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const role = typeof body.role === "string" && body.role.trim() ? body.role.trim() : "Trabajador";
    const active = body.active !== false;
    const worksiteId = typeof body.worksiteId === "string" ? body.worksiteId : "";
    if (!id || firstName.length < 2 || lastName.length < 2) return NextResponse.json({ error: "Datos de trabajador no válidos." }, { status: 400 });
    const worker = await db.prepare("SELECT id FROM workers WHERE id = ? AND company_id = ?").bind(id, company.id).first();
    if (!worker) return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
    if (worksiteId) {
      const worksite = await db.prepare("SELECT id FROM worksites WHERE id = ? AND company_id = ? AND active = true").bind(worksiteId, company.id).first();
      if (!worksite) return NextResponse.json({ error: "La obra seleccionada no es válida." }, { status: 400 });
    }
    const statements = [
      db.prepare("UPDATE workers SET first_name = ?, last_name = ?, role = ?, active = ? WHERE id = ? AND company_id = ?")
        .bind(firstName, lastName, role, active, id, company.id),
    ];
    if (worksiteId) {
      statements.push(db.prepare("UPDATE assignments SET active = false, ends_on = ? WHERE worker_id = ? AND company_id = ? AND active = true")
        .bind(now.slice(0, 10), id, company.id));
      statements.push(db.prepare("INSERT INTO assignments (id, company_id, worker_id, worksite_id, starts_on, active) VALUES (?, ?, ?, ?, ?, true)")
        .bind(crypto.randomUUID(), company.id, id, worksiteId, now.slice(0, 10)));
    }
    if (!active) {
      statements.push(db.prepare("UPDATE worker_sessions SET revoked_at = ? WHERE worker_id = ? AND revoked_at IS NULL").bind(now, id));
      statements.push(db.prepare("UPDATE assignments SET active = false, ends_on = ? WHERE worker_id = ? AND company_id = ? AND active = true")
        .bind(now.slice(0, 10), id, company.id));
    }
    await db.batch(statements);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "invite_worker") {
    const workerId = typeof body.workerId === "string" ? body.workerId : "";
    const worker = await db.prepare("SELECT id FROM workers WHERE id = ? AND company_id = ? AND active = true").bind(workerId, company.id).first();
    if (!worker) return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });
    const assignment = await db.prepare("SELECT id FROM assignments WHERE worker_id = ? AND company_id = ? AND active = true LIMIT 1").bind(workerId, company.id).first();
    if (!assignment) return NextResponse.json({ error: "El trabajador debe tener una obra activa." }, { status: 409 });
    const rawToken = randomToken();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO invitations (id, company_id, worker_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), company.id, workerId, tokenHash, expiresAt, now).run();
    const origin = new URL(request.url).origin;
    return NextResponse.json({ invitationUrl: `${origin}/trabajador/invitacion/${rawToken}`, expiresAt });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
