import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";
import { CTABand } from "@/components/sections/CTABand";
import { ServiceCard } from "@/components/sections/ServiceCard";
import { AnimateIn } from "@/components/AnimateIn";

export const metadata: Metadata = {
  title: "About",
  description:
    "Home network performance specialist serving Columbia, MO. Engineered WiFi, structured cabling, smart home integration, and security systems.",
};

const expertise = [
  {
    icon: "fa-network-wired",
    title: "Network Engineering",
    description:
      "Enterprise-grade routing, managed switching, VLAN segmentation, and wireless design tailored for residential environments. Proper throughput, proper security.",
  },
  {
    icon: "fa-house-signal",
    title: "Smart Home Integration",
    description:
      "Centralized automation with local control. Hub configuration, device onboarding, and network isolation so your smart home stays fast and private.",
  },
  {
    icon: "fa-shield-halved",
    title: "Security Systems",
    description:
      "PoE camera installations with local NVR storage. No subscriptions, no cloud dependency. Motion zones, remote access, and UPS-backed recording.",
  },
  {
    icon: "fa-ethernet",
    title: "Structured Cabling",
    description:
      "Cat6/Cat6a home runs, flush-mount wall plates, labeled patch panels, and clean cable management. Built to spec, built to last.",
  },
];

const differentiators = [
  {
    number: "01",
    title: "Design Before Install",
    description:
      "Every project starts with a site survey and a documented plan. Cable pathways, AP placement, switch port allocation, and VLAN topology are mapped before anything gets mounted.",
  },
  {
    number: "02",
    title: "Clean, Concealed Work",
    description:
      "Flush-mount access points, concealed cable runs, and organized patch panels. The infrastructure should be invisible to the people living in the house.",
  },
  {
    number: "03",
    title: "Full Documentation",
    description:
      "You get a network diagram, device inventory, port map, and configuration summary. If you ever need to troubleshoot or hand it off to someone else, everything is documented.",
  },
  {
    number: "04",
    title: "Ongoing Support",
    description:
      "Networks evolve. New devices get added, firmware needs updating, and configurations need tuning. Post-install support is part of the service, not an afterthought.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Hero
        title="Home Network Performance Specialist."
        subtitle="Engineering reliable, secure infrastructure for modern homes in Columbia, MO."
        primaryCTA={{ label: "Schedule Consultation", href: "/get-started" }}
      />

      {/* Expertise Grid */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Expertise</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              Core Expertise
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Focused skill set, applied consistently across every project.
            </p>
          </AnimateIn>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {expertise.map((item, i) => (
              <AnimateIn key={item.title} delay={i * 100}>
                <ServiceCard
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* The Action Jackson Difference — numbered list */}
      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AnimateIn>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">What Sets Us Apart</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
              The Action Jackson Difference
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              This isn&apos;t just cable drops and router reboots. Every install
              is an engineered solution — designed for the home it lives in,
              documented for the people who use it.
            </p>
          </AnimateIn>
          <div className="mt-12 space-y-0 divide-y divide-border">
            {differentiators.map((item, i) => (
              <AnimateIn key={item.number} delay={i * 100}>
                <div className="flex gap-6 py-8 first:pt-0 last:pb-0">
                  <span className="font-mono text-3xl font-bold text-green/30">{item.number}</span>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-green">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>

          {/* Location callout */}
          <AnimateIn delay={500}>
            <div className="mt-12 flex items-center gap-3 rounded-lg border border-border bg-surface-light px-5 py-4">
              <i className="fas fa-map-pin text-green" />
              <p className="font-mono text-sm text-muted">
                Based in <span className="text-foreground font-medium">Columbia, MO</span> &middot; Serving mid-Missouri
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      <CTABand
        headline="Let&apos;s talk about your home network."
        subtext="Free consultation. Custom proposal within 24 hours. No obligations."
      />
    </>
  );
}
