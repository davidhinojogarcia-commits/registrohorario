import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { verifyPassword } from "@/lib/security";
import { createSupervisorSession } from "@/lib/supervisor-auth";

type SupervisorRow = {
  id: string;
  password_hash: string;
  password_salt: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Introduce correo y contraseña." }, { status: 400 });

  const supervisor = await getRawDb().prepare(
    "SELECT id, password_hash, password_salt FROM supervisors WHERE email = ? AND active = true LIMIT 1",
  ).bind(email).first<SupervisorRow>();

  if (!supervisor || !(await verifyPassword(password, supervisor.password_salt, supervisor.password_hash))) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  await createSupervisorSession(supervisor.id);
  return NextResponse.json({ ok: true });
}
