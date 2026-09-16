"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  if (!prompt) return null;
  return <Button variant="ghost" size="sm" className="ml-auto text-white hover:bg-white/10 hover:text-white" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }}><Download className="size-4" /> Instalar app</Button>;
}
