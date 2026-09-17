import { redirect } from "next/navigation";
import { getRawDb } from "@/db";
import { getCurrentSupervisor } from "@/lib/supervisor-auth";
import { AuthForm } from "@/app/auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentSupervisor()) redirect("/");
  const existing = await getRawDb().prepare("SELECT id FROM supervisors LIMIT 1").first<{ id: string }>();
  if (!existing) redirect("/registro");
  return <AuthForm mode="login" />;
}
