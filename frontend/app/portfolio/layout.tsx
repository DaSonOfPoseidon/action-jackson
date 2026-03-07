import type { Metadata } from "next";
import { Header } from "@/components/portfolio/layout/Header";
import { Footer } from "@/components/portfolio/layout/Footer";

export const metadata: Metadata = {
  title: {
    default: "Jackson Keithley | Developer Portfolio",
    template: "%s | Jackson Keithley",
  },
  description:
    "Full-stack developer & automation engineer. Building web apps, infrastructure tools, and home automation systems in Columbia, MO.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Jackson Keithley - Developer Portfolio",
  },
};

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-portfolio">
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </div>
  );
}
