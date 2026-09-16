import { HardHat, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return <main className="grid min-h-screen place-items-center bg-[#102033] p-4 text-white"><section className="w-full max-w-md text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f6b718] text-[#102033]"><HardHat className="size-7" /></span><WifiOff className="mx-auto mt-8 size-9 text-amber-300" /><h1 className="mt-4 text-2xl font-bold">No hay conexión</h1><p className="mt-2 leading-relaxed text-slate-300">Necesitas recuperar la conexión para firmar un marcaje con la hora oficial del servidor.</p><p className="mt-5 text-sm text-slate-400">Cuando vuelvas a tener cobertura, abre de nuevo la aplicación.</p></section></main>;
}
