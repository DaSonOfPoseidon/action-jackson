"use client";

import { motion } from "framer-motion";
import { AccentColor, ACCENT_TEXT, ACCENT_BG, ACCENT_BORDER, ProcessStep } from "@/lib/services";

interface ProcessStepsProps {
  steps: ProcessStep[];
  accent: AccentColor;
}

const defaultSteps: ProcessStep[] = [
  { title: "Consultation", description: "Discuss your goals, assess current setup, and identify requirements." },
  { title: "Site Survey", description: "On-site evaluation of layout, access paths, and infrastructure." },
  { title: "Proposal", description: "Detailed scope, timeline, equipment list, and transparent pricing." },
  { title: "Installation", description: "Professional install with clean cable management and minimal disruption." },
  { title: "Configuration", description: "Full system setup, optimization, and thorough testing." },
  { title: "Handoff", description: "Documentation, walkthrough, and ongoing support options." },
];

export function ProcessSteps({ steps = defaultSteps, accent }: ProcessStepsProps) {
  const items = steps.length > 0 ? steps : defaultSteps;

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
            Our Process
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
            From consultation to handoff.
          </h2>
        </motion.div>

        {/* Desktop: horizontal timeline */}
        <div className="mt-14 hidden md:block">
          <div className="relative">
            {/* Connector line */}
            <motion.div
              className={`absolute left-0 top-6 h-0.5 ${ACCENT_BG[accent]} opacity-20`}
              initial={{ width: "0%" }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />

            <div className="grid grid-cols-6 gap-4">
              {items.map((step, i) => (
                <motion.div
                  key={step.title}
                  className="relative"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
                >
                  {/* Node dot */}
                  <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border ${ACCENT_BORDER[accent]} bg-surface`}>
                    <span className={`font-mono text-sm font-bold ${ACCENT_TEXT[accent]}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h4 className="mt-4 font-heading text-sm font-semibold text-foreground">
                    {step.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="mt-12 md:hidden">
          <div className="relative ml-6 border-l border-border pl-8">
            {items.map((step, i) => (
              <motion.div
                key={step.title}
                className="relative pb-10 last:pb-0"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                {/* Node dot */}
                <div className={`absolute -left-[calc(2rem+0.5px)] flex h-8 w-8 items-center justify-center rounded-full border ${ACCENT_BORDER[accent]} bg-surface`}>
                  <span className={`font-mono text-xs font-bold ${ACCENT_TEXT[accent]}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h4 className="font-heading text-sm font-semibold text-foreground">
                  {step.title}
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
