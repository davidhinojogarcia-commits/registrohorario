import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getWorkerSession } from "@/lib/worker-auth";

type Point = { latitude?: number; longitude?: number; accuracy?: number; speed?: number | null; heading?: number | null };

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radius = 6_371_000;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export async function GET() {
  const session = await getWorkerSession();
  if (!session) return NextResponse.json({ error: "Acceso no válido." }, { status: 401 });
  const db = getRawDb();
  const active = await db.prepare(`
    SELECT id, started_at, distance_meters, point_count, purpose
    FROM trips WHERE worker_id = ? AND status = 'active'
    ORDER BY started_at DESC LIMIT 1
  `).bind(session.worker_id).first();
  return NextResponse.json({ activeTrip: active ?? null });
}

export async function POST(request: Request) {
  const session = await getWorkerSession();
  if (!session) return NextResponse.json({ error: "Acceso no válido." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; tripId?: string; purpose?: string; point?: Point } | null;
  if (!body?.action) return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
  const db = getRawDb();
  const now = new Date().toISOString();

  if (body.action === "start") {
    const existing = await db.prepare("SELECT id FROM trips WHERE worker_id = ? AND status = 'active' LIMIT 1").bind(session.worker_id).first<{ id: string }>();
    if (existing) return NextResponse.json({ error: "Ya tienes un trayecto activo.", tripId: existing.id }, { status: 409 });
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO trips (id, company_id, worker_id, worksite_id, started_at, status, distance_meters, point_count, purpose, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)
    `).bind(id, session.company_id, session.worker_id, session.worksite_id, now, body.purpose?.trim() || "Desplazamiento de trabajo", now).run();
    return NextResponse.json({ tripId: id, startedAt: now });
  }

  if (body.action === "point") {
    const tripId = body.tripId ?? "";
    const point = body.point;
    if (!tripId || typeof point?.latitude !== "number" || typeof point.longitude !== "number") {
      return NextResponse.json({ error: "Punto GPS no válido." }, { status: 400 });
    }
    const trip = await db.prepare("SELECT id FROM trips WHERE id = ? AND worker_id = ? AND status = 'active'").bind(tripId, session.worker_id).first();
    if (!trip) return NextResponse.json({ error: "Trayecto no encontrado o finalizado." }, { status: 404 });
    const previous = await db.prepare(`
      SELECT latitude, longitude FROM trip_points WHERE trip_id = ? ORDER BY captured_at DESC LIMIT 1
    `).bind(tripId).first<{ latitude: string; longitude: string }>();
    let delta = 0;
    if (previous) {
      delta = metersBetween(
        { latitude: Number(previous.latitude), longitude: Number(previous.longitude) },
        { latitude: point.latitude, longitude: point.longitude },
      );
      if (!Number.isFinite(delta) || delta < 2 || delta > 2_000) delta = 0;
    }
    await db.batch([
      db.prepare(`INSERT INTO trip_points (id, trip_id, captured_at, latitude, longitude, accuracy, speed, heading) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), tripId, now, String(point.latitude), String(point.longitude), point.accuracy == null ? null : String(point.accuracy), point.speed == null ? null : String(point.speed), point.heading == null ? null : String(point.heading)),
      db.prepare("UPDATE trips SET distance_meters = distance_meters + ?, point_count = point_count + 1 WHERE id = ? AND worker_id = ?")
        .bind(Math.round(delta), tripId, session.worker_id),
    ]);
    return NextResponse.json({ ok: true, addedMeters: Math.round(delta) });
  }

  if (body.action === "finish") {
    const tripId = body.tripId ?? "";
    const trip = await db.prepare("SELECT id, started_at, distance_meters, point_count FROM trips WHERE id = ? AND worker_id = ? AND status = 'active'")
      .bind(tripId, session.worker_id).first<{ id: string; started_at: string; distance_meters: number; point_count: number }>();
    if (!trip) return NextResponse.json({ error: "Trayecto no encontrado o ya finalizado." }, { status: 404 });
    await db.prepare("UPDATE trips SET status = 'completed', ended_at = ? WHERE id = ? AND worker_id = ?")
      .bind(now, tripId, session.worker_id).run();
    return NextResponse.json({ ok: true, endedAt: now, distanceMeters: trip.distance_meters, pointCount: trip.point_count });
  }

  return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
}
