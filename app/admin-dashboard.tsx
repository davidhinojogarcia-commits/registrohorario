"use client";

import { useState } from "react";
import { Building2, Check, Clock3, Copy, HardHat, Link2, Loader2, LockKeyhole, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Setup = { company: { name: string }; worker: { name: string }; invitationUrl: string; expiresAt: string };

export function AdminDashboard({ displayName }: { displayName: string }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function prepareAccess() {
    setLoading(true); setError("");
    const response = await fetch("/api/admin/bootstrap", { method: "POST" });
    const data = await response.json() as Setup & { error?: string };
    if (!response.ok) setError(data.error ?? "No se pudo preparar el acceso.");
    else setSetup(data);
    setLoading(false);
  }

  async function copyLink() {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.invitationUrl);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b border-white/10 bg-[#102033] text-white"><div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f6b718] text-[#102033]"><HardHat className="size-5" /></span><div><p className="font-bold leading-tight">Control de obra</p><p className="text-xs text-slate-300">Panel de empresa</p></div></div><Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">Plan sin coste</Badge></div></header>
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10"><div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <section><p className="text-sm font-medium text-[#a76f00] dark:text-[#f6b718]">Primera configuración</p><h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Acceso móvil seguro para tus trabajadores</h1><p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Hola, {displayName}. La base de datos de esta aplicación está separada de Profea y no necesita contratar Supabase.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">{[{ icon: Building2, title: "Empresa separada", text: "Datos propios de esta app." }, { icon: LockKeyhole, title: "Invitación segura", text: "Enlace temporal y PIN." }, { icon: Smartphone, title: "Desde el móvil", text: "Entrada, pausa y salida." }].map((item) => <Card key={item.title} className="gap-3 border-slate-200 py-5 shadow-none dark:border-slate-800"><CardContent className="px-5"><item.icon className="size-5 text-[#a76f00] dark:text-[#f6b718]" /><p className="mt-4 font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.text}</p></CardContent></Card>)}</div>
        <Card className="mt-6 border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5" /> Acceso de prueba</CardTitle><CardDescription>Crea una empresa, una obra y un trabajador ficticios para probar el recorrido completo.</CardDescription></CardHeader><CardContent>
          {!setup ? <div><Button onClick={prepareAccess} disabled={loading} className="h-12 bg-[#102033] px-5 text-white hover:bg-[#1a334f]">{loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Preparar acceso gratuito</Button>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}</div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-5" /></span><div><p className="font-semibold">Invitación preparada</p><p className="text-sm text-muted-foreground">{setup.worker.name} · válida hasta {new Date(setup.expiresAt).toLocaleDateString("es-ES")}</p></div></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1 truncate rounded-xl border bg-white px-4 py-3 text-sm dark:bg-slate-950">{setup.invitationUrl}</div><Button onClick={copyLink} variant="outline" className="h-11">{copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar enlace"}</Button></div><p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Link2 className="size-3.5" /> El trabajador establecerá un PIN personal de 6 cifras.</p></div>}
        </CardContent></Card>
      </section>
      <aside className="rounded-[28px] bg-[#102033] p-6 text-white shadow-[0_24px_70px_rgba(15,32,51,.18)] sm:p-7"><div className="flex items-center justify-between"><p className="font-semibold">Versión gratuita</p><Clock3 className="size-5 text-[#f6b718]" /></div><p className="mt-2 text-sm leading-relaxed text-slate-300">La primera versión utiliza el alojamiento y la base de datos incluidos. No activa SMS, WhatsApp, mapas de pago ni reconocimiento biométrico.</p><div className="mt-6 space-y-4">{["Hora obtenida del servidor", "Eventos originales inmutables", "Protección contra doble marcaje", "Historial con huella de integridad", "Sesión del trabajador protegida"].map((label) => <div key={label} className="flex gap-3 text-sm"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#f6b718] text-[#102033]"><Check className="size-3.5" /></span>{label}</div>)}</div><div className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">La aplicación permanece privada durante las pruebas. Se hará accesible a los trabajadores únicamente cuando el acceso por PIN esté validado.</div></aside>
    </div></div>
  </main>;
}
