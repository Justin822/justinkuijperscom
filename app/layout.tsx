import "./globals.css";
import { Roboto_Mono } from "next/font/google";
import Script from "next/script";

const roboto_mono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata = {
  title: "Justin Kuijpers",
  description: "Justin Kuijpers. SEA Freelancer. Online marketer at Axians. ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto_mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
