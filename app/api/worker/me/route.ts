import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getWorkerSession } from "@/lib/worker-auth";

export async function GET() {
  const session = await getWorkerSession();
  if (!session) return NextResponse.json({ error: "Acceso no válido." }, { status: 401 });
  const events = await getRawDb().prepare(`
    SELECT id, event_type, occurred_at, location_status, integrity_hash
    FROM clock_events WHERE worker_id = ? AND occurred_at::date = ?::timestamptz::date
    ORDER BY occurred_at ASC
  `).bind(session.worker_id, new Date().toISOString()).all();
  return NextResponse.json({ session, events: events.results });
}
