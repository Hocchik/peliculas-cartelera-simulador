import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { siteUrl } from "@/lib/site";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  // Absoluta para que las previsualizaciones al compartir resuelvan bien.
  metadataBase: new URL(siteUrl()),
  title: "Mundial de Pelis",
  description: "Nominen, sorteen y voten qué película ver entre amigos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("dark font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
