import { Metadata } from "next";
import { CTABand } from "@/components/sections/CTABand";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { PainPoints } from "@/components/sections/PainPoints";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SpecsTable } from "@/components/sections/SpecsTable";
import { FAQAccordion } from "@/components/sections/FAQAccordion";
import { PricingCard } from "@/components/sections/PricingCard";
import { NetworkVisual } from "@/components/icons";
import type { PainPoint, Feature, FAQItem, PricingInfo } from "@/lib/services";

export const metadata: Metadata = {
  title: "Networking Services",
};

const painPoints: PainPoint[] = [
  {
    title: "One Router, 30+ Devices",
    description:
      "Your ISP router was designed to handle a few laptops. Now it's managing phones, tablets, smart TVs, thermostats, cameras, and gaming consoles on a single network.",
    icon: "fas fa-router",
  },
  {
    title: "No Network Segmentation",
    description:
      "Every device shares the same network. A compromised smart plug has direct access to your work laptop, personal files, and financial data.",
    icon: "fas fa-shield-halved",
  },
  {
    title: "Interference & Dead Zones",
    description:
      "Builder-grade router placement and neighboring WiFi networks create interference patterns that degrade performance throughout the house.",
    icon: "fas fa-signal",
  },
  {
    title: "Buffering & Latency",
    description:
      "Video calls drop, games lag, and streaming buffers because traffic isn't prioritized. Your ISP router treats a firmware update the same as a Zoom call.",
    icon: "fas fa-gauge-high",
  },
];

const features: Feature[] = [
  {
    title: "Network Assessment",
    summary: "Full evaluation of your current setup, coverage gaps, and bandwidth requirements.",
    detail:
      "We map your floor plan, count every connected device, measure signal strength in every room, and identify bandwidth bottlenecks before designing your new network.",
    icon: "fas fa-clipboard-check",
    badge: "All Packages",
  },
  {
    title: "Mesh Router Setup",
    summary: "Replace your ISP router with a high-performance mesh system.",
    detail:
      "Foundation includes a mesh router with optional wired backhaul for whole-home coverage. Backbone upgrades to enterprise-grade hardware (UniFi, Omada) with managed PoE switch and dedicated APs.",
    icon: "fas fa-server",
    badge: "Foundation+",
  },
  {
    title: "PoE Access Point Installs",
    summary: "Ceiling or wall-mounted APs with hardwired backhaul.",
    detail:
      "2-4 APs for Smart Home Backbone and above. Each AP connects via a dedicated low-voltage cable run — no wireless backhaul, no signal degradation.",
    icon: "fas fa-wifi",
    badge: "Backbone",
  },
  {
    title: "VLAN Segmentation",
    summary: "Isolated networks for Main, Guest, IoT, and Cameras.",
    detail:
      "Each segment has its own rules, bandwidth allocation, and security posture. IoT devices can't reach your personal network. Guests get internet only.",
    icon: "fas fa-diagram-project",
    badge: "Backbone",
  },
  {
    title: "Latency Optimization",
    summary: "QoS rules tuned for gaming and remote work.",
    detail:
      "Traffic shaping ensures real-time applications always have priority over background downloads. Smart queue management for symmetric and asymmetric connections.",
    icon: "fas fa-bolt",
    badge: "All Packages",
  },
  {
    title: "Cable Management & Mounting",
    summary: "Clean, professional mounting with concealed cabling.",
    detail:
      "No exposed wires, no cable spaghetti, no zip-tied mess behind the TV. Equipment rack or structured panel with proper ventilation and cable routing.",
    icon: "fas fa-screwdriver-wrench",
    badge: "All Packages",
  },
];

