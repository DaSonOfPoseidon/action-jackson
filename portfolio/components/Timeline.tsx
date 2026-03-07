"use client";

import { AnimateIn } from "@/components/AnimateIn";
import type { Experience } from "@/lib/types";

const typeConfig: Record<
  Experience["type"],
  { nodeColor: string; ringColor: string; badgeColor: string; badgeBg: string }
> = {
  work: {
    nodeColor: "bg-purple",
    ringColor: "ring-purple/30",
    badgeColor: "text-purple",
    badgeBg: "bg-purple-muted/40",
  },
  education: {
    nodeColor: "bg-green",
    ringColor: "ring-green/30",
    badgeColor: "text-green",
    badgeBg: "bg-green-muted/40",
  },
};

interface TimelineProps {
  entries: Experience[];
}

export function Timeline({ entries }: TimelineProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-purple/40 via-white/[0.08] to-transparent md:left-1/2 md:-translate-x-px" />

      <div className="space-y-12">
        {entries.map((entry, index) => {
          const config = typeConfig[entry.type];
          const isEven = index % 2 === 0;

          return (
            <AnimateIn
              key={`${entry.company}-${entry.startDate}`}
              delay={index * 120}
              variant={isEven ? "slide-right" : "fade-up"}
            >
              <div className="relative flex items-start gap-6 md:gap-0">
                {/* Node on the line */}
                <div
                  className={`absolute left-4 top-6 z-10 -translate-x-1/2 md:left-1/2`}
                >
                  <div
                    className={`h-3.5 w-3.5 rounded-full ${config.nodeColor} ring-4 ${config.ringColor} ring-offset-2 ring-offset-background`}
                  />
                </div>

                {/* Desktop: alternating layout */}
                {/* Mobile: always right of line */}
                <div
                  className={`ml-10 w-full md:ml-0 md:w-1/2 ${
                    isEven
                      ? "md:pr-12 md:text-right"
                      : "md:ml-auto md:pl-12 md:text-left"
                  }`}
                >
                  <div className="rounded-xl border border-white/[0.06] bg-surface-glass p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.1] hover:shadow-glow">
                    {/* Date range & type badge */}
                    <div
                      className={`mb-3 flex items-center gap-2 ${
                        isEven ? "md:flex-row-reverse" : ""
                      }`}
                    >
                      <span className="font-mono text-xs text-muted">
                        {entry.startDate} &mdash; {entry.endDate}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.badgeBg} ${config.badgeColor}`}
                      >
                        {entry.type}
                      </span>
                    </div>

                    {/* Role & company */}
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {entry.role}
                    </h3>
                    <p className="mb-3 text-sm text-purple">{entry.company}</p>

                    {/* Description */}
                    <p className="mb-3 text-sm leading-relaxed text-muted">
                      {entry.description}
                    </p>

                    {/* Highlights */}
                    {entry.highlights.length > 0 && (
                      <ul
                        className={`mb-3 space-y-1 text-sm text-muted/80 ${
                          isEven ? "md:text-right" : ""
                        }`}
                      >
                        {entry.highlights.map((highlight, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 block h-1 w-1 flex-shrink-0 rounded-full bg-purple/60" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Tech tags */}
                    <div
                      className={`flex flex-wrap gap-1.5 ${
                        isEven ? "md:justify-end" : ""
                      }`}
                    >
                      {entry.tech.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-muted ring-1 ring-inset ring-white/[0.06]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </AnimateIn>
          );
        })}
      </div>
    </div>
  );
}
