import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

export async function GET(request: Request) {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });
  const db = getRawDb();
  const company = await db.prepare("SELECT id FROM companies WHERE owner_user_id = ? LIMIT 1").bind(supervisor.id).first<{ id: string }>();
  if (!company) return NextResponse.json({ trips: [] });

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 90);
  const trips = await db.prepare(`
    SELECT t.id, t.started_at, t.ended_at, t.status, t.distance_meters, t.point_count, t.purpose,
           w.first_name, w.last_name, ws.name AS worksite_name
    FROM trips t
    JOIN workers w ON w.id = t.worker_id
    JOIN worksites ws ON ws.id = t.worksite_id
    WHERE t.company_id = ? AND t.started_at >= NOW() - (? || ' days')::interval
    ORDER BY t.started_at DESC
    LIMIT 250
  `).bind(company.id, String(days)).all();

  return NextResponse.json({ trips: trips.results });
}
