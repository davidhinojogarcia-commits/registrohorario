"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clock3,
  Coffee,
  HardHat,
  History,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InstallAppButton } from "@/app/install-app-button";
import { TripTracker } from "@/app/trabajador/trip-tracker";

type EventType = "entry" | "pause" | "resume" | "exit";
type ClockEvent = { id: string; event_type: EventType; occurred_at: string; location_status: string; integrity_hash: string };
type WorkerData = { session: { first_name: string; last_name: string; role: string; worksite_name: string; worksite_address: string }; events: ClockEvent[] };
const labels: Record<EventType, string> = { entry: "Entrada", pause: "Inicio de pausa", resume: "Fin de pausa", exit: "Salida" };

function workedMilliseconds(events: ClockEvent[], now: Date) {
  let total = 0;
  let startedAt: Date | null = null;
  for (const event of events) {
    if (event.event_type === "entry" || event.event_type === "resume") startedAt = new Date(event.occurred_at);
    if ((event.event_type === "pause" || event.event_type === "exit") && startedAt) {
      total += new Date(event.occurred_at).getTime() - startedAt.getTime();
      startedAt = null;
    }
  }
  if (startedAt) total += now.getTime() - startedAt.getTime();
  return Math.max(total, 0);
}

function formatDuration(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function WorkerClock() {
  const [data, setData] = useState<WorkerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<EventType | null>(null);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/worker/me", { cache: "no-store" });
    const body = await response.json() as WorkerData & { error?: string };
    if (!response.ok) setError(body.error ?? "No se pudo abrir tu registro.");
    else { setData(body); setError(""); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [load]);

  const last = data?.events.at(-1)?.event_type;
  const state = last === "entry" || last === "resume" ? "working" : last === "pause" ? "paused" : last === "exit" ? "finished" : "idle";
  const status = state === "working" ? "Jornada en curso" : state === "paused" ? "Pausa activa" : state === "finished" ? "Jornada finalizada" : "Sin fichar";
  const primaryAction: EventType | null = state === "idle" ? "entry" : state === "paused" ? "resume" : state === "working" ? "exit" : null;
  const worked = useMemo(() => data ? workedMilliseconds(data.events, now) : 0, [data, now]);

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    setError("");
    let location: GeolocationPosition | null = null;
    if ("geolocation" in navigator) {
      location = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }));
    }
    const response = await fetch("/api/worker/clock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: pending,
        idempotencyKey: crypto.randomUUID(),
        clientOccurredAt: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: location ? { latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy } : null,
      }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) setError(body.error ?? "No se pudo guardar el marcaje.");
    else { setPending(null); await load(); }
    setSaving(false);
  }

  if (loading && !data) return <main className="grid min-h-screen place-items-center bg-[#0d1b2b] text-white"><div className="text-center"><Loader2 className="mx-auto size-8 animate-spin text-[#f6b718]" /><p className="mt-3 text-sm text-slate-300">Abriendo tu jornada…</p></div></main>;
  if (!data) return <main className="grid min-h-screen place-items-center bg-[#0d1b2b] p-4"><Card className="w-full max-w-md"><CardContent className="p-6 text-center"><ShieldCheck className="mx-auto size-9 text-amber-600" /><h1 className="mt-4 text-xl font-bold">Acceso necesario</h1><p className="mt-2 text-sm text-muted-foreground">{error || "Abre el enlace de invitación que te ha enviado la empresa."}</p><Button onClick={() => void load()} variant="outline" className="mt-5"><RefreshCw /> Volver a intentar</Button></CardContent></Card></main>;

  const primaryLabel = primaryAction === "entry" ? "Fichar entrada" : primaryAction === "resume" ? "Volver al trabajo" : primaryAction === "exit" ? "Fichar salida" : "Jornada completada";
  const PrimaryIcon = primaryAction === "entry" ? LogIn : primaryAction === "resume" ? BriefcaseBusiness : primaryAction === "exit" ? LogOut : Check;

  return <main className="min-h-screen bg-[#f4f6f8] text-slate-950 dark:bg-slate-950 dark:text-white">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0d1b2b] text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f6b718] text-[#102033]"><HardHat className="size-5" /></span>
        <div className="min-w-0 flex-1"><p className="truncate font-bold leading-tight">Control horario</p><p className="truncate text-xs text-slate-300">{data.session.worksite_name}</p></div>
        <InstallAppButton />
      </div>
    </header>

    <div className="mx-auto max-w-xl px-4 pb-10 pt-5">
      <section className="overflow-hidden rounded-[30px] bg-[#0d1b2b] text-white shadow-[0_22px_60px_rgba(13,27,43,.22)]">
        <div className="px-5 pb-5 pt-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><p className="text-sm text-slate-400">Hola, {data.session.first_name}</p><h1 className="mt-0.5 truncate text-xl font-bold">{data.session.first_name} {data.session.last_name}</h1><p className="mt-1 text-xs text-slate-400">{data.session.role}</p></div>
            <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${state === "working" ? "bg-emerald-400/15 text-emerald-300" : state === "paused" ? "bg-amber-400/15 text-amber-200" : state === "finished" ? "bg-sky-400/15 text-sky-200" : "bg-white/10 text-slate-300"}`}>{status}</div>
          </div>

          <div className="mt-8 text-center">
            <p className="font-mono text-[clamp(3.7rem,20vw,6.5rem)] font-bold leading-none tracking-[-.08em] tabular-nums">{now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="mt-2 text-sm capitalize text-slate-400">{now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><Clock3 className="size-4" /> Trabajado hoy</div><p className="mt-2 font-mono text-2xl font-bold tabular-nums">{formatDuration(worked)}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="flex items-center gap-2 text-xs text-slate-400"><History className="size-4" /> Marcajes</div><p className="mt-2 text-2xl font-bold">{data.events.length}</p></div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[.035] px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#f6b718]/15 text-[#f6b718]"><MapPin className="size-5" /></span><div className="min-w-0"><p className="truncate font-semibold">{data.session.worksite_name}</p><p className="mt-0.5 text-sm leading-snug text-slate-400">{data.session.worksite_address}</p></div></div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <Button onClick={() => primaryAction && setPending(primaryAction)} disabled={!primaryAction} className={`h-20 w-full rounded-[22px] text-base font-bold shadow-none ${primaryAction ? "bg-[#f6b718] text-[#102033] hover:bg-[#ffc83d]" : "bg-emerald-600 text-white disabled:opacity-100"}`}><PrimaryIcon className="size-6" /> {primaryLabel}</Button>

        {state === "working" && <Button onClick={() => setPending("pause")} variant="outline" className="mt-3 h-14 w-full rounded-2xl border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200"><Coffee /> Iniciar pausa</Button>}

        {state === "paused" && <p className="mt-3 flex items-center justify-center gap-2 text-sm text-amber-700 dark:text-amber-300"><TimerReset className="size-4" /> La jornada está pausada hasta que pulses “Volver al trabajo”.</p>}
        {state === "finished" && <p className="mt-3 flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Check className="size-4" /> La jornada de hoy está cerrada correctamente.</p>}
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      </section>

      <TripTracker />

      <section className="mt-5 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="flex w-full items-center justify-between px-5 py-4 text-left"><div><p className="font-semibold">Registro de hoy</p><p className="mt-0.5 text-xs text-muted-foreground">Consulta las horas que has fichado</p></div><ChevronDown className={`size-5 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} /></button>
        {historyOpen && <div className="border-t px-5 pb-2 dark:border-slate-800">{data.events.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Aún no hay marcajes.</p> : data.events.map((event) => <div key={event.id} className="flex items-center justify-between border-b py-3.5 last:border-0 dark:border-slate-800"><div><p className="text-sm font-medium">{labels[event.event_type]}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" /> {event.location_status === "captured" ? "Ubicación registrada" : "Sin ubicación"}</p></div><time className="font-mono text-sm font-semibold tabular-nums">{new Date(event.occurred_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>}
      </section>

      <p className="mx-auto mt-5 max-w-sm text-center text-xs leading-relaxed text-slate-500">Los fichajes solo solicitan GPS al confirmar. Los trayectos registran ubicación únicamente cuando el trabajador activa expresamente “Iniciar trayecto”.</p>
    </div>

    <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}><DialogContent className="rounded-3xl sm:max-w-md">{pending && <><DialogHeader><div className="mb-2 grid size-12 place-items-center rounded-2xl bg-[#f6b718]/20 text-[#9a6800]"><ShieldCheck className="size-6" /></div><DialogTitle>Confirmar {labels[pending].toLowerCase()}</DialogTitle><DialogDescription>La hora válida será la del servidor. Intentaremos registrar tu ubicación únicamente en este momento.</DialogDescription></DialogHeader><div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Obra</span><strong className="text-right">{data.session.worksite_name}</strong></div><div className="mt-2 flex justify-between gap-4"><span className="text-muted-foreground">GPS</span><strong>Solo en el fichaje</strong></div></div><DialogFooter><Button variant="outline" onClick={() => setPending(null)}>Cancelar</Button><Button onClick={confirm} disabled={saving} className="bg-[#102033] text-white hover:bg-[#1a334f]">{saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Confirmar fichaje</Button></DialogFooter></>}</DialogContent></Dialog>
  </main>;
}
