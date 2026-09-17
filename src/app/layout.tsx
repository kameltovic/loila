import type { Metadata, Viewport } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { Bricolage_Grotesque, Inter, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Loilà · Le droit français expliqué simplement", template: "%s · Loilà" },
  description:
    "Congés, licenciement, bail, permis de construire : des réponses claires et gratuites en 2026, chaque règle sourcée par l’article de loi officiel.",
  applicationName: SITE_NAME,
  keywords: ["droit du travail", "droit français", "code du travail", "bail", "logement", "permis de construire", "urbanisme", "convention collective", "rupture conventionnelle", "Légifrance"],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "law",
  formatDetection: { telephone: false, email: false, address: false },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", locale: "fr_FR", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E0E" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${bricolage.variable} ${instrument.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Script defer src="https://stats.coffee-beans.fr/script.js" data-website-id="5b4eedbb-3ed8-47f8-9905-194f768bd92a" strategy="afterInteractive" />
      </body>
    </html>
  );
}
