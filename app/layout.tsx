import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
