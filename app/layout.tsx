import type { Metadata } from "next";
import "./globals.css";
import { PwaRuntime } from "@/app/pwa-runtime";

export const metadata: Metadata = {
  title: "Control de obra · Registro horario",
  description: "Registro móvil de entradas, pausas y salidas para trabajadores de obra.",
  manifest: "/manifest.webmanifest",
  applicationName: "Control de obra",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Control de obra",
  },
  formatDetection: { telephone: false },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}<PwaRuntime /></body>
    </html>
  );
}
