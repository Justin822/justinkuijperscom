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
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-PZQX87G');
        `}
      </Script>
      <body>{children}</body>
      <Script id="google-tag-manager-body" strategy="afterInteractive">
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-PZQX87G"
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        ></iframe>
      </Script>
    </html>
  );
}
