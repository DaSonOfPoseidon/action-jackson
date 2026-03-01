"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  AccentColor,
  ACCENT_GRADIENT,
  ACCENT_BADGE_VARIANT,
  ACCENT_GLOW_TEXT,
  ACCENT_TEXT,
} from "@/lib/services";

interface ServiceHeroProps {
  title: string;
  subtitle: string;
  badge: string;
  accent: AccentColor;
  visual: ReactNode;
}

export function ServiceHero({ title, subtitle, badge, accent, visual }: ServiceHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Accent gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${ACCENT_GRADIENT[accent]} pointer-events-none`} />
      <div className="absolute inset-0 dot-grid opacity-[0.03] pointer-events-none" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        {/* Text column */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant={ACCENT_BADGE_VARIANT[accent]}>{badge}</Badge>
          </motion.div>

          <motion.h1
            className={`mt-6 font-heading text-4xl font-bold leading-tight text-foreground md:text-5xl lg:text-6xl`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {title.split(/(\.)/).map((part, i) =>
              part === "." ? (
                <span key={i} className={`${ACCENT_TEXT[accent]} ${ACCENT_GLOW_TEXT[accent]}`}>.</span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </motion.h1>

          <motion.p
            className="mt-5 max-w-lg text-lg text-muted"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href="/get-started">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/#packages">
              <Button variant="outline" size="lg">View Packages</Button>
            </Link>
          </motion.div>
        </div>

        {/* Visual column */}
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="w-full max-w-sm">{visual}</div>
        </motion.div>
      </div>
    </section>
  );
}
