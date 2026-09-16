"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Clock3, Loader2, PauseCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Worker = { id: string; first_name: string; last_name: string; role: string; active: boolean };
type EventType = "entry" | "pause" | "resume" | "exit";
type Day = {
  date: string;
  workedMinutes: number;
  pauseMinutes: number;
  firstEntry: string | null;
  lastExit: string | null;
  worksiteNames: string[];
  events: { id: string; event_type: EventType; occurred_at: string; location_status: string; worksite_name: string | null }[];
};
type ReportResponse = {
  company: { id: string; name: string } | null;
  workers: Worker[];
  report: null | {
    worker: Worker;
    from: string;
    to: string;
    days: Day[];
    totals: { workedMinutes: number; pauseMinutes: number; daysWithRecords: number; eventCount: number };
  };
  error?: string;
};

const eventLabel: Record<EventType, string> = { entry: "Entrada", pause: "Inicio pausa", resume: "Fin pausa", exit: "Salida" };

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function formatMinutes(total: number) { const h = Math.floor(total / 60); const m = total % 60; return `${h} h ${String(m).padStart(2, "0")} min`; }
function range(days: number) { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - (days - 1)); return { from: iso(from), to: iso(to) }; }
function monthRange() { const now = new Date(); return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }; }

export function AdminReports() {
  const initial = range(14);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<ReportResponse["report"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(null);

  const load = useCallback(async (selectedWorkerId = workerId, selectedFrom = from, selectedTo = to) => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (selectedWorkerId) params.set("workerId", selectedWorkerId);
    params.set("from", selectedFrom); params.set("to", selectedTo);
    const response = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
    const data = await response.json() as ReportResponse;
    if (!response.ok) setError(data.error ?? "No se pudo generar el informe.");
    else {
      setWorkers(data.workers ?? []);
      if (!selectedWorkerId && data.workers?.length) {
        const first = data.workers.find((worker) => worker.active) ?? data.workers[0];
        setWorkerId(first.id);
        setLoading(false);
        await load(first.id, selectedFrom, selectedTo);
        return;
      }
      setReport(data.report);
    }
    setLoading(false);
  }, [workerId, from, to]);

  useEffect(() => { const timer = window.setTimeout(() => void load("", from, to), 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(kind: "week" | "fortnight" | "month") {
    const next = kind === "week" ? range(7) : kind === "fortnight" ? range(14) : monthRange();
    setFrom(next.from); setTo(next.to); void load(workerId, next.from, next.to);
  }

  const selectedWorker = useMemo(() => workers.find((worker) => worker.id === workerId), [workers, workerId]);

  return <section className="mt-5">
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="size-5" /> Informes e histórico</CardTitle>
        <CardDescription>Consulta horas trabajadas, pausas y fichajes originales por trabajador y periodo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={workerId} onValueChange={(value) => { setWorkerId(value); void load(value, from, to); }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona trabajador" /></SelectTrigger>
              <SelectContent>{workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.first_name} {worker.last_name}{worker.active ? "" : " · inactivo"}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <Button onClick={() => void load()} disabled={loading || !workerId} className="bg-[#102033] text-white hover:bg-[#1a334f]"><RefreshCw className={loading ? "animate-spin" : ""} /> Consultar</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset("week")}>7 días</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("fortnight")}>Quincena</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("month")}>Este mes</Button>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        {loading && !report ? <div className="grid min-h-32 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : report ? <>
          <div className="rounded-2xl bg-[#102033] p-5 text-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-300">{selectedWorker?.first_name} {selectedWorker?.last_name}</p><p className="mt-1 text-2xl font-bold">{formatMinutes(report.totals.workedMinutes)}</p><p className="text-xs text-slate-300">Horas netas trabajadas</p></div><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">Pausas</p><p className="mt-1 font-semibold">{formatMinutes(report.totals.pauseMinutes)}</p></div><div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-slate-300">Días</p><p className="mt-1 font-semibold">{report.totals.daysWithRecords}</p></div><div className="col-span-2 rounded-xl bg-white/10 p-3 sm:col-span-1"><p className="text-xs text-slate-300">Fichajes</p><p className="mt-1 font-semibold">{report.totals.eventCount}</p></div></div></div>
          </div>

          <div className="space-y-2">{report.days.length ? report.days.map((day) => <div key={day.date} className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <button type="button" onClick={() => setOpenDay(openDay === day.date ? null : day.date)} className="flex w-full items-center gap-3 p-4 text-left">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{new Date(`${day.date}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</p><p className="font-semibold">{formatMinutes(day.workedMinutes)}</p></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><PauseCircle className="size-3" />{formatMinutes(day.pauseMinutes)} de pausa</span>{day.worksiteNames.length > 0 && <span>{day.worksiteNames.join(" · ")}</span>}{day.firstEntry && <span>Entrada {new Date(day.firstEntry).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}{day.lastExit && <span>Salida {new Date(day.lastExit).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}</div></div>{openDay === day.date ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            {openDay === day.date && <div className="border-t px-4 py-2">{day.events.map((event) => <div key={event.id} className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-0"><div><p>{eventLabel[event.event_type]}</p><p className="text-xs text-muted-foreground">{event.worksite_name ?? "Sin obra"} · {event.location_status === "captured" ? "GPS registrado" : "sin GPS"}</p></div><time className="font-mono font-semibold">{new Date(event.occurred_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>}
          </div>) : <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-2 size-6" />No hay fichajes en este periodo.</div>}</div>
        </> : <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Añade un trabajador para consultar informes.</div>}
      </CardContent>
    </Card>
  </section>;
}
