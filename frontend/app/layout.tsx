import type { Metadata } from "next";
import { Syne, Figtree, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Action Jackson Installs | Smart Home Networking & Automation",
    template: "%s | Action Jackson Installs",
  },
  description:
    "Smart networking and automation upgrades for builder-grade homes. Engineered WiFi, VLAN segmentation, PoE cameras, and structured wiring in Columbia, MO.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Action Jackson Installs",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${figtree.variable} ${ibmPlexMono.variable} scroll-smooth`}
    >
      <head>
        <Script
          src="https://kit.fontawesome.com/8623ae8306.js"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="overflow-x-hidden">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
