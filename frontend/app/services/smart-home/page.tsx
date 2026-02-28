import { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { CTABand } from "@/components/sections/CTABand";
import { AnimateIn } from "@/components/AnimateIn";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Smart Home Automation",
};

const problems = [
  {
    title: "Congested Network, Broken Automations",
    description:
      "Smart devices crammed onto a consumer router with 40 other devices. Automations fail because the network can't handle the traffic reliably.",
  },
  {
    title: "Cloud Dependency",
    description:
      "Every device phones home to a different cloud service. Internet goes down, your lights stop working. Vendor kills the product, your investment is gone.",
  },
  {
    title: "No Isolation or Security",
    description:
      "That cheap smart plug from Amazon has direct network access to your work laptop, NAS, and personal data. No segmentation, no firewall rules.",
  },
  {
    title: "Fragmented Control",
    description:
      "Five different apps to control five different brands. No unified dashboard, no cross-device automations, no central management.",
  },
];

const included = [
  {
    title: "Managed PoE Switch",
    description:
      "Enterprise-grade managed switch powers your access points, cameras, and wired devices over a single ethernet cable. Clean, centralized power and data.",
    badge: "Infrastructure",
  },
  {
    title: "Dedicated IoT VLAN",
    description:
      "Smart devices get their own isolated network segment. They can reach the internet and your automation hub, but they cannot touch your personal devices.",
    badge: "Security",
  },
  {
    title: "Home Assistant Setup",
    description:
      "Local-first automation hub that runs without the cloud. Control Zigbee, Z-Wave, WiFi, and Matter devices from a single dashboard with full automation support.",
    badge: "Automation",
  },
  {
    title: "Structured Panel Cleanup",
    description:
      "Organize the rats nest in your structured media panel. Proper patch panel, labeled connections, and clean cable routing for easy future expansion.",
    badge: "Infrastructure",
  },
  {
    title: "2-4 Access Point Installs",
    description:
      "Ceiling or wall-mounted APs with hardwired backhaul for full-home coverage. Positioned based on your floor plan and device density, not guesswork.",
    badge: "Coverage",
  },
  {
    title: "Remote Management",
    description:
      "Optional secure remote access to manage your network and automations from anywhere. Monitor device health, update configurations, and troubleshoot remotely.",
    badge: "Optional",
  },
];

export default function SmartHomePage() {
  return (
    <>
      <Hero
        title="Smart Home Infrastructure That Actually Works."
        subtitle="Stop adding smart devices to a network that can't support them. Build the backbone first."
        primaryCTA={{ label: "Get Started", href: "/get-started" }}
        secondaryCTA={{ label: "View Packages", href: "/#packages" }}
      />

      {/* Problem Section */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">The Problem</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              Smart devices, dumb infrastructure.
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Most smart home problems aren&apos;t device problems. They&apos;re
              network problems.
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
              A full network redesign built around your automation goals.
              Everything from switching infrastructure to local automation
              control.
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
              <span className="text-orange glow-text">$1,500</span>
            </p>
            <p className="mt-2 text-lg text-muted">Smart Home Backbone Package</p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted">
              Full network redesign, managed PoE switch, 2-4 AP installs, VLAN
              segmentation, structured panel cleanup, and Home Assistant setup.
              Hardware billed separately or bundled.
            </p>
          </AnimateIn>
        </div>
      </section>

      <CTABand
        headline="Ready to build your smart home backbone?"
        subtext="Schedule a consultation and get a custom automation proposal within 24 hours."
      />
    </>
  );
}
