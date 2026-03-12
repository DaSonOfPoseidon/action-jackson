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
    worksFor: {
      "@type": "Organization",
      name: "Socket Fiber",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "University of Missouri",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: "Columbia",
      addressRegion: "MO",
    },
    hasCredential: [
      { "@type": "EducationalOccupationalCredential", name: "Web and Mobile Development Certificate", credentialCategory: "certificate" },
      { "@type": "EducationalOccupationalCredential", name: "Cybersecurity Certificate", credentialCategory: "certificate" },
      { "@type": "EducationalOccupationalCredential", name: "Information Systems Certificate", credentialCategory: "certificate" },
      { "@type": "EducationalOccupationalCredential", name: "Media and Design Certificate", credentialCategory: "certificate" },
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
  twitter: {
    card: "summary_large_image",
    title: "Jackson Keithley | Developer Portfolio",
    description:
      "Full-stack developer & automation engineer building web apps, infrastructure tools, and home automation systems in Columbia, MO.",
  },
  alternates: {
    canonical: "https://dev.actionjacksoninstalls.com",
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
