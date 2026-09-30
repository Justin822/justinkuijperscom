import { Bungee, Rubik } from "next/font/google";
import Stage from "./_components/Stage";
import "./rts.css";

const display = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rts-display",
  display: "swap",
});

const body = Rubik({
  subsets: ["latin"],
  variable: "--font-rts-body",
  display: "swap",
});

export const metadata = {
  title: "Ranking the Stars ⭐",
  description: "Wie is de grootste ster van het team?",
  robots: { index: false, follow: false },
};

export default function RankingTheStarsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rts ${display.variable} ${body.variable}`}>
      <Stage />
      <div className="rts-content">{children}</div>
    </div>
  );
}
