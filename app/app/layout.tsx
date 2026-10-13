import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { THEME_SCRIPT } from "./_components/theme";
import "./taken.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Planner",
  description: "Taken, agenda en notities op één plek. Elke dag een top 3.",
  robots: { index: false, follow: false },
  manifest: "/taken-pwa/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Planner", statusBarStyle: "default" },
  icons: { icon: "/taken-pwa/icon.svg", apple: "/taken-pwa/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  // lang="nl": de rest van de site is Engels, de Planner Nederlands (uitspraak, afbreken, spellingscontrole).
  return (
    <div className={`tk ${inter.variable}`} lang="nl">
      {/* Gekozen thema meteen toepassen, vóór de eerste weergave. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </div>
  );
}
