"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellRing, Clock3, Info, Loader2, MapPin, Route } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

type ResponseBody = {
  alerts: Alert[];
  totals: { critical: number; warning: number; info: number };
  error?: string;
};

const iconForKind = {
  no_clock: Clock3,
  long_shift: AlertTriangle,
  long_pause: Clock3,
  no_gps: MapPin,
  long_trip: Route,
};

export function AdminAlerts() {
  const [data, setData] = useState<ResponseBody>({ alerts: [], totals: { critical: 0, warning: 0, info: 0 } });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/alerts", { cache: "no-store" });
    const body = await response.json() as ResponseBody;
    if (response.ok) setData(body);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <Card className="mt-5 border-slate-200 shadow-none dark:border-slate-800">
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><BellRing className="size-5" /> Alertas de hoy</CardTitle>
          <CardDescription className="mt-1">Revisión automática de fichajes, pausas, GPS y trayectos activos.</CardDescription>
        </div>
        <div className="flex gap-2 text-xs">
          {data.totals.critical > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">{data.totals.critical} críticas</span>}
          {data.totals.warning > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">{data.totals.warning} avisos</span>}
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {loading && data.alerts.length === 0 ? <div className="grid min-h-28 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : data.alerts.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center"><BellRing className="mx-auto size-7 text-emerald-600" /><p className="mt-2 font-medium">Sin alertas relevantes</p><p className="mt-1 text-sm text-muted-foreground">No se han detectado situaciones que requieran revisión ahora mismo.</p></div> : <div className="space-y-2">{data.alerts.map((alert) => {
        const Icon = iconForKind[alert.kind];
        const styles = alert.severity === "critical"
          ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
          : alert.severity === "warning"
            ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"
            : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900";
        const iconStyles = alert.severity === "critical" ? "text-red-600" : alert.severity === "warning" ? "text-amber-600" : "text-slate-500";
        return <div key={alert.id} className={`rounded-2xl border p-4 ${styles}`}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 dark:bg-slate-950/60"><Icon className={`size-4 ${iconStyles}`} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{alert.title}</p><p className="text-sm">{alert.workerName}</p></div>{alert.severity === "critical" && <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Revisar</span>}</div>
              <p className="mt-2 text-sm text-muted-foreground">{alert.detail}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{alert.worksiteName && <span className="flex items-center gap-1"><MapPin className="size-3" />{alert.worksiteName}</span>}{alert.occurredAt && <span>{new Date(alert.occurredAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}</div>
            </div>
          </div>
        </div>;
      })}</div>}
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> “Sin fichar” se muestra solo como información y no implica ausencia laboral; debe contrastarse con la planificación de la jornada.</p>
    </CardContent>
  </Card>;
}
