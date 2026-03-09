import type { Metadata } from "next";
import { Header } from "@/components/portfolio/layout/Header";
import { Footer } from "@/components/portfolio/layout/Footer";
import { JsonLd } from "@/components/JsonLd";

const personSchema = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Person",
    name: "Jackson Keithley",
    jobTitle: "Full-Stack Developer & Automation Engineer",
    url: "https://dev.actionjacksoninstalls.com",
    sameAs: [
      "https://github.com/DaSonOfPoseidon",
      "https://www.linkedin.com/in/jackson-keithley-115582213/",
    ],
    knowsAbout: [
      "Next.js",
      "React",
      "Python",
      "FastAPI",
      "TypeScript",
      "Docker",
      "DevOps",
      "Home Automation",
    ],
    makesOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Full-Stack Development & Consulting",
      },
    },
  },
};

export const metadata: Metadata = {
  metadataBase: new URL("https://dev.actionjacksoninstalls.com"),
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
      <JsonLd data={personSchema} />
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </div>
  );
}
