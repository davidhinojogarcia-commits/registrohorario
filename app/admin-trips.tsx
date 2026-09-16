"use client";

import { useCallback, useEffect, useState } from "react";
import { CarFront, Loader2, MapPin, Route } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Trip = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: "active" | "completed" | "cancelled";
  distance_meters: number;
  point_count: number;
  purpose: string;
  first_name: string;
  last_name: string;
  worksite_name: string;
};

function distance(meters: number) {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;
}

function duration(startedAt: string, endedAt: string | null) {
  const end = endedAt ? new Date(endedAt) : new Date();
  const minutes = Math.max(0, Math.floor((end.getTime() - new Date(startedAt).getTime()) / 60_000));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export function AdminTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/trips?days=30", { cache: "no-store" });
    const data = await response.json() as { trips?: Trip[] };
    if (response.ok) setTrips(data.trips ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalMeters = trips.reduce((sum, trip) => sum + trip.distance_meters, 0);

  return <Card className="mt-5 border-slate-200 shadow-none dark:border-slate-800">
    <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Route className="size-5" /> Trayectos</CardTitle><CardDescription>Desplazamientos laborales registrados durante los últimos 30 días.</CardDescription></CardHeader>
    <CardContent>
      {loading ? <div className="grid min-h-28 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : <>
        <div className="mb-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border p-4"><p className="text-xs text-muted-foreground">Trayectos</p><p className="mt-1 text-2xl font-bold">{trips.length}</p></div><div className="rounded-2xl border p-4"><p className="text-xs text-muted-foreground">Distancia</p><p className="mt-1 text-2xl font-bold">{distance(totalMeters)}</p></div></div>
        {trips.length === 0 ? <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">Aún no hay trayectos registrados.</p> : <div className="space-y-2">{trips.slice(0, 20).map((trip) => <div key={trip.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{trip.first_name} {trip.last_name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {trip.worksite_name}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${trip.status === "active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{trip.status === "active" ? "En curso" : "Finalizado"}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Distancia</p><p className="font-medium">{distance(trip.distance_meters)}</p></div><div><p className="text-xs text-muted-foreground">Duración</p><p className="font-medium">{duration(trip.started_at, trip.ended_at)}</p></div><div><p className="text-xs text-muted-foreground">GPS</p><p className="font-medium">{trip.point_count} puntos</p></div></div><p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><CarFront className="size-3" /> {new Date(trip.started_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p></div>)}</div>}
      </>}
    </CardContent>
  </Card>;
}
