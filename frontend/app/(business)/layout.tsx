import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/JsonLd";

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Action Jackson Installs",
  description:
    "Smart home networking and automation services for builder-grade homes in Columbia, MO.",
  url: "https://actionjacksoninstalls.com",
  areaServed: {
    "@type": "Place",
    name: "Columbia, MO area",
  },
  serviceType: [
    "Networking",
    "Smart Home Automation",
    "Security Cameras",
    "Structured Cabling",
  ],
};

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
