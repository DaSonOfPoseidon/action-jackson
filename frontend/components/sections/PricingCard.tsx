"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import {
  AccentColor,
  ACCENT_TEXT,
  ACCENT_BORDER,
  ACCENT_GLOW,
  ACCENT_GLOW_TEXT,
  PricingInfo,
} from "@/lib/services";

interface PricingCardProps {
  pricing: PricingInfo;
  accent: AccentColor;
}

export function PricingCard({ pricing, accent }: PricingCardProps) {
  return (
    <section className="border-t border-border py-20">
      <div className="mx-auto max-w-xl px-6">
        <motion.div
          className={`relative overflow-hidden rounded-2xl border ${ACCENT_BORDER[accent]} bg-surface-glass backdrop-blur-xl ${ACCENT_GLOW[accent]} p-8 text-center`}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Top gradient highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <p className={`text-sm font-medium uppercase tracking-widest ${ACCENT_TEXT[accent]}`}>
            {pricing.label}
          </p>

          <p className="mt-4 font-heading text-5xl font-bold text-foreground md:text-6xl">
            <span className={`${ACCENT_TEXT[accent]} ${ACCENT_GLOW_TEXT[accent]}`}>
              {pricing.price}
            </span>
            {pricing.unit && (
              <span className="text-2xl text-muted"> {pricing.unit}</span>
            )}
          </p>

          <p className="mt-2 text-lg text-muted">{pricing.description}</p>

          {/* Inclusions checklist */}
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-muted">
            {pricing.inclusions.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 ${ACCENT_TEXT[accent]}`}>&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {pricing.note && (
            <div className="mx-auto mt-6 rounded-lg border border-border bg-surface px-4 py-3">
              <p className="text-xs leading-relaxed text-muted">{pricing.note}</p>
            </div>
          )}

          <Link href="/get-started" className="mt-8 inline-block">
            <Button size="lg">Get Started</Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
