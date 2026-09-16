"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Copy, HardHat, Link2, Loader2, Pencil, Plus, RefreshCw, UserPlus, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Worksite = { id: string; name: string; address: string; active: boolean };
type Worker = { id: string; first_name: string; last_name: string; role: string; active: boolean; worksite_id: string | null; worksite_name: string | null };
type ManagementData = { company: { id: string; name: string } | null; worksites: Worksite[]; workers: Worker[] };
type Invitation = { workerId: string; url: string; expiresAt: string } | null;

export function AdminManagement({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingWorksite, setEditingWorksite] = useState<Worksite | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [invitation, setInvitation] = useState<Invitation>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/manage", { cache: "no-store" });
    const body = await response.json() as ManagementData & { error?: string };
    if (!response.ok) setError(body.error ?? "No se pudo cargar la gestión.");
    else { setData(body); setError(""); }
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function action(payload: Record<string, unknown>) {
    setSaving(true); setError("");
    const response = await fetch("/api/admin/manage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { error?: string; invitationUrl?: string; expiresAt?: string };
    setSaving(false);
    if (!response.ok) { setError(body.error ?? "No se pudo guardar el cambio."); return null; }
    await load();
    onChanged();
    return body;
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({ action: "ensure_company", name: form.get("companyName") });
  }

  async function saveWorksite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(editingWorksite ? { action: "update_worksite", id: editingWorksite.id, name: form.get("name"), address: form.get("address"), active: true } : { action: "create_worksite", name: form.get("name"), address: form.get("address") });
    setEditingWorksite(null);
    event.currentTarget.reset();
  }

  async function saveWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(editingWorker ? { action: "update_worker", id: editingWorker.id, firstName: form.get("firstName"), lastName: form.get("lastName"), role: form.get("role"), worksiteId: form.get("worksiteId"), active: true } : { action: "create_worker", firstName: form.get("firstName"), lastName: form.get("lastName"), role: form.get("role"), worksiteId: form.get("worksiteId") });
    setEditingWorker(null);
    event.currentTarget.reset();
  }

  async function deactivateWorker(worker: Worker) {
    await action({ action: "update_worker", id: worker.id, firstName: worker.first_name, lastName: worker.last_name, role: worker.role, worksiteId: "", active: false });
  }

  async function deactivateWorksite(worksite: Worksite) {
    await action({ action: "update_worksite", id: worksite.id, name: worksite.name, address: worksite.address, active: false });
  }

  async function invite(worker: Worker) {
    const result = await action({ action: "invite_worker", workerId: worker.id });
    if (result?.invitationUrl && result.expiresAt) setInvitation({ workerId: worker.id, url: result.invitationUrl, expiresAt: result.expiresAt });
  }

  async function copyInvitation() {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const activeWorksites = useMemo(() => data?.worksites.filter((worksite) => worksite.active) ?? [], [data]);

  if (loading && !data) return <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardContent className="grid min-h-40 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></CardContent></Card>;

  return <section className="mt-5 space-y-5">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Gestión</h2><p className="text-sm text-muted-foreground">Obras, trabajadores, asignaciones e invitaciones.</p></div><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className={loading ? "animate-spin" : ""} /> Actualizar</Button></div>

    {!data?.company && <Card className="border-amber-200 bg-amber-50 shadow-none dark:border-amber-900 dark:bg-amber-950/30"><CardHeader><CardTitle className="text-base">Configura tu empresa</CardTitle><CardDescription>Este será el espacio privado al que pertenecerán tus obras y trabajadores.</CardDescription></CardHeader><CardContent><form onSubmit={saveCompany} className="flex flex-col gap-3 sm:flex-row"><Input name="companyName" placeholder="Nombre de la empresa" required className="h-11" /><Button disabled={saving} className="h-11 bg-[#102033] text-white hover:bg-[#1a334f]">{saving ? <Loader2 className="animate-spin" /> : <Check />} Guardar empresa</Button></form></CardContent></Card>}

    {data?.company && <>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4" /> {editingWorksite ? "Editar obra" : "Nueva obra"}</CardTitle><CardDescription>Nombre y ubicación de la obra o centro de trabajo.</CardDescription></CardHeader><CardContent><form key={editingWorksite?.id ?? "new-worksite"} onSubmit={saveWorksite} className="space-y-3"><Input name="name" defaultValue={editingWorksite?.name ?? ""} placeholder="Nombre de la obra" required /><Input name="address" defaultValue={editingWorksite?.address ?? ""} placeholder="Dirección" /><div className="flex gap-2"><Button disabled={saving} className="bg-[#102033] text-white hover:bg-[#1a334f]">{editingWorksite ? <Check /> : <Plus />} {editingWorksite ? "Guardar cambios" : "Crear obra"}</Button>{editingWorksite && <Button type="button" variant="outline" onClick={() => setEditingWorksite(null)}>Cancelar</Button>}</div></form></CardContent></Card>

        <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="size-4" /> {editingWorker ? "Editar trabajador" : "Nuevo trabajador"}</CardTitle><CardDescription>Asígnalo a una obra activa desde el primer momento.</CardDescription></CardHeader><CardContent><form key={editingWorker?.id ?? "new-worker"} onSubmit={saveWorker} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input name="firstName" defaultValue={editingWorker?.first_name ?? ""} placeholder="Nombre" required /><Input name="lastName" defaultValue={editingWorker?.last_name ?? ""} placeholder="Apellidos" required /></div><Input name="role" defaultValue={editingWorker?.role ?? "Trabajador"} placeholder="Puesto de trabajo" required /><select name="worksiteId" defaultValue={editingWorker?.worksite_id ?? ""} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Selecciona una obra</option>{activeWorksites.map((worksite) => <option key={worksite.id} value={worksite.id}>{worksite.name}</option>)}</select><div className="flex gap-2"><Button disabled={saving || activeWorksites.length === 0} className="bg-[#102033] text-white hover:bg-[#1a334f]">{editingWorker ? <Check /> : <UserPlus />} {editingWorker ? "Guardar cambios" : "Crear trabajador"}</Button>{editingWorker && <Button type="button" variant="outline" onClick={() => setEditingWorker(null)}>Cancelar</Button>}</div>{activeWorksites.length === 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Crea primero una obra activa.</p>}</form></CardContent></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="text-base">Obras</CardTitle><CardDescription>{data.worksites.filter((item) => item.active).length} activas</CardDescription></CardHeader><CardContent className="space-y-2">{data.worksites.length ? data.worksites.map((worksite) => <div key={worksite.id} className={`rounded-2xl border p-3 ${worksite.active ? "bg-white dark:bg-slate-950" : "bg-slate-50 opacity-60 dark:bg-slate-900"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{worksite.name}</p><p className="mt-1 text-xs text-muted-foreground">{worksite.address || "Sin dirección"}</p></div>{worksite.active && <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => setEditingWorksite(worksite)} aria-label="Editar obra"><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => void deactivateWorksite(worksite)} aria-label="Desactivar obra"><UserRoundX /></Button></div>}</div></div>) : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No hay obras todavía.</p>}</CardContent></Card>

        <Card className="border-slate-200 shadow-none dark:border-slate-800"><CardHeader><CardTitle className="text-base">Trabajadores</CardTitle><CardDescription>{data.workers.filter((item) => item.active).length} activos</CardDescription></CardHeader><CardContent className="space-y-2">{data.workers.length ? data.workers.map((worker) => <div key={worker.id} className={`rounded-2xl border p-3 ${worker.active ? "bg-white dark:bg-slate-950" : "bg-slate-50 opacity-60 dark:bg-slate-900"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{worker.first_name} {worker.last_name}</p><p className="mt-1 text-xs text-muted-foreground">{worker.role} · {worker.worksite_name ?? "Sin obra"}</p></div>{worker.active && <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => setEditingWorker(worker)} aria-label="Editar trabajador"><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => void invite(worker)} aria-label="Generar invitación"><Link2 /></Button><Button size="icon" variant="ghost" onClick={() => void deactivateWorker(worker)} aria-label="Desactivar trabajador"><UserRoundX /></Button></div>}</div>{invitation?.workerId === worker.id && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"><p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Invitación válida hasta {new Date(invitation.expiresAt).toLocaleDateString("es-ES")}</p><Button onClick={copyInvitation} variant="outline" size="sm" className="mt-2 w-full">{copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar enlace"}</Button></div>}</div>) : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No hay trabajadores todavía.</p>}</CardContent></Card>
      </div>
    </>}

    {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-950"><div className="flex gap-2"><HardHat className="mt-0.5 size-4 shrink-0" /><p>Al desactivar un trabajador se revocan sus sesiones y se cierra su asignación activa. Los fichajes ya registrados se conservan.</p></div></div>
  </section>;
}
