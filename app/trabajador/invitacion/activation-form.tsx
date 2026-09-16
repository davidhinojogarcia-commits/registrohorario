"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HardHat, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ActivationForm({ token }: { token: string }) {
  const router = useRouter(); const [pin, setPin] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function activate() { setLoading(true); setError(""); const response = await fetch("/api/worker/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, pin }) }); const data = await response.json() as { error?: string }; if (!response.ok) { setError(data.error ?? "No se pudo activar el acceso."); setLoading(false); return; } router.replace("/trabajador"); }
  return <main className="grid min-h-screen place-items-center bg-[#102033] p-4 text-white"><section className="w-full max-w-md rounded-[28px] bg-white p-6 text-[#102033] shadow-2xl sm:p-8"><span className="grid size-12 place-items-center rounded-2xl bg-[#f6b718]"><HardHat className="size-6" /></span><h1 className="mt-6 text-2xl font-bold tracking-tight">Activa tu acceso</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Introduce tu PIN personal de 6 cifras. Si es tu primer acceso, este será el PIN que utilizarás para proteger tus fichajes.</p><div className="mt-6"><Label htmlFor="pin">PIN personal</Label><Input id="pin" className="mt-2 h-14 text-center font-mono text-2xl tracking-[.35em]" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" /></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<Button onClick={activate} disabled={pin.length !== 6 || loading} className="mt-5 h-13 w-full bg-[#102033] text-white hover:bg-[#1a334f]">{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Confirmar PIN y entrar</Button><p className="mt-5 flex gap-2 text-xs leading-relaxed text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> El enlace no contiene tu DNI ni otros datos personales. Tu PIN no se guarda de forma legible.</p></section></main>;
}
