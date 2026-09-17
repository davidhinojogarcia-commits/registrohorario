import { requireSupervisor } from "@/lib/supervisor-auth";
import { AdminDashboard } from "@/app/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supervisor = await requireSupervisor("/");
  return <AdminDashboard displayName={supervisor.name || supervisor.email} />;
}
