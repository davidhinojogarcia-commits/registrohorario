import { NextResponse } from "next/server";
import { revokeCurrentSupervisorSession } from "@/lib/supervisor-auth";

export async function POST() {
  await revokeCurrentSupervisorSession();
  return NextResponse.json({ ok: true });
}
