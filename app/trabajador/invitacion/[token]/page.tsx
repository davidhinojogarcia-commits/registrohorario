import { ActivationForm } from "@/app/trabajador/invitacion/activation-form";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ActivationForm token={token} />;
}
