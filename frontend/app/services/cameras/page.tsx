import { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { CTABand } from "@/components/sections/CTABand";
import { AnimateIn } from "@/components/AnimateIn";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "PoE Camera Systems",
};

const problems = [
  {
    title: "Monthly Subscription Fees",
    description:
      "Ring, Nest, and Arlo charge $10-$30/month per camera for cloud storage. Four cameras cost more per year than a local NVR costs once.",
  },
  {
    title: "Cloud-Dependent Recording",
    description:
      "Your cameras rely on someone else's servers. Internet outage means no recording. Company discontinues the product, your hardware becomes a paperweight.",
  },
  {
    title: "Missed Events & Delays",
    description:
      "WiFi cameras with battery power miss events during sleep cycles. Cloud processing adds latency. By the time you get the alert, the moment has passed.",
  },
  {
    title: "No Local Control",
    description:
      "Your footage lives on a corporate server. You can't run custom detection, can't integrate with your smart home, and can't guarantee data privacy.",
  },
];

const included = [
  {
    title: "PoE Camera Installation",
    description:
      "Professional mounting with weatherproof housings and concealed cabling. Each camera runs on a single ethernet cable for power and data.",
    badge: "Installation",
  },
  {
    title: "Local NVR Setup",
    description:
      "Network video recorder with configurable retention periods. Your footage stays on your hardware, accessible only from your network.",
    badge: "Storage",
  },
  {
    title: "Secure Remote Access",
    description:
      "View your cameras from anywhere through an encrypted connection. No port forwarding, no cloud relay, no third-party account required.",
    badge: "Access",
  },
  {
    title: "Motion Detection Configuration",
    description:
      "Zone-based motion detection tuned to reduce false positives. Separate sensitivity for driveways, entry points, and perimeter areas.",
    badge: "Configuration",
  },
  {
    title: "Night Vision Optimization",
    description:
      "IR and ambient light settings calibrated for each camera position. Proper angle and exposure adjustment for clear footage in all conditions.",
    badge: "Configuration",
  },
  {
    title: "Network Integration",
    description:
      "Cameras placed on a dedicated VLAN with no access to your personal network. Bandwidth allocated to prevent recording from affecting daily use.",
    badge: "Security",
  },
];

export default function CamerasPage() {
  return (
    <>
      <Hero
        title="Subscription-Free Security Cameras."
        subtitle="PoE cameras with local NVR storage. No monthly fees, no cloud dependency, full ownership of your footage."
        primaryCTA={{ label: "Get Started", href: "/get-started" }}
        secondaryCTA={{ label: "View Packages", href: "/#packages" }}
      />

      {/* Problem Section */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">The Problem</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              The real cost of consumer cameras.
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Ring and Nest sell you cheap hardware so they can charge you
              forever. There&apos;s a better model.
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
              Professional camera installation with local storage and secure
              remote access. No recurring fees, no vendor lock-in.
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
              Standalone Pricing
            </p>
            <p className="mt-3 font-heading text-5xl font-bold text-foreground md:text-6xl">
              <span className="text-orange glow-text">$125&ndash;$175</span>
              <span className="text-2xl text-muted"> / camera</span>
            </p>
            <p className="mt-2 text-lg text-muted">
              Mount, configure, and integrate per camera
            </p>
            <div className="mx-auto mt-6 max-w-xl glass rounded-lg px-6 py-4">
              <p className="text-sm text-muted">
                Cameras are also included in the{" "}
                <span className="font-semibold text-foreground">
                  Performance + Protection
                </span>{" "}
                package (4-8 cameras) starting at{" "}
                <span className="font-semibold text-orange">$2,500</span>.
                Wiring billed separately if new runs are needed.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      <CTABand
        headline="Ready to ditch the subscriptions?"
        subtext="Schedule a consultation and get a custom camera system proposal within 24 hours."
      />
    </>
  );
}
