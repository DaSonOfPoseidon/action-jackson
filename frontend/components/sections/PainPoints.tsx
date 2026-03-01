"use client";

import { motion } from "framer-motion";
import {
  AccentColor,
  ACCENT_TEXT,
  ACCENT_NUMBER,
  ACCENT_DIVIDER,
  ACCENT_ICON_BG,
  PainPoint,
} from "@/lib/services";

interface PainPointsProps {
  heading: string;
  subheading: string;
  items: PainPoint[];
  accent: AccentColor;
}

export function PainPoints({ heading, subheading, items, accent }: PainPointsProps) {
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
            The Problem
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
            {heading}
          </h2>
          <p className="mt-3 max-w-2xl text-muted">{subheading}</p>
        </motion.div>

        <div className="mt-16 space-y-0">
          {items.map((item, i) => {
            const isEven = i % 2 === 0;
            return (
              <div key={item.title}>
                {i > 0 && (
                  <div className={`mx-auto h-px w-2/3 bg-gradient-to-r ${ACCENT_DIVIDER[accent]}`} />
                )}
                <motion.div
                  className={`flex flex-col gap-8 py-12 md:flex-row md:items-center ${
                    isEven ? "" : "md:flex-row-reverse"
                  }`}
                  initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  {/* Number + Icon */}
                  <div className="flex shrink-0 items-center gap-4 md:w-1/3">
                    <span className={`font-mono text-7xl font-bold ${ACCENT_NUMBER[accent]} select-none`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${ACCENT_ICON_BG[accent]}`}>
                      <i className={`${item.icon} text-xl`} />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-heading text-xl font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
