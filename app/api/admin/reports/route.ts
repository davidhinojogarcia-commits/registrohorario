import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

type EventType = "entry" | "pause" | "resume" | "exit";
type EventRow = {
  id: string;
  event_type: EventType;
  occurred_at: string;
  worksite_name: string | null;
  location_status: string;
  adjusted: boolean;
  adjustment_id: string | null;
  adjustment_reason: string | null;
  original_occurred_at: string | null;
  original_event_type: EventType | null;
  synthetic: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 13);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function localDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function summarize(events: EventRow[], rangeTo: string) {
  const byDay = new Map<string, EventRow[]>();
  for (const event of events) {
    const day = localDay(event.occurred_at);
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }

  const now = Date.now();
  const today = localDay(new Date().toISOString());
  const days = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, dayEvents]) => {
    const ordered = [...dayEvents].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    let workedMs = 0;
    let pauseMs = 0;
    let workingSince: number | null = null;
    let pausedSince: number | null = null;

    for (const event of ordered) {
      const at = new Date(event.occurred_at).getTime();
      if (event.event_type === "entry" || event.event_type === "resume") {
        if (pausedSince !== null) {
          pauseMs += Math.max(0, at - pausedSince);
          pausedSince = null;
        }
        if (workingSince === null) workingSince = at;
      }
      if (event.event_type === "pause" || event.event_type === "exit") {
        if (workingSince !== null) {
          workedMs += Math.max(0, at - workingSince);
          workingSince = null;
        }
        if (event.event_type === "pause" && pausedSince === null) pausedSince = at;
        if (event.event_type === "exit" && pausedSince !== null) {
          pauseMs += Math.max(0, at - pausedSince);
          pausedSince = null;
        }
      }
    }

    if (date === today && rangeTo >= today) {
      if (workingSince !== null) workedMs += Math.max(0, now - workingSince);
      if (pausedSince !== null) pauseMs += Math.max(0, now - pausedSince);
    }

    return {
      date,
      workedMinutes: Math.floor(workedMs / 60_000),
      pauseMinutes: Math.floor(pauseMs / 60_000),
      firstEntry: ordered.find((event) => event.event_type === "entry")?.occurred_at ?? null,
      lastExit: [...ordered].reverse().find((event) => event.event_type === "exit")?.occurred_at ?? null,
      worksiteNames: [...new Set(ordered.map((event) => event.worksite_name).filter(Boolean))],
      adjustedCount: ordered.filter((event) => event.adjusted).length,
      events: ordered,
    };
  });

  return {
    days,
    totals: {
      workedMinutes: days.reduce((sum, day) => sum + day.workedMinutes, 0),
      pauseMinutes: days.reduce((sum, day) => sum + day.pauseMinutes, 0),
      daysWithRecords: days.length,
      eventCount: events.length,
      adjustedCount: events.filter((event) => event.adjusted).length,
    },
  };
}

export async function GET(request: Request) {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });

  const db = getRawDb();
  const company = await db.prepare("SELECT id, name FROM companies WHERE owner_user_id = ? LIMIT 1")
    .bind(supervisor.id)
    .first<{ id: string; name: string }>();
  if (!company) return NextResponse.json({ company: null, workers: [], report: null });

  const workers = await db.prepare(`
    SELECT id, first_name, last_name, role, active
    FROM workers
    WHERE company_id = ?
    ORDER BY active DESC, first_name, last_name
  `).bind(company.id).all();

  const url = new URL(request.url);
  const workerId = url.searchParams.get("workerId") ?? "";
  if (!workerId) return NextResponse.json({ company, workers: workers.results, report: null });

  const worker = await db.prepare(`
    SELECT id, first_name, last_name, role, active
    FROM workers WHERE id = ? AND company_id = ? LIMIT 1
  `).bind(workerId, company.id).first<{ id: string; first_name: string; last_name: string; role: string; active: boolean }>();
  if (!worker) return NextResponse.json({ error: "Trabajador no encontrado." }, { status: 404 });

  const defaults = defaultRange();
  const from = url.searchParams.get("from") ?? defaults.from;
  const to = url.searchParams.get("to") ?? defaults.to;
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: "El rango de fechas no es válido." }, { status: 400 });
  }

  const events = await db.prepare(`
    WITH corrected_originals AS (
      SELECT
        ce.id,
        COALESCE(ca.event_type, ce.event_type) AS event_type,
        COALESCE(ca.effective_at, ce.occurred_at) AS occurred_at,
        COALESCE(cws.name, ws.name) AS worksite_name,
        ce.location_status,
        (ca.id IS NOT NULL) AS adjusted,
        ca.id AS adjustment_id,
        ca.reason AS adjustment_reason,
        CASE WHEN ca.id IS NOT NULL THEN ce.occurred_at ELSE NULL END AS original_occurred_at,
        CASE WHEN ca.id IS NOT NULL THEN ce.event_type ELSE NULL END AS original_event_type,
        false AS synthetic
      FROM clock_events ce
      LEFT JOIN worksites ws ON ws.id = ce.worksite_id
      LEFT JOIN clock_adjustments ca ON ca.original_event_id = ce.id AND ca.company_id = ce.company_id AND ca.revoked_at IS NULL
      LEFT JOIN worksites cws ON cws.id = ca.worksite_id
      WHERE ce.worker_id = ? AND ce.company_id = ?
    ),
    missing_events AS (
      SELECT
        ca.id,
        ca.event_type,
        ca.effective_at AS occurred_at,
        ws.name AS worksite_name,
        'adjusted'::text AS location_status,
        true AS adjusted,
        ca.id AS adjustment_id,
        ca.reason AS adjustment_reason,
        NULL::timestamptz AS original_occurred_at,
        NULL::text AS original_event_type,
        true AS synthetic
      FROM clock_adjustments ca
      JOIN worksites ws ON ws.id = ca.worksite_id
      WHERE ca.worker_id = ? AND ca.company_id = ?
        AND ca.original_event_id IS NULL AND ca.revoked_at IS NULL
    )
    SELECT * FROM (
      SELECT * FROM corrected_originals
      UNION ALL
      SELECT * FROM missing_events
    ) effective_events
    WHERE (occurred_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN ?::date AND ?::date
    ORDER BY occurred_at ASC
  `).bind(worker.id, company.id, worker.id, company.id, from, to).all<EventRow>();

  const summary = summarize(events.results, to);
  return NextResponse.json({
    company,
    workers: workers.results,
    report: { worker, from, to, ...summary },
  });
}
