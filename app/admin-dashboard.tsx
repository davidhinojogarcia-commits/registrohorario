"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Clock3, Coffee, Copy, HardHat, Link2, Loader2, MapPin, RefreshCw, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Setup = { company: { name: string }; worker: { name: string }; invitationUrl: string; expiresAt: string };
type WorkerState = "working" | "paused" | "finished" | "idle";
type Worker = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  worksite_name: string | null;
  event_type: "entry" | "pause" | "resume" | "exit" | null;
  occurred_at: string | null;
  state: WorkerState;
  worked_seconds: number;
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

function formatWorked(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function AdminDashboard({ displayName }: { displayName: string }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  async function prepareAccess() {
    setLoading(true); setError("");
    const response = await fetch("/api/admin/bootstrap", { method: "POST" });
    const data = await response.json() as Setup & { error?: string };
    if (!response.ok) setError(data.error ?? "No se pudo preparar el acceso.");
    else { setSetup(data); await loadOverview(); }
    setLoading(false);
  }

  async function copyLink() {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.invitationUrl);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  const activeNow = useMemo(() => (overview?.totals.working ?? 0) + (overview?.totals.paused ?? 0), [overview]);

  return <main className="min-h-screen bg-slate-50 text-foreground dark:bg-slate-950">
    <header className="border-b border-white/10 bg-[#102033] text-white"><div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f6b718] text-[#102033]"><HardHat className="size-5" /></span><div className="min-w-0"><p className="truncate font-bold leading-tight">Control de obra</p><p className="truncate text-xs text-slate-300">Hola, {displayName}</p></div></div><Button onClick={() => void loadOverview()} variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white"><RefreshCw className={overviewLoading ? "animate-spin" : ""} /><span className="hidden sm:inline">Actualizar</span></Button></div></header>

    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <section className="rounded-[28px] bg-[#102033] p-5 text-white shadow-[0_24px_70px_rgba(15,32,51,.18)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-300">Resumen de hoy</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{overview?.company?.name ?? "Tu empresa"}</h1><p className="mt-2 text-sm text-slate-300">{new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p></div><Badge className="w-fit border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">{activeNow} activos ahora</Badge></div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Trabajando", overview?.totals.working ?? 0, "bg-emerald-400"],
            ["En pausa", overview?.totals.paused ?? 0, "bg-amber-400"],
            ["Finalizados", overview?.totals.finished ?? 0, "bg-sky-400"],
            ["Sin fichar", overview?.totals.idle ?? 0, "bg-slate-400"],
          ].map(([label, value, dot]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center gap-2 text-xs text-slate-300"><span className={`size-2 rounded-full ${dot}`} />{label}</div><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <section className="space-y-4">
          <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5" /> Personal de hoy</CardTitle><CardDescription>Estado actual y tiempo trabajado acumulado. Se actualiza automáticamente cada minuto.</CardDescription></CardHeader><CardContent>
            {overviewLoading && !overview ? <div className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : overview?.workers.length ? <div className="space-y-2">{overview.workers.map((worker) => <div key={worker.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"><span className={`size-3 shrink-0 rounded-full ${worker.state === "working" ? "bg-emerald-500" : worker.state === "paused" ? "bg-amber-400" : worker.state === "finished" ? "bg-sky-400" : "bg-slate-300"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="truncate font-semibold">{worker.first_name} {worker.last_name}</p><p className="text-xs text-muted-foreground">{worker.role}</p></div><div className="rounded-xl bg-slate-100 px-3 py-1.5 text-right dark:bg-slate-900"><p className="font-mono text-sm font-bold tabular-nums">{formatWorked(worker.worked_seconds)}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">hoy</p></div></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{stateLabel[worker.state]}</span>{worker.worksite_name && <span className="flex items-center gap-1"><MapPin className="size-3" />{worker.worksite_name}</span>}{worker.occurred_at && <span>Último fichaje {new Date(worker.occurred_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}</div></div></div>)}</div> : <div className="rounded-2xl border border-dashed p-6 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">Aún no hay trabajadores</p><p className="mt-1 text-sm text-muted-foreground">Prepara el primer acceso para crear el entorno inicial.</p></div>}
          </CardContent></Card>
        </section>

        <aside className="space-y-4">
          <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Smartphone className="size-4" /> Acceso de trabajador</CardTitle><CardDescription>Genera una invitación temporal para activar el móvil con PIN.</CardDescription></CardHeader><CardContent>
            {!setup ? <Button onClick={prepareAccess} disabled={loading} className="h-12 w-full bg-[#102033] text-white hover:bg-[#1a334f]">{loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Preparar acceso</Button> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-5" /></span><div><p className="font-semibold">Invitación preparada</p><p className="text-sm text-muted-foreground">{setup.worker.name}</p></div></div><Button onClick={copyLink} variant="outline" className="mt-4 h-11 w-full">{copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar enlace"}</Button><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Link2 className="size-3.5" /> Válida hasta {new Date(setup.expiresAt).toLocaleDateString("es-ES")}</p></div>}
          </CardContent></Card>

          <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4" /> Control pensado para obra</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p className="flex gap-2"><Clock3 className="mt-0.5 size-4 shrink-0" />Hora obtenida del servidor.</p><p className="flex gap-2"><Coffee className="mt-0.5 size-4 shrink-0" />Entrada, pausa, reanudación y salida.</p><p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />GPS solo en el momento del fichaje.</p></CardContent></Card>
        </aside>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    </div>
  </main>;
}
