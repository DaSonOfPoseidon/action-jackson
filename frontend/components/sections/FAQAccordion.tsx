"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AccentColor, ACCENT_TEXT, ACCENT_BORDER, FAQItem } from "@/lib/services";

interface FAQAccordionProps {
  faqs: FAQItem[];
  accent: AccentColor;
}

export function FAQAccordion({ faqs, accent }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="border-t border-border py-20">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className={`font-mono text-xs uppercase tracking-[0.2em] ${ACCENT_TEXT[accent]}`}>
            FAQ
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
            Common questions.
          </h2>
        </motion.div>

        <div className="mt-12 divide-y divide-border">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <button
                  className="flex w-full items-center justify-between py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span className="pr-4 font-heading text-base font-semibold text-foreground">
                    {faq.question}
                  </span>
                  <motion.span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${ACCENT_BORDER[accent]} ${ACCENT_TEXT[accent]}`}
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    +
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm leading-relaxed text-muted">
                        {faq.answer}
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
