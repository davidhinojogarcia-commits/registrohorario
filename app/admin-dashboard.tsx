"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Coffee, HardHat, Loader2, MapPin, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminManagement } from "@/app/admin-management";

type WorkerState = "working" | "paused" | "finished" | "idle";
type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  worksite_name: string | null;
  event_type: "entry" | "pause" | "resume" | "exit" | null;
  occurred_at: string | null;
  worked_minutes: number;
  state: WorkerState;
};
type Overview = {
  company: { id: string; name: string } | null;
  workers: Worker[];
  totals: Record<WorkerState, number>;
};

const stateLabel: Record<WorkerState, string> = {
  working: "Trabajando",
  paused: "En pausa",
  finished: "Jornada finalizada",
  idle: "Sin fichar",
};

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function AdminDashboard({ displayName }: { displayName: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    const data = await response.json() as Overview & { error?: string };
    if (!response.ok) setError(data.error ?? "No se pudo cargar el resumen.");
    else { setOverview(data); setError(""); }
    setOverviewLoading(false);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadOverview(), 0);
    const timer = window.setInterval(() => void loadOverview(), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [loadOverview]);

  const activeNow = useMemo(() => (overview?.totals.working ?? 0) + (overview?.totals.paused ?? 0), [overview]);

  return <main className="min-h-screen bg-slate-50 text-foreground dark:bg-slate-950">
    <header className="border-b border-white/10 bg-[#102033] text-white"><div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f6b718] text-[#102033]"><HardHat className="size-5" /></span><div className="min-w-0"><p className="truncate font-bold leading-tight">Control de obra</p><p className="truncate text-xs text-slate-300">Hola, {displayName}</p></div></div><Button onClick={() => void loadOverview()} variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white"><RefreshCw className={overviewLoading ? "animate-spin" : ""} /><span className="hidden sm:inline">Actualizar</span></Button></div></header>

    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <section className="rounded-[28px] bg-[#102033] p-5 text-white shadow-[0_24px_70px_rgba(15,32,51,.18)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-300">Resumen de hoy</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{overview?.company?.name ?? "Configura tu empresa"}</h1><p className="mt-2 text-sm text-slate-300">{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p></div><Badge className="w-fit border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">{activeNow} activos ahora</Badge></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Trabajando", overview?.totals.working ?? 0, "bg-emerald-400"],
            ["En pausa", overview?.totals.paused ?? 0, "bg-amber-400"],
            ["Finalizados", overview?.totals.finished ?? 0, "bg-sky-400"],
            ["Sin fichar", overview?.totals.idle ?? 0, "bg-slate-400"],
          ].map(([label, value, dot]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center gap-2 text-xs text-slate-300"><span className={`size-2 rounded-full ${dot}`} />{label}</div><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
        </div>
      </section>

      <Card className="mt-5 border-slate-200 shadow-none dark:border-slate-800"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5" /> Personal de hoy</CardTitle><CardDescription>Estado, obra y tiempo trabajado acumulado. Se actualiza automáticamente cada minuto.</CardDescription></CardHeader><CardContent>
        {overviewLoading && !overview ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : overview?.workers.length ? <div className="grid gap-2 lg:grid-cols-2">{overview.workers.map((worker) => <div key={worker.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-start gap-3"><span className={`mt-1 size-3 shrink-0 rounded-full ${worker.state === "working" ? "bg-emerald-500" : worker.state === "paused" ? "bg-amber-400" : worker.state === "finished" ? "bg-sky-400" : "bg-slate-300"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{worker.first_name} {worker.last_name}</p><p className="text-xs text-muted-foreground">{worker.role}</p></div><p className="text-sm font-semibold">{formatMinutes(worker.worked_minutes ?? 0)}</p></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{stateLabel[worker.state]}</span>{worker.worksite_name && <span className="flex items-center gap-1"><MapPin className="size-3" />{worker.worksite_name}</span>}{worker.occurred_at && <span>Último fichaje {new Date(worker.occurred_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}</div></div></div></div>)}</div> : <div className="rounded-2xl border border-dashed p-6 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">Aún no hay trabajadores activos</p><p className="mt-1 text-sm text-muted-foreground">Configura la empresa, crea una obra y añade el primer trabajador.</p></div>}
      </CardContent></Card>

      <AdminManagement onChanged={() => void loadOverview()} />

      <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950"><Clock3 className="size-4 text-muted-foreground" /><p className="mt-2 font-medium">Hora del servidor</p><p className="mt-1 text-xs text-muted-foreground">Los fichajes no dependen de la hora configurada en el móvil.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950"><Coffee className="size-4 text-muted-foreground" /><p className="mt-2 font-medium">Pausas separadas</p><p className="mt-1 text-xs text-muted-foreground">El tiempo trabajado excluye las pausas registradas.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950"><MapPin className="size-4 text-muted-foreground" /><p className="mt-2 font-medium">GPS puntual</p><p className="mt-1 text-xs text-muted-foreground">Solo se solicita al confirmar un fichaje.</p></div></div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    </div>
  </main>;
}
