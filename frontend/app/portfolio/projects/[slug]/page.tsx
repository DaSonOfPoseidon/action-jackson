import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import projects from "@/data/projects.json";
import type { Project } from "@/lib/portfolio-types";

const allProjects = projects as Project[];

const tagConfig: Record<string, { color: string; bg: string }> = {
  professional: { color: "text-cyan-400", bg: "bg-cyan-400/10" },
  personal: { color: "text-green", bg: "bg-green-muted/40" },
  school: { color: "text-orange", bg: "bg-orange-muted/40" },
  desktop: { color: "text-pink", bg: "bg-pink-muted/40" },
  mobile: { color: "text-purple", bg: "bg-purple-muted/40" },
  infrastructure: { color: "text-slate-400", bg: "bg-slate-400/10" },
  web: { color: "text-blue-400", bg: "bg-blue-400/10" },
  tool: { color: "text-amber-400", bg: "bg-amber-400/10" },
};

const defaultTagStyle = { color: "text-muted", bg: "bg-white/[0.06]" };

export function generateStaticParams() {
  return allProjects.map((project) => ({
    slug: project.slug,
  }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const project = allProjects.find((p) => p.slug === params.slug);
  if (!project) return { title: "Project Not Found" };

  return {
    title: project.title,
    description: project.tagline,
    alternates: {
      canonical: `https://dev.actionjacksoninstalls.com/projects/${project.slug}`,
    },
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const project = allProjects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  return (
    <div className="pt-24">
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Back nav */}
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-muted hover:text-purple transition-colors font-mono text-sm mb-8"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16l-4-4m0 0l4-4m-4 4h18"
              />
            </svg>
            All Projects
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {project.tags.map((tag) => {
                const style = tagConfig[tag] ?? defaultTagStyle;
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>

            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-3">
              {project.title}
            </h1>
            <p className="text-muted text-lg">{project.tagline}</p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-3 mb-12">
            {project.links.github && (
              <a
                href={project.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  project.isPrivate
                    ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    : "border-border text-muted hover:text-foreground hover:border-purple/30"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {project.isPrivate ? "Private Repo" : "GitHub"}
              </a>
            )}
            {project.links.live && (
              <a
                href={project.links.live}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 hover:border-purple/50 transition-all text-sm font-medium"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                Live Site
              </a>
            )}
          </div>

          {/* Description */}
          <div className="mb-12">
            <h2 className="font-heading text-xl font-semibold mb-4">About</h2>
            <p className="text-muted leading-relaxed">{project.description}</p>
          </div>

          {/* Features */}
          {project.features.length > 0 && (
            <div className="mb-12">
              <h2 className="font-heading text-xl font-semibold mb-4">
                Features
              </h2>
              <ul className="space-y-3">
                {project.features.map((feature, i) => (
                  <li key={i} className="flex gap-3 text-muted">
                    <svg
                      className="w-5 h-5 text-green mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tech Stack */}
          <div className="mb-12">
            <h2 className="font-heading text-xl font-semibold mb-4">
              Tech Stack
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.stack.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center rounded-lg bg-white/[0.04] px-3 py-1.5 text-sm text-muted ring-1 ring-inset ring-white/[0.06]"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
