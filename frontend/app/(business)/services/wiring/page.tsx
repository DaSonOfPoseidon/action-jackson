import { Metadata } from "next";
import { CTABand } from "@/components/sections/CTABand";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { PainPoints } from "@/components/sections/PainPoints";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SpecsTable } from "@/components/sections/SpecsTable";
import { FAQAccordion } from "@/components/sections/FAQAccordion";
import { PricingCard } from "@/components/sections/PricingCard";
import { WiringVisual } from "@/components/icons";
import type { PainPoint, Feature, FAQItem, PricingInfo } from "@/lib/services";

export const metadata: Metadata = {
  title: "Structured Cabling & Low Voltage",
};

const painPoints: PainPoint[] = [
  {
    title: "WiFi-Only Bottleneck",
    description:
      "Your gaming PC, streaming box, and work desktop are all competing for wireless bandwidth. Hardwired connections deliver consistent, full-speed throughput with zero interference.",
    icon: "fas fa-gauge-high",
  },
  {
    title: "No Wired Backhaul for APs",
    description:
      "Mesh systems using wireless backhaul lose 50% of bandwidth per hop. Hardwired access points deliver the full speed of your internet plan to every corner of the house.",
    icon: "fas fa-wifi",
  },
  {
    title: "Cameras & PoE Devices Need Cable",
    description:
      "PoE cameras, access points, and VoIP phones all require low-voltage cabling. Without structured cable runs in place, every new device means fishing cable through finished walls.",
    icon: "fas fa-video",
  },
  {
    title: "No Future-Proofing",
    description:
      "Builder-grade homes ship with coax and phone lines. Cat6 supports 10 Gbps and single mode fiber handles 100 Gbps+. Proper structured cabling outlasts every wireless standard.",
    icon: "fas fa-forward",
  },
];

const features: Feature[] = [
  {
    title: "Cat6 / Cat6a Data Drops",
    summary: "Dedicated data cable runs from patch panel to destination.",
    detail:
      "Cat6 rated for 10 Gbps at 55m, Cat6a at 100m. Solid copper conductors with proper shielding. Each drop is a home run to the structured panel — no daisy chains, no splices.",
    icon: "fas fa-ethernet",
    badge: "Data Cabling",
  },
  {
    title: "Single Mode Fiber Runs",
    summary: "Future-proof fiber optic connections for high-bandwidth links.",
    detail:
      "Single mode fiber supports 100 Gbps+ over distances up to 10km. Ideal for building-to-building links, backbone connections between floors, or future-proofing critical paths.",
    icon: "fas fa-bolt",
    badge: "Fiber",
  },
  {
    title: "Coax Distribution",
    summary: "RG6 coax runs for antenna, cable TV, and MoCA.",
    detail:
      "Proper RG6 runs with compression fittings for OTA antenna distribution, cable TV, or MoCA network backhaul. Splitters, amplifiers, and grounding as needed.",
    icon: "fas fa-satellite-dish",
    badge: "Coax",
  },
  {
    title: "Patch Panel Termination",
    summary: "All cables terminate at a structured patch panel.",
    detail:
      "Proper strain relief, clean organization, and labeled ports for easy expansion. Keystone or punch-down depending on panel type. Ready for future additions without retermination.",
    icon: "fas fa-server",
    badge: "Infrastructure",
  },
  {
    title: "Wall Plate Installation",
    summary: "Low-voltage wall plates with keystone jacks at each location.",
    detail:
      "Flush-mount finish that looks clean and professional in any room. Support for data, coax, and fiber keystones in the same plate. Old-work or new-work boxes as needed.",
    icon: "fas fa-plug",
    badge: "Finish Work",
  },
  {
    title: "Testing & Certification",
    summary: "Every run tested end-to-end before the job is closed out.",
    detail:
      "Continuity, speed rating, proper pin configuration, and signal quality verified on every cable. Test results documented and provided with the install package.",
    icon: "fas fa-clipboard-check",
    badge: "Quality",
  },
];

const cableTypes = [
  {
    type: "Cat6",
    speed: "10 Gbps",
    distance: "55m (10G) / 100m (1G)",
    useCase: "Data drops, PoE devices, AP backhaul",
    price: "$150 / drop",
  },
  {
    type: "Cat6a",
    speed: "10 Gbps",
    distance: "100m",
    useCase: "Long runs, 10G backbones, high-PoE",
    price: "$200 / drop",
  },
  {
    type: "Single Mode Fiber",
    speed: "100 Gbps+",
    distance: "10km+",
    useCase: "Building links, backbone, future-proof",
    price: "$300+ / run",
  },
  {
    type: "RG6 Coax",
    speed: "3 Gbps (MoCA 2.5)",
    distance: "100m",
    useCase: "Antenna, cable TV, MoCA network",
    price: "$125 / drop",
  },
];

