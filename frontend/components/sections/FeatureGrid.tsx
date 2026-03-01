"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import {
  AccentColor,
  ACCENT_TEXT,
  ACCENT_BORDER,
  ACCENT_ICON_BG,
  ACCENT_BADGE_VARIANT,
  Feature,
} from "@/lib/services";

interface FeatureGridProps {
  features: Feature[];
  accent: AccentColor;
}

export function FeatureGrid({ features, accent }: FeatureGridProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className={`font-mono text-xs uppercase tracking-[0.2em] ${ACCENT_TEXT[accent]}`}>
            Included
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
            What&apos;s included.
          </h2>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const isOpen = expanded === i;
            return (
              <motion.div
                key={feature.title}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-surface p-6 transition-colors duration-300 ${
                  isOpen ? ACCENT_BORDER[accent] : "border-border hover:border-border"
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                {/* Top highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACCENT_ICON_BG[accent]}`}>
                    <i className={`${feature.icon} text-sm`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      {feature.badge && (
                        <Badge variant={ACCENT_BADGE_VARIANT[accent]} className="text-[10px]">
                          {feature.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {feature.summary}
                    </p>
                  </div>

                  {/* Expand icon */}
                  <motion.span
                    className={`mt-1 shrink-0 text-lg ${ACCENT_TEXT[accent]}`}
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    +
                  </motion.span>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted">
                        {feature.detail}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
