import { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { CTABand } from "@/components/sections/CTABand";
import { AnimateIn } from "@/components/AnimateIn";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Structured Wiring",
};

const problems = [
  {
    title: "WiFi-Only Bottleneck",
    description:
      "Your gaming PC, streaming box, and work desktop are all competing for wireless bandwidth. Hardwired connections deliver consistent, full-speed throughput with zero interference.",
  },
  {
    title: "No Wired Backhaul for APs",
    description:
      "Mesh systems using wireless backhaul lose 50% of bandwidth per hop. Hardwired access points deliver the full speed of your internet plan to every corner of the house.",
  },
  {
    title: "Cameras Need PoE",
    description:
      "PoE cameras require ethernet runs to each location. Without structured cabling in place, camera installs require fishing cable through finished walls and attics.",
  },
  {
    title: "No Future-Proofing",
    description:
      "Builder-grade homes ship with coax and phone lines. Cat6 ethernet supports 10 Gbps and will outlast every wireless standard for the foreseeable future.",
  },
];

const included = [
  {
    title: "Cat6 Ethernet Drops",
    description:
      "Each drop is a dedicated Cat6 run from a central patch panel to the destination. Solid copper, rated for 10 Gbps at distances up to 55 meters.",
    badge: "Cabling",
  },
  {
    title: "Patch Panel Termination",
    description:
      "All cables terminate at a structured patch panel with proper strain relief. Clean, organized, and ready for expansion without retermination.",
    badge: "Infrastructure",
  },
  {
    title: "Wall Plate Installation",
    description:
      "Low-voltage wall plates with keystone jacks at each drop location. Flush-mount finish that looks clean and professional in any room.",
    badge: "Finish Work",
  },
  {
    title: "Cable Management",
    description:
      "Proper cable routing through attic, crawlspace, or conduit. Bundled, secured, and separated from electrical where required by code.",
    badge: "Installation",
  },
  {
    title: "Labeling & Documentation",
    description:
      "Every cable, patch panel port, and wall plate is labeled with a consistent naming scheme. Documentation provided so you know exactly what goes where.",
    badge: "Documentation",
  },
  {
    title: "Testing & Certification",
    description:
      "Every run is tested end-to-end for continuity, speed rating, and proper pin configuration before the job is closed out.",
    badge: "Quality",
  },
];

export default function WiringPage() {
  return (
    <>
      <Hero
        title="Structured Cabling & Ethernet Drops."
        subtitle="Hardwired connections for maximum performance. Clean installs with proper termination and labeling."
        primaryCTA={{ label: "Get Started", href: "/get-started" }}
        secondaryCTA={{ label: "View Packages", href: "/#packages" }}
      />

      {/* Problem Section */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">The Problem</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              Why wired still wins.
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              WiFi is convenient. Ethernet is reliable. The best networks use
              both, with wired infrastructure as the backbone.
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
              Every drop is a complete installation from patch panel to wall
              plate. Tested, labeled, and documented.
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
              <span className="text-orange glow-text">$150</span>
              <span className="text-2xl text-muted"> / drop</span>
            </p>
            <p className="mt-2 text-lg text-muted">
              Standard attic-access ethernet drop
            </p>
            <div className="mx-auto mt-6 max-w-xl glass rounded-lg px-6 py-4">
              <p className="text-sm text-muted">
                Difficult wall routes (no attic access, exterior walls, concrete)
                priced at{" "}
                <span className="font-semibold text-foreground">
                  $200&ndash;$300
                </span>{" "}
                per drop. Volume discount available for 4+ drops.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      <CTABand
        headline="Ready to hardwire your home?"
        subtext="Schedule a consultation and get a custom cabling proposal within 24 hours."
      />
    </>
  );
}
