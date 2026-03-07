"use client";

import { useState } from "react";
import { AnimateIn } from "@/components/portfolio/AnimateIn";
import { ProjectCard } from "@/components/portfolio/ProjectCard";
import projects from "@/data/projects.json";
import type { Project } from "@/lib/portfolio-types";

const allProjects = projects as Project[];
const categories = ["all", "web-app", "tool", "infrastructure"] as const;

const categoryLabels: Record<string, string> = {
  all: "All",
  "web-app": "Web Apps",
  tool: "Tools",
  infrastructure: "Infrastructure",
};

export default function ProjectsPage() {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? allProjects
      : allProjects.filter((p) => p.category === filter);

  return (
    <div className="pt-24">
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <p className="font-mono text-purple text-sm tracking-widest uppercase mb-4">
              Portfolio
            </p>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">
              Projects
            </h1>
            <p className="text-muted text-lg max-w-2xl mb-10">
              A collection of web applications, infrastructure tools, and
              automation systems I&apos;ve built.
            </p>
          </AnimateIn>

          <AnimateIn delay={100}>
            <div className="flex flex-wrap gap-2 mb-10">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                    filter === cat
                      ? "bg-purple/20 border border-purple/40 text-purple"
                      : "border border-border text-muted hover:text-foreground hover:border-purple/30"
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((project, i) => (
              <AnimateIn key={project.slug} delay={i * 80}>
                <ProjectCard project={project} />
              </AnimateIn>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted font-mono">No projects in this category yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
