import { NextResponse } from "next/server";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";

export async function POST() {
  const supervisor = await getCurrentSupervisor();
  if (!supervisor) return NextResponse.json({ error: "Debes identificarte como responsable." }, { status: 401 });

  return NextResponse.json(
    { error: "La configuración automática de datos de prueba ha sido retirada. Usa la gestión de empresa, obras y trabajadores del panel." },
    { status: 410 },
  );
}
