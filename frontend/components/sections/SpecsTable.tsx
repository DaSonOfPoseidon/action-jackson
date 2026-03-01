"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AccentColor, ACCENT_TEXT } from "@/lib/services";

interface SpecsTableProps {
  label: string;
  accent: AccentColor;
  children: ReactNode;
}

export function SpecsTable({ label, accent, children }: SpecsTableProps) {
  return (
    <section className="border-t border-border bg-surface py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className={`font-mono text-xs uppercase tracking-[0.2em] ${ACCENT_TEXT[accent]}`}>
            {label}
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
            Technical specifications.
          </h2>
        </motion.div>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}
