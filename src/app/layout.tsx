import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, Instrument_Serif } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Loilà — Le droit français, enfin lisible", template: "%s · Loilà" },
  description:
    "Travail, urbanisme, logement : le droit français expliqué simplement, avec les articles de loi officiels cités.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${inter.variable} ${bricolage.variable} ${instrument.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
