import { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { CTABand } from "@/components/sections/CTABand";
import { AnimateIn } from "@/components/AnimateIn";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Networking Services",
};

const problems = [
  {
    title: "One Router, 30+ Devices",
    description:
      "Your ISP router was designed to handle a few laptops. Now it's managing phones, tablets, smart TVs, thermostats, cameras, and gaming consoles on a single network.",
  },
  {
    title: "No Network Segmentation",
    description:
      "Every device shares the same network. A compromised smart plug has direct access to your work laptop, personal files, and financial data.",
  },
  {
    title: "Interference & Dead Zones",
    description:
      "Builder-grade router placement and neighboring WiFi networks create interference patterns that degrade performance throughout the house.",
  },
  {
    title: "Buffering & Latency",
    description:
      "Video calls drop, games lag, and streaming buffers because traffic isn't prioritized. Your ISP router treats a firmware update the same as a Zoom call.",
  },
];

const included = [
  {
    title: "Network Assessment",
    description:
      "Full evaluation of your current setup, coverage gaps, device count, and bandwidth requirements before any work begins.",
    badge: "All Packages",
  },
  {
    title: "Router & Firewall Configuration",
    description:
      "Replace your ISP router with enterprise-grade hardware (UniFi, Omada, or equivalent). Properly configured firewall rules and DNS.",
    badge: "All Packages",
  },
  {
    title: "PoE Access Point Installs",
    description:
      "Ceiling or wall-mounted access points with hardwired backhaul. 1-2 APs for Foundation, 2-4 for Smart Home Backbone.",
    badge: "All Packages",
  },
  {
    title: "VLAN Segmentation",
    description:
      "Isolated networks for Main, Guest, IoT, and Cameras. Each segment has its own rules, bandwidth allocation, and security posture.",
    badge: "All Packages",
  },
  {
    title: "Low-Latency Optimization",
    description:
      "QoS rules tuned for gaming and remote work. Traffic shaping ensures real-time applications always have priority over background downloads.",
    badge: "Foundation+",
  },
  {
    title: "Cable Management & Mounting",
    description:
      "Clean, professional mounting with concealed cabling. No exposed wires, no cable spaghetti, no zip-tied mess behind the TV.",
    badge: "All Packages",
  },
];

export default function NetworkingPage() {
  return (
    <>
      <Hero
        title="Engineered WiFi & Network Performance."
        subtitle="Replace your ISP router with a properly designed, segmented network built for speed and reliability."
        primaryCTA={{ label: "Get Started", href: "/get-started" }}
        secondaryCTA={{ label: "View Packages", href: "/#packages" }}
      />

      {/* Problem Section */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">The Problem</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              The problem with builder-grade networking.
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              ISP-provided equipment was never designed for how modern homes
              actually use their network.
            </p>
          </AnimateIn>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {problems.map((p, i) => (
              <AnimateIn key={p.title} delay={i * 100}>
                <Card hover className="h-full border-orange/10">
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {p.description}
                  </p>
                </Card>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included — numbered items */}
      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Included</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              What&apos;s included.
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Every network install is designed around your home&apos;s layout,
              device count, and usage patterns. Not a cookie-cutter template.
            </p>
          </AnimateIn>
          <div className="mt-12 space-y-0 divide-y divide-border">
            {included.map((item, i) => (
              <AnimateIn key={item.title} delay={i * 80}>
                <div className="flex gap-6 py-8 first:pt-0 last:pb-0">
                  <span className="font-mono text-2xl font-bold text-green/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {item.title}
                      </h3>
                      <Badge variant="purple">{item.badge}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <AnimateIn variant="scale-in">
            <p className="text-sm font-medium uppercase tracking-widest text-purple">
              Starting Price
            </p>
            <p className="mt-3 font-heading text-5xl font-bold text-foreground md:text-6xl">
              <span className="text-orange glow-text">$799</span>
            </p>
            <p className="mt-2 text-lg text-muted">Foundation Network Upgrade</p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted">
              Includes network assessment, router/firewall configuration, 1-2 AP
              installs, VLAN segmentation, and clean cable management. Hardware
              billed separately or bundled.
            </p>
          </AnimateIn>
        </div>
      </section>

      <CTABand
        headline="Ready to replace your ISP router?"
        subtext="Schedule a consultation and get a custom network proposal within 24 hours."
      />
    </>
  );
}
