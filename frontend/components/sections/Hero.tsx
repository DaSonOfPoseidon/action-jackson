"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AnimateIn } from "@/components/AnimateIn";

interface HeroProps {
  title: string;
  subtitle: string;
  primaryCTA?: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  fullHeight?: boolean;
}

export function Hero({ title, subtitle, primaryCTA, secondaryCTA, fullHeight = false }: HeroProps) {
  return (
    <section
      className={`relative overflow-hidden ${
        fullHeight ? "min-h-screen flex items-center" : "pt-32 pb-20 md:pt-40 md:pb-28"
      }`}
    >
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-muted/20 via-background to-green-muted/10" />
        <div className="absolute inset-0 mesh-gradient animate-gradient-shift" style={{ backgroundSize: "200% 200%" }} />

        {/* Floating gradient orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-green/5 blur-[120px]" />

        {/* Dot grid pattern */}
        <div className="absolute inset-0 dot-grid opacity-[0.04]" />
      </div>

      {/* Decorative corner markers */}
      <div className="absolute top-8 left-8 h-16 w-16 border-l-2 border-t-2 border-green/20 hidden md:block" />
      <div className="absolute bottom-8 right-8 h-16 w-16 border-r-2 border-b-2 border-green/20 hidden md:block" />

      <div className={`mx-auto max-w-4xl px-6 text-center ${fullHeight ? "py-20" : ""}`}>
        <AnimateIn variant="blur-in">
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-7xl">
            {title}
          </h1>
        </AnimateIn>
        <AnimateIn variant="fade-up" delay={100}>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted md:text-xl">
            {subtitle}
          </p>
        </AnimateIn>
        {(primaryCTA || secondaryCTA) && (
          <AnimateIn variant="fade-up" delay={200}>
            <div className="mt-12 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
              {primaryCTA && (
                <Link href={primaryCTA.href}>
                  <Button size="lg">
                    {primaryCTA.label}
                  </Button>
                </Link>
              )}
              {secondaryCTA && (
                <Link href={secondaryCTA.href}>
                  <Button variant="outline" size="lg">
                    {secondaryCTA.label}
                  </Button>
                </Link>
              )}
            </div>
          </AnimateIn>
        )}
      </div>
    </section>
  );
}
