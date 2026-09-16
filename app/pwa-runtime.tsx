"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function PwaRuntime() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const initialCheck = window.setTimeout(updateOnline, 0);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return () => { window.clearTimeout(initialCheck); window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);
  if (online) return null;
  return <div role="status" className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-[#102033] shadow-xl"><WifiOff className="size-4" /> Sin conexión. No firmes hasta recuperarla.</div>;
}
