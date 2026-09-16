import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

type EventType = "entry" | "pause" | "resume" | "exit";
type WorkerState = "working" | "paused" | "finished" | "idle";
type WorkerRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  worksite_name: string | null;
  event_type: EventType | null;
  occurred_at: string | null;
};
type EventRow = { worker_id: string; event_type: EventType; occurred_at: string };

function workedMinutes(events: EventRow[]) {
  let totalMs = 0;
  let startedAt: number | null = null;
  for (const event of events) {
    const timestamp = new Date(event.occurred_at).getTime();
    if (event.event_type === "entry" || event.event_type === "resume") startedAt = timestamp;
    if ((event.event_type === "pause" || event.event_type === "exit") && startedAt !== null) {
      totalMs += Math.max(0, timestamp - startedAt);
      startedAt = null;
    }
  }
  if (startedAt !== null) totalMs += Math.max(0, Date.now() - startedAt);
  return Math.floor(totalMs / 60_000);
}

export async function GET() {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });

  const db = getRawDb();
  const company = await db.prepare("SELECT id, name FROM companies WHERE owner_user_id = ? LIMIT 1")
    .bind(supervisor.id)
    .first<{ id: string; name: string }>();

  if (!company) {
    return NextResponse.json({ company: null, workers: [], totals: { working: 0, paused: 0, finished: 0, idle: 0 } });
  }

  const [workers, events] = await Promise.all([
    db.prepare(`
      SELECT
        w.id,
        w.first_name,
        w.last_name,
        w.role,
        ws.name AS worksite_name,
        last_event.event_type,
        last_event.occurred_at
      FROM workers w
      LEFT JOIN assignments a ON a.worker_id = w.id AND a.active = true
      LEFT JOIN worksites ws ON ws.id = a.worksite_id
      LEFT JOIN LATERAL (
        SELECT ce.event_type, ce.occurred_at
        FROM clock_events ce
        WHERE ce.worker_id = w.id
          AND (ce.occurred_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date
        ORDER BY ce.occurred_at DESC
        LIMIT 1
      ) last_event ON true
      WHERE w.company_id = ? AND w.active = true
      ORDER BY w.first_name, w.last_name
    `).bind(company.id).all<WorkerRow>(),
    db.prepare(`
      SELECT worker_id, event_type, occurred_at
      FROM clock_events
      WHERE company_id = ?
        AND (occurred_at AT TIME ZONE 'Europe/Madrid')::date = (NOW() AT TIME ZONE 'Europe/Madrid')::date
      ORDER BY worker_id, occurred_at ASC
    `).bind(company.id).all<EventRow>(),
  ]);

  const eventsByWorker = new Map<string, EventRow[]>();
  for (const event of events.results) {
    const list = eventsByWorker.get(event.worker_id) ?? [];
    list.push(event);
    eventsByWorker.set(event.worker_id, list);
  }

  const mapped = workers.results.map((worker) => {
    const state: WorkerState = worker.event_type === "entry" || worker.event_type === "resume"
      ? "working"
      : worker.event_type === "pause"
        ? "paused"
        : worker.event_type === "exit"
          ? "finished"
          : "idle";
    return { ...worker, state, worked_minutes: workedMinutes(eventsByWorker.get(worker.id) ?? []) };
  });

  const totals = mapped.reduce((acc, worker) => {
    acc[worker.state] += 1;
    return acc;
  }, { working: 0, paused: 0, finished: 0, idle: 0 } as Record<WorkerState, number>);

  return NextResponse.json({ company, workers: mapped, totals });
}
