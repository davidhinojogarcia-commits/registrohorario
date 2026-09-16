import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { AdminDashboard } from "@/app/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <AdminDashboard displayName={user.fullName ?? user.email} />;
}
