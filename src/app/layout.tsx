import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flux — Votre activité, en un regard",
  description:
    "Pilotez vos ventes, vos factures, vos projets, vos dépenses et vos relances clients.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
