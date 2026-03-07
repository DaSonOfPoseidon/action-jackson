"use client";

import { motion } from "framer-motion";
import { AnimateIn } from "@/components/AnimateIn";
import type { Project } from "@/lib/types";

const categoryConfig: Record<
  Project["category"],
  { label: string; color: string; bg: string }
> = {
  "web-app": {
    label: "Web App",
    color: "text-purple",
    bg: "bg-purple-muted/40",
  },
  tool: {
    label: "Tool",
    color: "text-green",
    bg: "bg-green-muted/40",
  },
  infrastructure: {
    label: "Infrastructure",
    color: "text-pink",
    bg: "bg-pink-muted/40",
  },
};

interface ProjectCardProps {
  project: Project;
  delay?: number;
}

export function ProjectCard({ project, delay = 0 }: ProjectCardProps) {
  const cat = categoryConfig[project.category];

  return (
    <AnimateIn delay={delay} variant="fade-up">
      <motion.article
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="group relative flex h-full flex-col rounded-xl border border-white/[0.06] bg-surface-glass p-6 backdrop-blur-sm transition-shadow duration-300 hover:border-purple/30 hover:shadow-glow"
      >
        {/* Category badge */}
        <div className="mb-4 flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cat.bg} ${cat.color}`}
          >
            {cat.label}
          </span>

          {/* Links */}
          <div className="flex items-center gap-2">
            {project.links.github && (
              <a
                href={project.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
                aria-label={`${project.title} on GitHub`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            )}
            {project.links.live && (
              <a
                href={project.links.live}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
                aria-label={`${project.title} live site`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Title & tagline */}
        <h3 className="mb-2 font-heading text-lg font-semibold text-foreground transition-colors group-hover:text-purple">
          {project.title}
        </h3>
        <p className="mb-4 flex-1 text-sm leading-relaxed text-muted">
          {project.tagline}
        </p>

        {/* Stack badges */}
        <div className="flex flex-wrap gap-1.5">
          {project.stack.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-muted ring-1 ring-inset ring-white/[0.06]"
            >
              {tech}
            </span>
          ))}
        </div>
      </motion.article>
    </AnimateIn>
  );
}
