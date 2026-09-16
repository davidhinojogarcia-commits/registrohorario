import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { hashPassword } from "@/lib/security";
import { createSupervisorSession } from "@/lib/supervisor-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; email?: string; password?: string } | null;
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (name.length < 2) return NextResponse.json({ error: "Indica tu nombre." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Introduce un correo válido." }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "La contraseña debe tener al menos 10 caracteres." }, { status: 400 });

  const db = getRawDb();
  const existing = await db.prepare("SELECT id FROM supervisors LIMIT 1").first<{ id: string }>();
  if (existing) return NextResponse.json({ error: "El registro inicial ya está cerrado." }, { status: 409 });

  const id = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);
  await db.prepare(
    "INSERT INTO supervisors (id, email, name, password_hash, password_salt, active, created_at) VALUES (?, ?, ?, ?, ?, true, ?)",
  ).bind(id, email, name, hash, salt, new Date().toISOString()).run();

  await createSupervisorSession(id);
  return NextResponse.json({ ok: true });
}
