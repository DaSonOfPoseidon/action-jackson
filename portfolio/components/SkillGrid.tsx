"use client";

import { AnimateIn } from "@/components/AnimateIn";
import type { SkillCategory } from "@/lib/types";

const iconMap: Record<string, string> = {
  terminal: "\uD83D\uDCBB",
  layers: "\uD83C\uDFD7\uFE0F",
  server: "\uD83D\uDDA5\uFE0F",
  database: "\uD83D\uDDC4\uFE0F",
  wrench: "\uD83D\uDD27",
  wifi: "\uD83D\uDCE1",
};

const colorMap: Record<string, string> = {
  purple: "text-purple",
  green: "text-green",
  pink: "text-pink",
  cyan: "text-cyan",
};

interface SkillGridProps {
  skills: SkillCategory[];
}

export function SkillGrid({ skills }: SkillGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((category, index) => (
        <AnimateIn
          key={category.category}
          delay={index * 100}
          variant="scale-in"
        >
          <div className="group rounded-xl border border-white/[0.06] bg-surface-glass p-5 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.1] hover:shadow-glow">
            {/* Icon & category name */}
            <div className="mb-4 flex items-center gap-3">
              <span
                className="text-2xl"
                role="img"
                aria-label={category.icon}
              >
                {iconMap[category.icon] || "\uD83D\uDCBB"}
              </span>
              <h3
                className={`font-heading text-sm font-semibold uppercase tracking-wider ${
                  colorMap[category.color] || "text-purple"
                }`}
              >
                {category.category}
              </h3>
            </div>

            {/* Skill badges */}
            <div className="flex flex-wrap gap-1.5">
              {category.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-md bg-white/[0.04] px-2 py-1 text-xs text-muted ring-1 ring-inset ring-white/[0.06] transition-colors group-hover:text-foreground/80"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </AnimateIn>
      ))}
    </div>
  );
}