const faqs: FAQItem[] = [
  {
    question: "Do I need to buy my own hardware?",
    answer:
      "You can purchase hardware yourself or have us source it. We recommend specific models based on your home's size and device count. Hardware is billed separately from labor. If we purchase equipment on your behalf, a 5\u201310% acquisition and stocking fee applies.",
  },
  {
    question: "Will this work with my ISP?",
    answer:
      "Yes. We replace the routing and WiFi functions of your ISP equipment while keeping the modem or ONT connection. Works with any provider — cable, fiber, or fixed wireless.",
  },
  {
    question: "How long does installation take?",
    answer:
      "Foundation installs typically take 3-5 hours. Backbone packages with multiple AP installs and structured cabling may take a full day. We schedule around your availability.",
  },
  {
    question: "Can I manage the network myself after install?",
    answer:
      "Absolutely. We provide full admin access and a walkthrough of the management interface. Optional remote management is available if you prefer hands-off administration.",
  },
  {
    question: "What about smart home devices on the network?",
    answer:
      "IoT devices are placed on a dedicated VLAN with internet access but no path to your personal devices. We configure mDNS reflection so casting and discovery still work across VLANs.",
  },
];

const pricing: PricingInfo = {
  label: "Starting Price",
  price: "$799",
  description: "Foundation Network",
  inclusions: [
    "Network assessment & floor plan evaluation",
    "Mesh router setup with optional wired backhaul",
    "Latency optimization (gaming + remote work)",
    "Cable management & clean mounting",
    "Hardware billed separately or bundled",
  ],
};

export default function NetworkingPage() {
  return (
    <>
      <ServiceHero
        title="Engineered WiFi & Network Performance."
        subtitle="Replace your ISP router with a properly designed, segmented network built for speed and reliability."
        badge="Networking"
        accent="green"
        visual={<NetworkVisual />}
      />

      <PainPoints
        heading="The problem with builder-grade networking."
        subheading="ISP-provided equipment was never designed for how modern homes actually use their network."
        items={painPoints}
        accent="green"
      />

      <ProcessSteps steps={[]} accent="green" />

      <FeatureGrid features={features} accent="green" />

      <SpecsTable label="Comparison" accent="green">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              tier: "ISP Router",
              tagline: "What you have now",
              specs: [
                { label: "Devices", value: "10-15" },
                { label: "VLANs", value: "None" },
                { label: "WiFi", value: "1 SSID" },
                { label: "Firewall", value: "Basic NAT" },
                { label: "QoS", value: "None" },
                { label: "Management", value: "Web only" },
              ],
            },
            {
              tier: "Foundation",
              tagline: "Entry-level upgrade",
              specs: [
                { label: "Devices", value: "30+" },
                { label: "VLANs", value: "None" },
                { label: "WiFi", value: "Mesh Router" },
                { label: "Firewall", value: "Router Built-in" },
                { label: "QoS", value: "Smart Queue" },
                { label: "Management", value: "App-Based" },
              ],
            },
            {
              tier: "Backbone",
              tagline: "Smart home ready",
              specs: [
                { label: "Devices", value: "100+" },
                { label: "VLANs", value: "5+" },
                { label: "WiFi", value: "2-4 APs" },
                { label: "Firewall", value: "DPI + IDS/IPS" },
                { label: "QoS", value: "Per-VLAN Rules" },
                { label: "Management", value: "Remote + Alerts" },
              ],
            },
          ].map((col) => (
            <div
              key={col.tier}
              className="rounded-xl border border-border bg-surface-light p-6"
            >
              <h4 className="font-heading text-lg font-semibold text-foreground">
                {col.tier}
              </h4>
              <p className="mt-1 text-xs text-muted">{col.tagline}</p>
              <div className="mt-5 space-y-3">
                {col.specs.map((s) => (
                  <div key={s.label} className="flex justify-between text-sm">
                    <span className="text-muted">{s.label}</span>
                    <span className="font-medium text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SpecsTable>

      <FAQAccordion faqs={faqs} accent="green" />

      <PricingCard pricing={pricing} accent="green" />

      <CTABand
        headline="Ready to replace your ISP router?"
        subtext="Schedule a consultation and get a custom network proposal within 24 hours."
      />
    </>
  );
}
