import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mundial de Pelis",
  description: "Nominen, sorteen y voten qué película ver entre amigos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
