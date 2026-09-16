import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRawDb } from "@/db";
import { randomToken, sha256 } from "@/lib/security";

const COOKIE_NAME = "registrohorario_admin_session";
const SESSION_DAYS = 30;

export type Supervisor = {
  id: string;
  email: string;
  name: string;
};

export async function createSupervisorSession(supervisorId: string) {
  const rawToken = randomToken();
  const tokenHash = await sha256(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getRawDb();

  await db.prepare(
    "INSERT INTO supervisor_sessions (id, supervisor_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), supervisorId, tokenHash, expiresAt.toISOString(), now.toISOString()).run();

  const store = await cookies();
  store.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentSupervisor(): Promise<Supervisor | null> {
  const store = await cookies();
  const rawToken = store.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = await sha256(rawToken);
  const nowIso = new Date().toISOString();
  const db = getRawDb();
  return db.prepare(
    `SELECT s.id, s.email, s.name
     FROM supervisor_sessions ss
     JOIN supervisors s ON s.id = ss.supervisor_id
     WHERE ss.token_hash = ?
       AND ss.revoked_at IS NULL
       AND ss.expires_at > ?
       AND s.active = true
     LIMIT 1`,
  ).bind(tokenHash, nowIso).first<Supervisor>();
}

export async function requireSupervisor(returnTo = "/") {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
  return supervisor;
}

export async function revokeCurrentSupervisorSession() {
  const store = await cookies();
  const rawToken = store.get(COOKIE_NAME)?.value;
  if (rawToken) {
    const tokenHash = await sha256(rawToken);
    await getRawDb().prepare(
      "UPDATE supervisor_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
    ).bind(new Date().toISOString(), tokenHash).run();
  }
  store.delete(COOKIE_NAME);
}
