import { Metadata } from "next";
import { CTABand } from "@/components/sections/CTABand";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { PainPoints } from "@/components/sections/PainPoints";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SpecsTable } from "@/components/sections/SpecsTable";
import { FAQAccordion } from "@/components/sections/FAQAccordion";
import { PricingCard } from "@/components/sections/PricingCard";
import { SmartHomeVisual } from "@/components/icons";
import type { PainPoint, Feature, FAQItem, PricingInfo } from "@/lib/services";

export const metadata: Metadata = {
  title: "Smart Home Automation",
};

const painPoints: PainPoint[] = [
  {
    title: "Congested Network, Broken Automations",
    description:
      "Smart devices crammed onto a consumer router with 40 other devices. Automations fail because the network can't handle the traffic reliably.",
    icon: "fas fa-circle-exclamation",
  },
  {
    title: "Cloud Dependency",
    description:
      "Every device phones home to a different cloud service. Internet goes down, your lights stop working. Vendor kills the product, your investment is gone.",
    icon: "fas fa-cloud-arrow-up",
  },
  {
    title: "No Isolation or Security",
    description:
      "That cheap smart plug from Amazon has direct network access to your work laptop, NAS, and personal data. No segmentation, no firewall rules.",
    icon: "fas fa-shield-halved",
  },
  {
    title: "Fragmented Control",
    description:
      "Five different apps to control five different brands. No unified dashboard, no cross-device automations, no central management.",
    icon: "fas fa-puzzle-piece",
  },
];

const features: Feature[] = [
  {
    title: "Managed PoE Switch",
    summary: "Enterprise-grade managed switch for centralized power and data.",
    detail:
      "Powers your access points, cameras, and wired devices over a single low-voltage cable. VLAN-aware with port isolation, PoE budgeting, and traffic monitoring.",
    icon: "fas fa-server",
    badge: "Infrastructure",
  },
  {
    title: "Dedicated IoT VLAN",
    summary: "Smart devices on their own isolated network segment.",
    detail:
      "They can reach the internet and your automation hub, but they cannot touch your personal devices. mDNS reflection configured so casting and discovery still work.",
    icon: "fas fa-diagram-project",
    badge: "Security",
  },
  {
    title: "Home Assistant Setup",
    summary: "Local-first automation hub that runs without the cloud.",
    detail:
      "Control Zigbee, Z-Wave, WiFi, and Matter devices from a single dashboard. Full automation support with YAML or visual editor. Runs on dedicated hardware or VM.",
    icon: "fas fa-house-signal",
    badge: "Automation",
  },
  {
    title: "Structured Panel Cleanup",
    summary: "Organize the rats nest in your structured media panel.",
    detail:
      "Proper patch panel, labeled connections, and clean cable routing for easy future expansion. Low-voltage structured cabling with professional termination.",
    icon: "fas fa-toolbox",
    badge: "Infrastructure",
  },
  {
    title: "2-4 Access Point Installs",
    summary: "Ceiling or wall-mounted APs with hardwired backhaul.",
    detail:
      "Positioned based on your floor plan and device density, not guesswork. Each AP connects via a dedicated low-voltage cable run from the structured panel.",
    icon: "fas fa-wifi",
    badge: "Coverage",
  },
  {
    title: "Remote Management",
    summary: "Optional secure remote access for management.",
    detail:
      "Monitor device health, update configurations, and troubleshoot remotely. VPN or Cloudflare Tunnel access without exposing ports to the internet.",
    icon: "fas fa-globe",
    badge: "Optional",
  },
];

const protocols = [
  {
    name: "Zigbee",
    range: "10-20m",
    mesh: "Yes",
    power: "Ultra-low",
    devices: "Sensors, lights, locks",
    supported: true,
  },
  {
    name: "Z-Wave",
    range: "30m",
    mesh: "Yes",
    power: "Low",
    devices: "Locks, thermostats, blinds",
    supported: true,
  },
  {
    name: "WiFi",
    range: "50m+",
    mesh: "No",
    power: "High",
    devices: "Cameras, plugs, displays",
    supported: true,
  },
  {
    name: "Matter",
    range: "Varies",
    mesh: "Thread",
    power: "Low",
    devices: "Next-gen unified devices",
    supported: true,
  },
  {
    name: "Thread",
    range: "15m",
    mesh: "Yes",
    power: "Ultra-low",
    devices: "Sensors, locks, lights",
    supported: true,
  },
];

