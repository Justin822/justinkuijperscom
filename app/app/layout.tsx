import "./taken.css";

export const metadata = {
  title: "Taken",
  description: "Alles op één plek, elke dag een top 3.",
  robots: { index: false, follow: false },
  manifest: "/taken-pwa/manifest.webmanifest",
  themeColor: "#f6f5f1",
  viewport: { width: "device-width", initialScale: 1, viewportFit: "cover" },
  appleWebApp: { capable: true, title: "Taken", statusBarStyle: "default" },
  icons: { icon: "/taken-pwa/icon.svg", apple: "/taken-pwa/apple-touch-icon.png" },
};

export default function TakenLayout({ children }: { children: React.ReactNode }) {
  return <div className="tk">{children}</div>;
}