const faqs: FAQItem[] = [
  {
    question: "What's the difference between Cat6 and Cat6a?",
    answer:
      "Both support 10 Gbps, but Cat6 is limited to 55 meters at that speed while Cat6a supports the full 100 meters. Cat6a also has better shielding against crosstalk. For most residential drops, Cat6 is sufficient.",
  },
  {
    question: "Do I need fiber in my house?",
    answer:
      "For most homes, Cat6/Cat6a handles everything. Fiber makes sense for building-to-building links (house to detached garage/office), backbone connections between floors in large homes, or if you want 10/25/100G capacity on specific paths.",
  },
  {
    question: "Can you run cable through finished walls?",
    answer:
      "Yes. Most runs go through the attic, crawlspace, or existing conduit. Difficult routes (no attic access, exterior walls, concrete) take more time and are priced accordingly.",
  },
  {
    question: "How many drops do I need?",
    answer:
      "At minimum: one per access point location, one per camera location, and one per room where you want hardwired devices (office, entertainment center, gaming setup). We'll recommend a plan during the site survey.",
  },
  {
    question: "Is coax still useful?",
    answer:
      "Absolutely. RG6 coax is essential for OTA antenna distribution and MoCA 2.5 provides 2.5 Gbps network backhaul using existing coax — useful when running new data cable isn't practical.",
  },
  {
    question: "Do you handle permits and code compliance?",
    answer:
      "Low-voltage cabling typically doesn't require permits in most jurisdictions. All installs follow NEC low-voltage separation requirements and manufacturer specifications for bend radius and cable support.",
  },
  {
    question: "Do I need to buy my own materials?",
    answer:
      "You can purchase cable, keystones, and wall plates yourself or have us source everything. We recommend specific brands and grades based on your project requirements. Materials are billed separately from labor. If we purchase equipment or materials on your behalf, a 5\u201310% acquisition and stocking fee applies.",
  },
];

const pricing: PricingInfo = {
  label: "Starting Price",
  price: "$150",
  unit: "/ drop",
  description: "Standard attic-access data drop",
  inclusions: [
    "Cat6 cable run from patch panel to wall plate",
    "Patch panel termination with strain relief",
    "Keystone jack and low-voltage wall plate",
    "Proper cable routing and support",
    "Labeling and documentation",
    "End-to-end testing and certification",
  ],
  note: "Difficult wall routes (no attic access, exterior walls, concrete) priced at $200-$300 per drop. Cat6a, fiber, and coax priced individually. Volume discount available for 4+ drops.",
};

export default function WiringPage() {
  return (
    <>
      <ServiceHero
        title="Structured Cabling & Low-Voltage Networking."
        subtitle="Cat6, Cat6a, single mode fiber, and coax. Clean installs with professional termination, testing, and documentation."
        badge="Structured Cabling"
        accent="cyan"
        visual={<WiringVisual />}
      />

      <PainPoints
        heading="Why wired infrastructure still wins."
        subheading="WiFi is convenient. Structured cabling is reliable. The best networks use both, with low-voltage wiring as the backbone."
        items={painPoints}
        accent="cyan"
      />

      <ProcessSteps steps={[]} accent="cyan" />

      <FeatureGrid features={features} accent="cyan" />

      <SpecsTable label="Cable Comparison" accent="cyan">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 text-left font-heading text-xs uppercase tracking-wider text-muted">Cable Type</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Max Speed</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Max Distance</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Use Case</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Price Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cableTypes.map((c) => (
                <tr key={c.type}>
                  <td className="py-3 pr-4 font-medium text-foreground">{c.type}</td>
                  <td className="px-4 py-3 font-mono text-cyan">{c.speed}</td>
                  <td className="px-4 py-3 text-muted">{c.distance}</td>
                  <td className="px-4 py-3 text-muted">{c.useCase}</td>
                  <td className="px-4 py-3 text-muted">{c.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpecsTable>

      <FAQAccordion faqs={faqs} accent="cyan" />

      <PricingCard pricing={pricing} accent="cyan" />

      <CTABand
        headline="Ready to wire your home properly?"
        subtext="Schedule a consultation and get a custom structured cabling proposal within 24 hours."
      />
    </>
  );
}
