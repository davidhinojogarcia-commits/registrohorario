"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Worker = { id: string; first_name: string; last_name: string; role: string; active: boolean; worksite_id?: string | null };
type Worksite = { id: string; name: string; address: string; active: boolean };
type EventType = "entry" | "pause" | "resume" | "exit";
type ReportEvent = {
  id: string;
  event_type: EventType;
  occurred_at: string;
  worksite_name: string | null;
  adjusted?: boolean;
  adjustment_id?: string | null;
  adjustment_reason?: string | null;
  original_occurred_at?: string | null;
  original_event_type?: EventType | null;
  synthetic?: boolean;
};
type Adjustment = {
  id: string;
  worker_id: string;
  worksite_id: string;
  original_event_id: string | null;
  event_type: EventType;
  effective_at: string;
  reason: string;
  adjustment_type: "correction" | "missing_event";
  created_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  first_name: string;
  last_name: string;
  worksite_name: string;
  original_occurred_at: string | null;
  original_event_type: EventType | null;
};

const labels: Record<EventType, string> = { entry: "Entrada", pause: "Inicio pausa", resume: "Fin pausa", exit: "Salida" };
function localInputValue(iso: string) { const d = new Date(iso); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }

export function AdminAdjustments() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [worksiteId, setWorksiteId] = useState("");
  const [mode, setMode] = useState<"correction" | "missing_event">("correction");
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [eventType, setEventType] = useState<EventType>("entry");
  const [effectiveAt, setEffectiveAt] = useState(localInputValue(new Date().toISOString()));
  const [reason, setReason] = useState("");
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadBase = useCallback(async () => {
    setLoading(true);
    const [manageResponse, adjustmentsResponse] = await Promise.all([
      fetch("/api/admin/manage", { cache: "no-store" }),
      fetch("/api/admin/adjustments", { cache: "no-store" }),
    ]);
    const manage = await manageResponse.json() as { workers?: Worker[]; worksites?: Worksite[]; error?: string };
    const adjustmentData = await adjustmentsResponse.json() as { adjustments?: Adjustment[]; error?: string };
    if (!manageResponse.ok || !adjustmentsResponse.ok) setError(manage.error ?? adjustmentData.error ?? "No se pudieron cargar las incidencias.");
    else {
      setWorkers(manage.workers ?? []);
      setWorksites(manage.worksites ?? []);
      setAdjustments(adjustmentData.adjustments ?? []);
      if (!workerId && manage.workers?.length) setWorkerId(manage.workers.find((worker) => worker.active)?.id ?? manage.workers[0].id);
      setError("");
    }
    setLoading(false);
  }, [workerId]);

  const loadWorkerEvents = useCallback(async (id: string) => {
    if (!id) { setEvents([]); return; }
    const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 30);
    const params = new URLSearchParams({ workerId: id, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    const response = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
    const data = await response.json() as { report?: { days: { events: ReportEvent[] }[] } | null };
    if (response.ok) setEvents((data.report?.days ?? []).flatMap((day) => day.events).filter((event) => !event.synthetic));
  }, []);

  useEffect(() => { void loadBase(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (workerId) void loadWorkerEvents(workerId); }, [workerId, loadWorkerEvents]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);
  useEffect(() => {
    if (!selectedEvent || mode !== "correction") return;
    setEventType(selectedEvent.event_type);
    setEffectiveAt(localInputValue(selectedEvent.occurred_at));
    const worker = workers.find((item) => item.id === workerId);
    if (worker?.worksite_id) setWorksiteId(worker.worksite_id);
  }, [selectedEvent, mode, workers, workerId]);

  async function save() {
    if (!workerId || !worksiteId || !effectiveAt || reason.trim().length < 5 || (mode === "correction" && !eventId)) {
      setError("Completa trabajador, obra, fichaje, fecha/hora y un motivo de al menos 5 caracteres."); return;
    }
    setSaving(true); setError("");
    const response = await fetch("/api/admin/adjustments", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", workerId, worksiteId, originalEventId: mode === "correction" ? eventId : null, eventType, effectiveAt: new Date(effectiveAt).toISOString(), reason }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) setError(data.error ?? "No se pudo guardar el ajuste.");
    else { setReason(""); setEventId(""); await loadBase(); await loadWorkerEvents(workerId); }
    setSaving(false);
  }

  async function revoke(id: string) {
    const revokeReason = window.prompt("Motivo de revocación de este ajuste:");
    if (!revokeReason || revokeReason.trim().length < 5) return;
    const response = await fetch("/api/admin/adjustments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", id, reason: revokeReason }) });
    if (response.ok) { await loadBase(); await loadWorkerEvents(workerId); }
  }

  return <section id="incidencias" className="mt-5 scroll-mt-24">
    <Card className="border-slate-200 shadow-none dark:border-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="size-5" /> Incidencias y correcciones</CardTitle><CardDescription>Corrige una hora o añade un fichaje olvidado sin modificar nunca el registro original. Todo queda auditado.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><div className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>Una corrección cambia el cálculo del informe, pero conserva la hora original, el GPS y la huella de integridad del fichaje.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={mode} onValueChange={(value) => { setMode(value as "correction" | "missing_event"); setEventId(""); }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="correction">Corregir fichaje existente</SelectItem><SelectItem value="missing_event">Añadir fichaje olvidado</SelectItem></SelectContent></Select>
          <Select value={workerId} onValueChange={(value) => { setWorkerId(value); setEventId(""); const worker = workers.find((item) => item.id === value); if (worker?.worksite_id) setWorksiteId(worker.worksite_id); }}><SelectTrigger className="w-full"><SelectValue placeholder="Trabajador" /></SelectTrigger><SelectContent>{workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.first_name} {worker.last_name}</SelectItem>)}</SelectContent></Select>
          <Select value={worksiteId} onValueChange={setWorksiteId}><SelectTrigger className="w-full"><SelectValue placeholder="Obra" /></SelectTrigger><SelectContent>{worksites.filter((site) => site.active).map((site) => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}</SelectContent></Select>
        </div>

        {mode === "correction" && <Select value={eventId} onValueChange={setEventId}><SelectTrigger className="w-full"><SelectValue placeholder="Selecciona el fichaje original de los últimos 30 días" /></SelectTrigger><SelectContent>{events.map((event) => <SelectItem key={event.id} value={event.id}>{new Date(event.occurred_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {labels[event.event_type]}{event.adjusted ? " · ya ajustado" : ""}</SelectItem>)}</SelectContent></Select>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[.7fr_1fr_2fr_auto]">
          <Select value={eventType} onValueChange={(value) => setEventType(value as EventType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Input type="datetime-local" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} />
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo: olvido, error de hora, incidencia..." />
          <Button onClick={() => void save()} disabled={saving} className="bg-[#102033] text-white hover:bg-[#1a334f]">{saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar</Button>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

        <div><h3 className="mb-2 text-sm font-semibold">Historial de ajustes</h3>{loading ? <div className="grid min-h-20 place-items-center"><Loader2 className="animate-spin" /></div> : adjustments.length === 0 ? <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">No hay incidencias registradas.</p> : <div className="space-y-2">{adjustments.slice(0, 50).map((adjustment) => <div key={adjustment.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{adjustment.first_name} {adjustment.last_name}</p><span className={`rounded-full px-2 py-0.5 text-xs ${adjustment.revoked_at ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-800"}`}>{adjustment.revoked_at ? "Revocado" : adjustment.adjustment_type === "missing_event" ? "Fichaje añadido" : "Corrección"}</span></div><p className="mt-1 text-sm">{labels[adjustment.event_type]} · {new Date(adjustment.effective_at).toLocaleString("es-ES")} · {adjustment.worksite_name}</p>{adjustment.original_occurred_at && <p className="mt-1 text-xs text-muted-foreground">Original: {labels[adjustment.original_event_type ?? adjustment.event_type]} · {new Date(adjustment.original_occurred_at).toLocaleString("es-ES")}</p>}<p className="mt-2 text-sm text-muted-foreground">Motivo: {adjustment.reason}</p>{adjustment.revoked_reason && <p className="mt-1 text-xs text-muted-foreground">Revocación: {adjustment.revoked_reason}</p>}</div>{!adjustment.revoked_at && <Button variant="outline" size="sm" onClick={() => void revoke(adjustment.id)}><RotateCcw /> Revocar</Button>}</div></div>)}</div>}</div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> Los informes usan la hora efectiva del ajuste activo y siguen mostrando el fichaje original.</p>
      </CardContent>
    </Card>
  </section>;
}
