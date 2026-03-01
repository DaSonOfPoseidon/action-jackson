import { Hero } from "@/components/sections/Hero";
import { PackageCard } from "@/components/sections/PackageCard";
import { NetworkDiagram } from "@/components/sections/NetworkDiagram";
import { CTABand } from "@/components/sections/CTABand";
import { AnimateIn } from "@/components/AnimateIn";
import { Card } from "@/components/ui/Card";

const problems = [
  {
    icon: "fa-door-closed",
    title: "ISP Router in a Closet",
    description:
      "Your internet service provider gave you one router and called it a day. It's buried behind coats.",
    long: "A single consumer router hidden in a closet, expected to handle 30+ modern devices across multiple floors. No central placement, no wired backhaul, no traffic management.",
  },
  {
    icon: "fa-broadcast-tower",
    title: "Smart Devices Competing",
    description:
      "Every smart plug, thermostat, and speaker fights for bandwidth on the same congested network.",
  },
  {
    icon: "fa-wifi",
    title: "Weak WiFi Coverage",
    description:
      "Dead zones in the bedroom, buffering in the office, dropped video calls in the kitchen.",
  },
  {
    icon: "fa-dollar-sign",
    title: "Subscription Camera Overload",
    description:
      "Monthly fees for cloud storage that still misses events. No local control, no real security.",
  },
];

const whyUs = [
  {
    number: "01",
    title: "Clean Professional Installs",
    description:
      "Flush-mount APs, concealed cabling, labeled patch panels. No visible cable spaghetti.",
  },
  {
    number: "02",
    title: "Proper VLAN Segmentation",
    description:
      "Separate traffic for your main network, guests, IoT devices, and cameras. Security by design.",
  },
  {
    number: "03",
    title: "No Subscription Cameras",
    description:
      "Local NVR storage with PoE cameras. No monthly fees, no cloud dependency, full ownership.",
  },
  {
    number: "04",
    title: "Documentation Provided",
    description:
      "Network diagram, device inventory, and configuration notes. Know exactly what's in your home.",
  },
];

const packages = [
  {
    name: "Foundation Network",
    priceRange: "$799\u2013$1,499",
    idealFor: "Builder-grade homes using ISP router only.",
    includes: [
      "Network assessment",
      "Mesh router setup with optional wired backhaul",
      "Latency optimization",
      "Cable management & clean mounting",
    ],
    accent: "green" as const,
  },
  {
    name: "Smart Home Backbone",
    priceRange: "$1,500\u2013$3,500",
    idealFor: "Homes adding automation and security devices.",
    includes: [
      "Full network redesign",
      "Managed PoE switch",
      "2\u20134 PoE access point installs",
      "VLAN segmentation (Main / Guest / IoT / Cameras)",
      "Structured panel or rack cleanup",
      "Smart home hub setup",
      "Optional remote management",
    ],
    accent: "purple" as const,
    featured: true,
  },
  {
    name: "Security",
    priceRange: "$999\u2013$1,999",
    idealFor: "Homes adding PoE cameras with local recording.",
    includes: [
      "2\u20134 PoE camera installs",
      "Local NVR setup (no subscriptions)",
      "Detection zone configuration",
      "Night vision optimization",
      "Secure remote access",
      "Camera VLAN isolation",
    ],
    accent: "orange" as const,
  },
  {
    name: "Performance + Protection",
    priceRange: "$2,500\u2013$6,000",
    idealFor: "Full coverage: network, cameras, and smart home.",
    includes: [
      "Everything in Smart Home Backbone",
      "Everything in Security package",
      "UPS battery protection",
      "Full labeling & documentation",
      "Network diagram provided",
    ],
    accent: "cyan" as const,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title="Upgrade Your Home Network."
        subtitle="Smart networking and automation for builder-grade homes."
        primaryCTA={{ label: "Schedule Consultation", href: "/get-started" }}
        secondaryCTA={{ label: "View Packages", href: "#packages" }}
        fullHeight
      />

      {/* Problem */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">The Problem</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              Sound familiar?
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Most builder-grade homes ship with the bare minimum. Here&apos;s what that looks like.
            </p>
          </AnimateIn>

          {/* Asymmetric layout: featured card + 3 smaller */}
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {/* Featured large card */}
            <AnimateIn variant="slide-right">
              <Card hover className="h-full">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-muted/40 to-orange-muted/20 text-orange">
                    <i className={`fas ${problems[0].icon} text-xl`} />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-foreground">{problems[0].title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{problems[0].long}</p>
                  </div>
                </div>
              </Card>
            </AnimateIn>

            {/* Three stacked smaller cards */}
            <div className="flex flex-col gap-6">
              {problems.slice(1).map((p, i) => (
                <AnimateIn key={p.title} delay={i * 100}>
                  <Card hover>
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-muted/40 to-orange-muted/20 text-orange">
                        <i className={`fas ${p.icon} text-sm`} />
                      </div>
                      <div>
                        <h3 className="font-heading text-base font-semibold text-foreground">{p.title}</h3>
                        <p className="mt-1 text-sm text-muted">{p.description}</p>
                      </div>
                    </div>
                  </Card>
                </AnimateIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-5xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">The Solution</p>
            <h2 className="mt-2 text-center font-heading text-3xl font-bold text-foreground">
              The engineered alternative.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
              A properly designed network with segmented traffic, hardwired backbone, and local control.
            </p>
          </AnimateIn>
          <AnimateIn delay={200}>
            <div className="mt-12">
              <NetworkDiagram />
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-muted">Packages</p>
            <h2 className="mt-2 text-center font-heading text-3xl font-bold text-foreground">
              Service Packages
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted">
              Hardware billed separately or bundled. Every install includes clean mounting and configuration.
            </p>
          </AnimateIn>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg, i) => (
              <AnimateIn key={pkg.name} delay={i * 100}>
                <PackageCard {...pkg} />
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Why Action Jackson — numbered list */}
      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Why Us</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              Why Action Jackson?
            </h2>
          </AnimateIn>
          <div className="mt-12 space-y-0 divide-y divide-border">
            {whyUs.map((item, i) => (
              <AnimateIn key={item.number} delay={i * 100}>
                <div className="flex gap-6 py-8 first:pt-0 last:pb-0">
                  <span className="font-mono text-3xl font-bold text-green/30">{item.number}</span>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTABand />
    </>
  );
}
