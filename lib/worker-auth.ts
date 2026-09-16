import { cookies } from "next/headers";
import { getRawDb } from "@/db";
import { sha256 } from "@/lib/security";

export const WORKER_SESSION_COOKIE = "obra_worker_session";

export async function getWorkerSession() {
  const token = (await cookies()).get(WORKER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  return getRawDb().prepare(`
    SELECT s.id AS session_id, w.id AS worker_id, w.company_id, w.first_name, w.last_name, w.role,
           a.id AS assignment_id, a.worksite_id, ws.name AS worksite_name, ws.address AS worksite_address
    FROM worker_sessions s
    JOIN workers w ON w.id = s.worker_id
    JOIN assignments a ON a.worker_id = w.id AND a.active = true
    JOIN worksites ws ON ws.id = a.worksite_id AND ws.active = true
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND w.active = true
      AND a.starts_on <= substr(?, 1, 10) AND (a.ends_on IS NULL OR a.ends_on >= substr(?, 1, 10))
    ORDER BY a.starts_on DESC LIMIT 1
  `).bind(tokenHash, now, now, now).first<Record<string, string>>();
}
