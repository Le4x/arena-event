import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arena Event - Plateforme de jeux interactifs",
  description: "Transformez vos événements en expériences inoubliables avec Arena Event. Quiz, blind tests, buzzers en temps réel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
