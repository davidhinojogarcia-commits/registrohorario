"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { HardHat, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo completar el acceso.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const register = mode === "register";
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
    <Card className="w-full max-w-md border-slate-200 shadow-xl dark:border-slate-800">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-[#102033] text-[#f6b718]"><HardHat /></div>
        <CardTitle>{register ? "Crear cuenta del supervisor" : "Acceso del supervisor"}</CardTitle>
        <CardDescription>{register ? "Configuración inicial de Control de obra." : "Accede a tu panel privado de control horario."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          {register && <div><label className="mb-1.5 block text-sm font-medium" htmlFor="name">Nombre</label><Input id="name" name="name" autoComplete="name" required /></div>}
          <div><label className="mb-1.5 block text-sm font-medium" htmlFor="email">Correo electrónico</label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div><label className="mb-1.5 block text-sm font-medium" htmlFor="password">Contraseña</label><Input id="password" name="password" type="password" minLength={register ? 10 : undefined} autoComplete={register ? "new-password" : "current-password"} required /></div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <Button className="h-12 w-full bg-[#102033] text-white hover:bg-[#1a334f]" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}{register ? "Crear cuenta y entrar" : "Entrar"}</Button>
        </form>
        {!register && <p className="mt-5 text-center text-xs text-muted-foreground">Acceso exclusivo del responsable. Los trabajadores entran mediante su invitación y PIN.</p>}
      </CardContent>
    </Card>
  </main>;
}
