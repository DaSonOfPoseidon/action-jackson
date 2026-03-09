"use client";

import { AnimateIn } from "@/components/portfolio/AnimateIn";
import type { Experience, LifeEvent } from "@/lib/portfolio-types";

type TimelineEntry =
  | (Experience & { _kind: "experience" })
  | (LifeEvent & { _kind: "lifeEvent" });

const typeConfig: Record<
  string,
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
  lifeEvent: {
    nodeColor: "bg-cyan",
    ringColor: "ring-cyan/30",
    badgeColor: "text-cyan",
    badgeBg: "bg-cyan-muted/40",
  },
};

interface TimelineProps {
  entries: TimelineEntry[];
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-purple/10 px-2 py-0.5 text-[11px] ring-1 ring-inset ring-purple/20">
      <span className="font-bold text-foreground">{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

export type { TimelineEntry };

export function Timeline({ entries }: TimelineProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-purple/40 via-white/[0.08] to-transparent md:left-1/2 md:-translate-x-px" />

      <div className="space-y-12">
        {entries.map((entry, index) => {
          const isLifeEvent = entry._kind === "lifeEvent";
          const config =
            typeConfig[isLifeEvent ? "lifeEvent" : (entry as Experience).type] ??
            typeConfig.work;
          const isEven = index % 2 === 0;

          if (isLifeEvent) {
            const le = entry as LifeEvent & { _kind: "lifeEvent" };
            return (
              <AnimateIn
                key={`life-${le.date}-${le.title}`}
                delay={index * 120}
                variant={isEven ? "slide-right" : "fade-up"}
              >
                <div className="relative flex items-start gap-6 md:gap-0">
                  <div className="absolute left-4 top-6 z-10 -translate-x-1/2 md:left-1/2">
                    <div
                      className={`h-3.5 w-3.5 rounded-full ${config.nodeColor} ring-4 ${config.ringColor} ring-offset-2 ring-offset-background`}
                    />
                  </div>

                  <div
                    className={`ml-10 w-full md:ml-0 md:w-1/2 ${
                      isEven
                        ? "md:pr-12 md:text-right"
                        : "md:ml-auto md:pl-12 md:text-left"
                    }`}
                  >
                    <div className="rounded-xl border border-white/[0.06] bg-surface-glass p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.1] hover:shadow-glow">
                      <div
                        className={`mb-3 flex items-center gap-2 ${
                          isEven ? "md:flex-row-reverse" : ""
                        }`}
                      >
                        <span className="font-mono text-xs text-muted">
                          {le.date}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.badgeBg} ${config.badgeColor}`}
                        >
                          life event
                        </span>
                      </div>
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        {le.icon === "graduation"
                          ? "🎓"
                          : le.icon === "ring"
                            ? "💍"
                            : le.icon === "baby"
                              ? "👶"
                              : le.icon === "house"
                                ? "🏠"
                                : "⭐"}{" "}
                        {le.title}
                      </h3>
                      {le.description && (
                        <p className="mt-2 text-sm leading-relaxed text-muted">
                          {le.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </AnimateIn>
            );
          }

          // Experience entry
          const exp = entry as Experience & { _kind: "experience" };
          const hasRoles = exp.roles && exp.roles.length > 0;

          return (
            <AnimateIn
              key={`${exp.company}-${exp.startDate}`}
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
                        {exp.startDate} &mdash; {exp.endDate}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${config.badgeBg} ${config.badgeColor}`}
                      >
                        {exp.type}
                      </span>
                    </div>

                    {hasRoles ? (
                      <>
                        {/* Company header for multi-role */}
                        <h3 className="font-heading text-base font-semibold text-foreground mb-1">
                          {exp.company}
                        </h3>
                        <p className="mb-3 text-sm leading-relaxed text-muted">
                          {exp.description}
                        </p>

                        {/* Each role as sub-section */}
                        <div className="space-y-4">
                          {exp.roles!.map((role, ri) => (
                            <div
                              key={ri}
                              className="border-t border-white/[0.04] pt-3 first:border-0 first:pt-0"
                            >
                              <div
                                className={`flex items-baseline gap-2 mb-1 ${
                                  isEven ? "md:flex-row-reverse" : ""
                                }`}
                              >
                                <h4 className="text-sm font-semibold text-foreground">
                                  {role.title}
                                </h4>
                                <span className="font-mono text-[10px] text-muted">
                                  {role.startDate} – {role.endDate}
                                </span>
                              </div>

                              {/* Role highlights */}
                              {role.highlights.length > 0 && (
                                <ul
                                  className={`mb-2 space-y-1 text-sm text-muted/80 ${
                                    isEven ? "md:text-right" : ""
                                  }`}
                                >
                                  {role.highlights.map((highlight, hi) => (
                                    <li
                                      key={hi}
                                      className="flex items-start gap-2"
                                    >
                                      <span className="mt-1.5 block h-1 w-1 flex-shrink-0 rounded-full bg-purple/60" />
                                      <span>{highlight}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* Role stats */}
                              {role.stats && role.stats.length > 0 && (
                                <div
                                  className={`flex flex-wrap gap-1.5 ${
                                    isEven ? "md:justify-end" : ""
                                  }`}
                                >
                                  {role.stats.map((stat, si) => (
                                    <StatBadge
                                      key={si}
                                      label={stat.label}
                                      value={stat.value}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Single role */}
                        <h3 className="font-heading text-base font-semibold text-foreground">
                          {exp.role}
                        </h3>
                        <p className="mb-3 text-sm text-purple">
                          {exp.company}
                        </p>

                        {/* Description */}
                        <p className="mb-3 text-sm leading-relaxed text-muted">
                          {exp.description}
                        </p>

                        {/* Highlights */}
                        {exp.highlights && exp.highlights.length > 0 && (
                          <ul
                            className={`mb-3 space-y-1 text-sm text-muted/80 ${
                              isEven ? "md:text-right" : ""
                            }`}
                          >
                            {exp.highlights.map((highlight, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2"
                              >
                                <span className="mt-1.5 block h-1 w-1 flex-shrink-0 rounded-full bg-purple/60" />
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Stats */}
                        {exp.stats && exp.stats.length > 0 && (
                          <div
                            className={`flex flex-wrap gap-1.5 mb-3 ${
                              isEven ? "md:justify-end" : ""
                            }`}
                          >
                            {exp.stats.map((stat, si) => (
                              <StatBadge
                                key={si}
                                label={stat.label}
                                value={stat.value}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Tech tags */}
                    <div
                      className={`flex flex-wrap gap-1.5 mt-3 ${
                        isEven ? "md:justify-end" : ""
                      }`}
                    >
                      {exp.tech.map((t) => (
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
