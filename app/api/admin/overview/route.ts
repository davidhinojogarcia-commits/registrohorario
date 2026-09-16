import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

type WorkerRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  worksite_name: string | null;
  event_type: "entry" | "pause" | "resume" | "exit" | null;
  occurred_at: string | null;
};

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

  const workers = await db.prepare(`
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
        AND ce.occurred_at::date = CURRENT_DATE
      ORDER BY ce.occurred_at DESC
      LIMIT 1
    ) last_event ON true
    WHERE w.company_id = ? AND w.active = true
    ORDER BY w.first_name, w.last_name
  `).bind(company.id).all<WorkerRow>();

  const mapped = workers.results.map((worker) => {
    const state = worker.event_type === "entry" || worker.event_type === "resume"
      ? "working"
      : worker.event_type === "pause"
        ? "paused"
        : worker.event_type === "exit"
          ? "finished"
          : "idle";
    return { ...worker, state };
  });

  const totals = mapped.reduce((acc, worker) => {
    acc[worker.state] += 1;
    return acc;
  }, { working: 0, paused: 0, finished: 0, idle: 0 });

  return NextResponse.json({ company, workers: mapped, totals });
}