const faqs: FAQItem[] = [
  {
    question: "Do I need to replace my existing smart devices?",
    answer:
      "Usually not. Home Assistant supports 2,000+ integrations. Most WiFi, Zigbee, Z-Wave, and Matter devices work out of the box. We'll audit your devices during the site survey.",
  },
  {
    question: "What if my internet goes down?",
    answer:
      "Home Assistant runs locally. All local automations (lights, locks, sensors) continue to work without internet. Cloud-dependent devices (voice assistants, some cameras) will be limited.",
  },
  {
    question: "Can I still use Alexa/Google Home for voice control?",
    answer:
      "Yes. Home Assistant integrates with both Alexa and Google Home. You can use voice control while keeping all automation logic local and private.",
  },
  {
    question: "How complex can automations get?",
    answer:
      "As complex as you want. From simple schedules to multi-condition automations triggered by motion, time, weather, presence, or device state. Visual editor for simple flows, YAML for advanced logic.",
  },
  {
    question: "What hardware runs Home Assistant?",
    answer:
      "We recommend a dedicated mini PC or Home Assistant Yellow for reliability. It can also run on a Raspberry Pi 4/5, NAS, or as a VM. Dedicated hardware ensures best performance and uptime.",
  },
  {
    question: "Do I need to buy my own equipment?",
    answer:
      "You can purchase hardware yourself or have us source it. We recommend specific switches, access points, and hubs based on your home's size and device count. Hardware is billed separately from labor. If we purchase equipment on your behalf, a 5\u201310% acquisition and stocking fee applies.",
  },
];

const pricing: PricingInfo = {
  label: "Starting Price",
  price: "$1,500",
  description: "Smart Home Backbone Package",
  inclusions: [
    "Full network redesign and VLAN segmentation",
    "Managed PoE switch installation",
    "2-4 access point installs with hardwired backhaul",
    "Structured media panel cleanup",
    "Home Assistant setup and configuration",
    "Hardware billed separately or bundled",
  ],
};

export default function SmartHomePage() {
  return (
    <>
      <ServiceHero
        title="Smart Home Infrastructure That Actually Works."
        subtitle="Stop adding smart devices to a network that can't support them. Build the backbone first."
        badge="Smart Home"
        accent="purple"
        visual={<SmartHomeVisual />}
      />

      <PainPoints
        heading="Smart devices, dumb infrastructure."
        subheading="Most smart home problems aren't device problems. They're network problems."
        items={painPoints}
        accent="purple"
      />

      <ProcessSteps steps={[]} accent="purple" />

      <FeatureGrid features={features} accent="purple" />

      <SpecsTable label="Protocol Support" accent="purple">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 text-left font-heading text-xs uppercase tracking-wider text-muted">Protocol</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Range</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Mesh</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Power</th>
                <th className="px-4 py-3 text-left font-heading text-xs uppercase tracking-wider text-muted">Common Devices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {protocols.map((p) => (
                <tr key={p.name}>
                  <td className="py-3 pr-4 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted">{p.range}</td>
                  <td className="px-4 py-3 text-muted">{p.mesh}</td>
                  <td className="px-4 py-3 text-muted">{p.power}</td>
                  <td className="px-4 py-3 text-muted">{p.devices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpecsTable>

      <FAQAccordion faqs={faqs} accent="purple" />

      <PricingCard pricing={pricing} accent="purple" />

      <CTABand
        headline="Ready to build your smart home backbone?"
        subtext="Schedule a consultation and get a custom automation proposal within 24 hours."
      />
    </>
  );
}
