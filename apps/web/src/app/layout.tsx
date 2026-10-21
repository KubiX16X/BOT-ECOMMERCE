import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revion",
  description: "Revion – sklep internetowy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
