import { Metadata } from "next";
import { CTABand } from "@/components/sections/CTABand";
import { ServiceHero } from "@/components/sections/ServiceHero";
import { PainPoints } from "@/components/sections/PainPoints";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { SpecsTable } from "@/components/sections/SpecsTable";
import { FAQAccordion } from "@/components/sections/FAQAccordion";
import { PricingCard } from "@/components/sections/PricingCard";
import { CameraVisual } from "@/components/icons";
import type { PainPoint, Feature, FAQItem, PricingInfo } from "@/lib/services";

export const metadata: Metadata = {
  title: "PoE Camera Systems",
};

const painPoints: PainPoint[] = [
  {
    title: "Monthly Subscription Fees",
    description:
      "Ring, Nest, and Arlo charge $10-$30/month per camera for cloud storage. Four cameras cost more per year than a local NVR costs once.",
    icon: "fas fa-credit-card",
  },
  {
    title: "Cloud-Dependent Recording",
    description:
      "Your cameras rely on someone else's servers. Internet outage means no recording. Company discontinues the product, your hardware becomes a paperweight.",
    icon: "fas fa-cloud-arrow-up",
  },
  {
    title: "Missed Events & Delays",
    description:
      "WiFi cameras with battery power miss events during sleep cycles. Cloud processing adds latency. By the time you get the alert, the moment has passed.",
    icon: "fas fa-clock",
  },
  {
    title: "No Local Control",
    description:
      "Your footage lives on a corporate server. You can't run custom detection, can't integrate with your smart home, and can't guarantee data privacy.",
    icon: "fas fa-lock",
  },
];

const features: Feature[] = [
  {
    title: "PoE Camera Installation",
    summary: "Professional mounting with weatherproof housings and concealed cabling.",
    detail:
      "Each camera runs on a single low-voltage cable for power and data. No batteries, no WiFi dropouts. Weatherproof housings rated for outdoor exposure at every mounting point.",
    icon: "fas fa-video",
    badge: "Installation",
  },
  {
    title: "Local NVR Setup",
    summary: "Network video recorder with configurable retention periods.",
    detail:
      "Your footage stays on your hardware, accessible only from your network. Configurable retention from 7 to 90+ days depending on drive capacity and camera count.",
    icon: "fas fa-hard-drive",
    badge: "Storage",
  },
  {
    title: "Secure Remote Access",
    summary: "View cameras from anywhere through encrypted connections.",
    detail:
      "No port forwarding, no cloud relay, no third-party account required. VPN or Cloudflare Tunnel access to your NVR interface from any device.",
    icon: "fas fa-globe",
    badge: "Access",
  },
  {
    title: "Motion Detection Configuration",
    summary: "Zone-based motion detection tuned to reduce false positives.",
    detail:
      "Separate sensitivity settings for driveways, entry points, and perimeter areas. Vehicle vs. person detection where supported. Custom notification rules per zone.",
    icon: "fas fa-bullseye",
    badge: "Configuration",
  },
  {
    title: "Night Vision Optimization",
    summary: "IR and ambient light settings calibrated per camera position.",
    detail:
      "Proper angle and exposure adjustment for clear footage in all conditions. IR intensity tuned to avoid wash-out on close surfaces. Supplemental IR illuminators where needed.",
    icon: "fas fa-moon",
    badge: "Configuration",
  },
  {
    title: "Network Integration",
    summary: "Cameras on a dedicated VLAN, isolated from personal devices.",
    detail:
      "Bandwidth allocated to prevent recording from affecting daily use. Cameras can reach the NVR but cannot access your personal network. Firewall rules enforced at the switch level.",
    icon: "fas fa-diagram-project",
    badge: "Security",
  },
];

