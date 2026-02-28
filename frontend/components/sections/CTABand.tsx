import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AnimateIn } from "@/components/AnimateIn";

interface CTABandProps {
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function CTABand({
  headline = "Ready to upgrade your network?",
  subtext = "Schedule a free consultation and get a custom proposal within 24 hours.",
  ctaLabel = "Schedule Consultation",
  ctaHref = "/get-started",
}: CTABandProps) {
  return (
    <section className="relative overflow-hidden border-y border-border py-20">
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 -z-10 animate-gradient-shift"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(20,83,45,0.15) 0%, rgba(18,18,28,0.8) 40%, rgba(88,28,135,0.1) 100%)",
          backgroundSize: "200% 200%",
        }}
      />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-grid opacity-[0.03] pointer-events-none" />

      {/* Decorative floating circles */}
      <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-green/5 blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-purple/5 blur-[80px] pointer-events-none" />

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <AnimateIn variant="blur-in">
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            {headline}
          </h2>
        </AnimateIn>
        <AnimateIn variant="fade-up" delay={100}>
          <p className="mt-4 text-muted">{subtext}</p>
        </AnimateIn>
        <AnimateIn variant="scale-in" delay={200}>
          <Link href={ctaHref} className="mt-10 inline-block">
            <Button size="lg" className="animate-pulse-glow">{ctaLabel}</Button>
          </Link>
        </AnimateIn>
      </div>
    </section>
  );
}
