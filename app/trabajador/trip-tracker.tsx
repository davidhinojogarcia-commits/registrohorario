"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CarFront, Loader2, MapPin, Navigation, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActiveTrip = {
  id: string;
  started_at: string;
  distance_meters: number;
  point_count: number;
  purpose: string;
};

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(startedAt: string, now: Date) {
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

export function TripTracker() {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());
  const watchId = useRef<number | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/worker/trips", { cache: "no-store" });
    const data = await response.json() as { activeTrip?: ActiveTrip | null; error?: string };
    if (response.ok) setTrip(data.activeTrip ?? null);
    else setError(data.error ?? "No se pudo consultar el trayecto.");
    setLoading(false);
  }, []);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const sendPoint = useCallback(async (tripId: string, position: GeolocationPosition) => {
    const response = await fetch("/api/worker/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "point",
        tripId,
        point: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        },
      }),
    });
    if (response.ok) {
      const data = await response.json() as { addedMeters?: number };
      setTrip((current) => current ? {
        ...current,
        distance_meters: current.distance_meters + (data.addedMeters ?? 0),
        point_count: current.point_count + 1,
      } : current);
    }
  }, []);

  const startWatch = useCallback((tripId: string) => {
    if (!("geolocation" in navigator) || watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (position) => void sendPoint(tripId, position),
      () => setError("No se puede actualizar la ruta. Comprueba el permiso de ubicación."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, [sendPoint]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => { window.clearInterval(timer); stopWatch(); };
  }, [load, stopWatch]);

  useEffect(() => {
    if (trip?.id) startWatch(trip.id);
    else stopWatch();
  }, [trip?.id, startWatch, stopWatch]);

  async function startTrip() {
    setSaving(true); setError("");
    if (!("geolocation" in navigator)) {
      setError("Este dispositivo no permite obtener ubicación.");
      setSaving(false);
      return;
    }
    const firstPosition = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
    });
    if (!firstPosition) {
      setError("Necesitamos permiso de ubicación para iniciar un trayecto.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/worker/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const data = await response.json() as { tripId?: string; startedAt?: string; error?: string };
    if (!response.ok || !data.tripId || !data.startedAt) {
      setError(data.error ?? "No se pudo iniciar el trayecto.");
      setSaving(false);
      return;
    }
    setTrip({ id: data.tripId, started_at: data.startedAt, distance_meters: 0, point_count: 0, purpose: "Desplazamiento de trabajo" });
    await sendPoint(data.tripId, firstPosition);
    startWatch(data.tripId);
    setSaving(false);
  }

  async function finishTrip() {
    if (!trip) return;
    setSaving(true); setError(""); stopWatch();
    const response = await fetch("/api/worker/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finish", tripId: trip.id }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo finalizar el trayecto.");
      startWatch(trip.id);
    } else setTrip(null);
    setSaving(false);
  }

  if (loading) return null;

  return <section className="mt-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><CarFront className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">Trayectos de trabajo</p><p className="mt-0.5 text-xs text-muted-foreground">Actívalo solo cuando quieras registrar un desplazamiento laboral.</p></div></div>

    {trip ? <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex items-center gap-2 text-sm font-semibold text-sky-800 dark:text-sky-200"><Navigation className="size-4" /> Trayecto en curso</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-muted-foreground">Distancia</p><p className="mt-1 font-semibold">{formatDistance(trip.distance_meters)}</p></div><div><p className="text-xs text-muted-foreground">Duración</p><p className="mt-1 font-semibold">{formatDuration(trip.started_at, now)}</p></div><div><p className="text-xs text-muted-foreground">Puntos GPS</p><p className="mt-1 font-semibold">{trip.point_count}</p></div></div>
      <Button onClick={finishTrip} disabled={saving} className="mt-4 h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">{saving ? <Loader2 className="animate-spin" /> : <Square className="size-4" />} Finalizar trayecto</Button>
    </div> : <Button onClick={startTrip} disabled={saving} variant="outline" className="mt-4 h-12 w-full rounded-xl">{saving ? <Loader2 className="animate-spin" /> : <MapPin />} Iniciar trayecto</Button>}

    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">La ruta solo se registra mientras el trayecto está activado y la web puede recibir ubicación del dispositivo.</p>
  </section>;
}
