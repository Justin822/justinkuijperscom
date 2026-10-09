import { Inter } from "next/font/google";
import "./taken.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Planner",
  description: "Taken, agenda en notities op één plek. Elke dag een top 3.",
  robots: { index: false, follow: false },
  manifest: "/taken-pwa/manifest.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewport: { width: "device-width", initialScale: 1, viewportFit: "cover" },
  appleWebApp: { capable: true, title: "Planner", statusBarStyle: "default" },
  icons: { icon: "/taken-pwa/icon.svg", apple: "/taken-pwa/apple-touch-icon.png" },
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return <div className={`tk ${inter.variable}`}>{children}</div>;
}
