import "./globals.css";
import { Roboto_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

const roboto_mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata = {
  title: "Justin Kuijpers",
  description: "Justin Kuijpers. SEA Freelancer. Online marketeer bij Axians.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto_mono.variable}`}>
      <body>{children}</body>
      <Analytics />
    </html>
  );
}