const faqs: FAQItem[] = [
  {
    question: "Do I need an existing network upgrade for cameras?",
    answer:
      "Not necessarily. If you have a PoE switch or can add one, cameras can run on your existing network. We'll assess during the site survey and recommend upgrades only if needed.",
  },
  {
    question: "How many cameras do I need?",
    answer:
      "Most homes need 4-8 cameras to cover all entry points, the driveway, and key perimeter areas. We'll walk the property during the site survey and recommend positions based on your priorities.",
  },
  {
    question: "What about cloud backup of footage?",
    answer:
      "Local storage is primary. If you want offsite backup, we can configure encrypted upload to your own cloud storage (Backblaze B2, Wasabi, etc.) — no monthly subscription to a camera vendor.",
  },
  {
    question: "Can I view cameras on my phone?",
    answer:
      "Yes. The NVR provides mobile apps and web interfaces for live viewing and playback. Remote access is configured through a secure tunnel — no port forwarding or cloud relay.",
  },
  {
    question: "What camera brands do you recommend?",
    answer:
      "We primarily install Reolink, UniFi Protect, and Hikvision/Dahua cameras depending on your budget, feature requirements, and NVR platform. All are PoE with local storage support.",
  },
];

const pricing: PricingInfo = {
  label: "Standalone Pricing",
  price: "$125\u2013$175",
  unit: "/ camera",
  description: "Mount, configure, and integrate per camera",
  inclusions: [
    "Professional mounting with weatherproof housings",
    "Concealed low-voltage cabling",
    "NVR configuration and zone setup",
    "Motion detection tuning",
    "Night vision optimization",
    "Network VLAN integration",
  ],
  note: "Cameras are also included in the Performance + Protection package (4-8 cameras) starting at $2,500. Low-voltage cabling billed separately if new runs are needed.",
};

export default function CamerasPage() {
  return (
    <>
      <ServiceHero
        title="Subscription-Free Security Cameras."
        subtitle="PoE cameras with local NVR storage. No monthly fees, no cloud dependency, full ownership of your footage."
        badge="Cameras"
        accent="orange"
        visual={<CameraVisual />}
      />

      <PainPoints
        heading="The real cost of consumer cameras."
        subheading="Ring and Nest sell you cheap hardware so they can charge you forever. There's a better model."
        items={painPoints}
        accent="orange"
      />

      <ProcessSteps steps={[]} accent="orange" />

      <FeatureGrid features={features} accent="orange" />

      <SpecsTable label="Camera Specs" accent="orange">
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            {
              title: "Resolution",
              value: "4K / 8MP",
              detail: "Standard recommendation. 2K/4MP available for budget-conscious installs. Sufficient for license plate and face identification at typical distances.",
              icon: "fas fa-expand",
            },
            {
              title: "Recording Modes",
              value: "24/7 + Motion",
              detail: "Continuous recording with motion-tagged event search. Smart detection (person/vehicle) on supported models. Configurable schedules per camera.",
              icon: "fas fa-circle-dot",
            },
            {
              title: "Storage",
              value: "2-8 TB NVR",
              detail: "7-90+ days retention depending on camera count and resolution. RAID-capable NVRs available for drive redundancy. Expandable as needs grow.",
              icon: "fas fa-database",
            },
            {
              title: "IR Range",
              value: "30-50m",
              detail: "Built-in IR LEDs for clear night footage. Supplemental IR illuminators available for extended range. Color night vision on select models with ambient light.",
              icon: "fas fa-eye",
            },
          ].map((spec) => (
            <div
              key={spec.title}
              className="rounded-xl border border-border bg-surface-light p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange/10 text-orange">
                  <i className={`${spec.icon} text-sm`} />
                </div>
                <div>
                  <h4 className="font-heading text-sm font-semibold text-foreground">
                    {spec.title}
                  </h4>
                  <p className="text-lg font-bold text-orange">{spec.value}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">{spec.detail}</p>
            </div>
          ))}
        </div>
      </SpecsTable>

      <FAQAccordion faqs={faqs} accent="orange" />

      <PricingCard pricing={pricing} accent="orange" />

      <CTABand
        headline="Ready to ditch the subscriptions?"
        subtext="Schedule a consultation and get a custom camera system proposal within 24 hours."
      />
    </>
  );
}
