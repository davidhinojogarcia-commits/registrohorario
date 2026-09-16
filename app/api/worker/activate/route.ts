import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { hashPin, randomToken, sha256, verifyPin } from "@/lib/security";
import { WORKER_SESSION_COOKIE } from "@/lib/worker-auth";
import type { DatabaseClient } from "@/db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function recordFailure(db: DatabaseClient, key: string, now: Date) {
  const current = await db.prepare("SELECT attempts, window_started_at FROM activation_attempts WHERE key = ?").bind(key).first<{ attempts: number; window_started_at: string }>();
  const reset = !current || new Date(current.window_started_at).getTime() < now.getTime() - WINDOW_MS;
  const attempts = reset ? 1 : current.attempts + 1;
  const windowStartedAt = reset ? now.toISOString() : current.window_started_at;
  const blockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + WINDOW_MS).toISOString() : null;
  await db.prepare(`INSERT INTO activation_attempts (key, attempts, window_started_at, blocked_until, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET attempts = excluded.attempts,
    window_started_at = excluded.window_started_at, blocked_until = excluded.blocked_until, updated_at = excluded.updated_at`)
    .bind(key, attempts, windowStartedAt, blockedUntil, now.toISOString()).run();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; pin?: string } | null;
  if (!body?.token || !/^\d{6}$/.test(body.pin ?? "")) {
    return NextResponse.json({ error: "Introduce un PIN de 6 cifras." }, { status: 400 });
  }

  const db = getRawDb();
  const now = new Date();
  const tokenHash = await sha256(body.token);
  const forwardedIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const attemptKey = await sha256(`activation|${forwardedIp}`);
  const attempt = await db.prepare("SELECT blocked_until FROM activation_attempts WHERE key = ?").bind(attemptKey).first<{ blocked_until: string | null }>();
  if (attempt?.blocked_until && new Date(attempt.blocked_until) > now) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos antes de volver a probar." }, { status: 429, headers: { "retry-after": "900" } });
  }
  const invitation = await db.prepare(`
    SELECT i.id, i.company_id, i.worker_id, w.pin_hash, w.pin_salt
    FROM invitations i JOIN workers w ON w.id = i.worker_id
    WHERE i.token_hash = ? AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at > ? LIMIT 1
  `).bind(tokenHash, now.toISOString()).first<{ id: string; company_id: string; worker_id: string; pin_hash: string | null; pin_salt: string | null }>();
  if (!invitation) {
    await recordFailure(db, attemptKey, now);
    return NextResponse.json({ error: "La invitación no es válida o ha caducado." }, { status: 401 });
  }

  if (invitation.pin_hash && invitation.pin_salt && !(await verifyPin(body.pin!, invitation.pin_salt, invitation.pin_hash))) {
    await recordFailure(db, attemptKey, now);
    return NextResponse.json({ error: "El PIN no es correcto." }, { status: 401 });
  }
  const { salt, hash } = await hashPin(body.pin!);
  const sessionToken = randomToken();
  const sessionHash = await sha256(sessionToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const statements = [
    db.prepare("INSERT INTO worker_sessions (id, worker_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(sessionId, invitation.worker_id, sessionHash, expiresAt, now.toISOString()),
    db.prepare("UPDATE invitations SET accepted_at = COALESCE(accepted_at, ?) WHERE id = ?").bind(now.toISOString(), invitation.id),
    db.prepare("INSERT INTO audit_log (id, company_id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at) VALUES (?, ?, 'worker', ?, 'activate_access', 'session', ?, '{}', ?)").bind(crypto.randomUUID(), invitation.company_id, invitation.worker_id, sessionId, now.toISOString()),
  ];
  if (!invitation.pin_hash) statements.unshift(db.prepare("UPDATE workers SET pin_hash = ?, pin_salt = ? WHERE id = ? AND pin_hash IS NULL").bind(hash, salt, invitation.worker_id));
  await db.batch(statements);
  await db.prepare("DELETE FROM activation_attempts WHERE key = ? OR updated_at < ?").bind(attemptKey, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()).run();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(WORKER_SESSION_COOKIE, sessionToken, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60 });
  return response;
}
