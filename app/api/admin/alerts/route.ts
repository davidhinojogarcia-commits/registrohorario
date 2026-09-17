import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

type EventType = "entry" | "pause" | "resume" | "exit";
type EventRow = {
  worker_id: string;
  first_name: string;
  last_name: string;
  worksite_name: string | null;
  event_type: EventType;
  occurred_at: string;
  location_status: string;
};

type WorkerRow = {
  id: string;
  first_name: string;
  last_name: string;
  worksite_name: string | null;
};

type Alert = {
  id: string;
  kind: "no_clock" | "long_shift" | "long_pause" | "no_gps" | "long_trip";
  severity: "info" | "warning" | "critical";
  workerId: string;
  workerName: string;
  worksiteName: string | null;
  title: string;
  detail: string;
  occurredAt: string | null;
};

function madridParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  return { hour, weekday };
}

function elapsedMinutes(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${String(rest).padStart(2, "0")} min` : `${rest} min`;
}

export async function GET() {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });

  const db = getRawDb();
  const company = await db.prepare("SELECT id FROM companies WHERE owner_user_id = ? LIMIT 1")
    .bind(supervisor.id)
    .first<{ id: string }>();
  if (!company) return NextResponse.json({ alerts: [], totals: { critical: 0, warning: 0, info: 0 } });

  const [workers, events, trips] = await Promise.all([
    db.prepare(`
      SELECT w.id, w.first_name, w.last_name, ws.name AS worksite_name
      FROM workers w
      LEFT JOIN LATERAL (
        SELECT a.worksite_id
        FROM assignments a
        WHERE a.worker_id = w.id AND a.company_id = w.company_id AND a.active = true
        ORDER BY a.starts_on DESC
        LIMIT 1
      ) current_assignment ON true
      LEFT JOIN worksites ws ON ws.id = current_assignment.worksite_id
      WHERE w.company_id = ? AND w.active = true
      ORDER BY w.first_name, w.last_name
    `).bind(company.id).all<WorkerRow>(),
    db.prepare(`
      SELECT ce.worker_id, w.first_name, w.last_name, ws.name AS worksite_name,
             ce.event_type, ce.occurred_at, ce.location_status
      FROM clock_events ce
      JOIN workers w ON w.id = ce.worker_id
      LEFT JOIN worksites ws ON ws.id = ce.worksite_id
      WHERE ce.company_id = ?
        AND (ce.occurred_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date
      ORDER BY ce.worker_id, ce.occurred_at ASC
    `).bind(company.id).all<EventRow>(),
    db.prepare(`
      SELECT t.id, t.worker_id, t.started_at, t.status, w.first_name, w.last_name, ws.name AS worksite_name
      FROM trips t
      JOIN workers w ON w.id = t.worker_id
      JOIN worksites ws ON ws.id = t.worksite_id
      WHERE t.company_id = ? AND t.status = 'active'
      ORDER BY t.started_at ASC
    `).bind(company.id).all<{ id: string; worker_id: string; started_at: string; status: string; first_name: string; last_name: string; worksite_name: string | null }>(),
  ]);

  const eventsByWorker = new Map<string, EventRow[]>();
  for (const event of events.results) {
    const list = eventsByWorker.get(event.worker_id) ?? [];
    list.push(event);
    eventsByWorker.set(event.worker_id, list);
  }

  const alerts: Alert[] = [];
  const { hour, weekday } = madridParts();
  const isWeekday = !["Sat", "Sun"].includes(weekday);

  for (const worker of workers.results) {
    const workerEvents = eventsByWorker.get(worker.id) ?? [];
    const name = `${worker.first_name} ${worker.last_name}`;

    if (workerEvents.length === 0 && isWeekday && hour >= 11) {
      alerts.push({
        id: `no-clock-${worker.id}`,
        kind: "no_clock",
        severity: "info",
        workerId: worker.id,
        workerName: name,
        worksiteName: worker.worksite_name,
        title: "Sin fichar hoy",
        detail: "No consta ningún fichaje hoy. Revisa si tenía jornada prevista antes de actuar.",
        occurredAt: null,
      });
      continue;
    }

    const firstEntry = workerEvents.find((event) => event.event_type === "entry");
    const last = workerEvents.at(-1);
    if (firstEntry && last && last.event_type !== "exit") {
      const minutes = elapsedMinutes(firstEntry.occurred_at);
      if (minutes >= 12 * 60) {
        alerts.push({
          id: `long-shift-${worker.id}`,
          kind: "long_shift",
          severity: "critical",
          workerId: worker.id,
          workerName: name,
          worksiteName: worker.worksite_name,
          title: "Jornada abierta más de 12 horas",
          detail: `La jornada lleva abierta ${durationLabel(minutes)} sin salida registrada.`,
          occurredAt: firstEntry.occurred_at,
        });
      }
    }

    if (last?.event_type === "pause") {
      const minutes = elapsedMinutes(last.occurred_at);
      if (minutes >= 90) {
        alerts.push({
          id: `long-pause-${worker.id}`,
          kind: "long_pause",
          severity: "warning",
          workerId: worker.id,
          workerName: name,
          worksiteName: worker.worksite_name,
          title: "Pausa prolongada",
          detail: `La pausa actual lleva ${durationLabel(minutes)}.`,
          occurredAt: last.occurred_at,
        });
      }
    }

    const withoutGps = workerEvents.filter((event) => event.location_status !== "captured");
    if (withoutGps.length > 0) {
      alerts.push({
        id: `no-gps-${worker.id}`,
        kind: "no_gps",
        severity: "warning",
        workerId: worker.id,
        workerName: name,
        worksiteName: worker.worksite_name,
        title: "Fichaje sin ubicación",
        detail: `${withoutGps.length} fichaje${withoutGps.length === 1 ? "" : "s"} de hoy no tiene${withoutGps.length === 1 ? "" : "n"} GPS registrado.`,
        occurredAt: withoutGps.at(-1)?.occurred_at ?? null,
      });
    }
  }

  for (const trip of trips.results) {
    const minutes = elapsedMinutes(trip.started_at);
    if (minutes >= 120) {
      alerts.push({
        id: `long-trip-${trip.id}`,
        kind: "long_trip",
        severity: "warning",
        workerId: trip.worker_id,
        workerName: `${trip.first_name} ${trip.last_name}`,
        worksiteName: trip.worksite_name,
        title: "Trayecto sigue activo",
        detail: `El trayecto lleva ${durationLabel(minutes)} sin finalizar.`,
        occurredAt: trip.started_at,
      });
    }
  }

  const priority = { critical: 0, warning: 1, info: 2 } as const;
  alerts.sort((a, b) => priority[a.severity] - priority[b.severity] || (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));
  const totals = alerts.reduce((acc, alert) => {
    acc[alert.severity] += 1;
    return acc;
  }, { critical: 0, warning: 0, info: 0 });

  return NextResponse.json({ alerts, totals });
}
