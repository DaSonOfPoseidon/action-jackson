import type { Metadata } from "next";
import { AnimateIn } from "@/components/portfolio/AnimateIn";
import { ProjectCard } from "@/components/portfolio/ProjectCard";
import { SkillGrid } from "@/components/portfolio/SkillGrid";
import projects from "@/data/projects.json";
import resume from "@/data/resume.json";
import type { Project, ResumeData, SkillCategory } from "@/lib/portfolio-types";

export const metadata: Metadata = {
  title: "Jackson Keithley | Developer Portfolio",
  description:
    "Full-stack developer and automation engineer building web apps, infrastructure tools, and home automation systems. Available for hire in Columbia, MO.",
};

const skills = (resume as ResumeData).skills;
import Link from "next/link";

const featured = (projects as Project[]).filter((p) => p.highlighted);

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 dot-grid opacity-40" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">
          <AnimateIn variant="fade-in" delay={0}>
            <p className="font-mono text-purple text-sm tracking-widest uppercase mb-4">
              <span className="text-pink">~/</span>jackson-keithley
              <span className="inline-block w-2 h-4 bg-purple ml-1 animate-terminal-blink" />
            </p>
          </AnimateIn>

          <AnimateIn variant="fade-up" delay={100}>
            <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="text-foreground">Full-Stack Developer</span>
              <br />
              <span className="bg-gradient-to-r from-purple via-pink to-green bg-clip-text text-transparent">
                &amp; Automation Engineer
              </span>
            </h1>
          </AnimateIn>

          <AnimateIn variant="fade-up" delay={250}>
            <p className="text-muted text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
              I build web applications, infrastructure tools, and home automation
              systems. From FastAPI backends to Next.js frontends, Docker
              deployments to fiber installations &mdash; I engineer solutions
              end-to-end.
            </p>
          </AnimateIn>

          <AnimateIn variant="fade-up" delay={400}>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 hover:border-purple/50 transition-all font-medium"
              >
                View Projects
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/resume"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:border-purple/30 transition-all font-medium"
              >
                Resume
              </Link>
              <a
                href="https://github.com/DaSonOfPoseidon"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:border-green/30 transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="flex items-center justify-between mb-12">
              <div>
                <p className="font-mono text-purple text-sm tracking-widest uppercase mb-2">
                  Featured Work
                </p>
                <h2 className="font-heading text-3xl md:text-4xl font-bold">
                  Recent Projects
                </h2>
              </div>
              <Link
                href="/projects"
                className="hidden md:inline-flex items-center gap-2 text-muted hover:text-purple transition-colors font-mono text-sm"
              >
                View all
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((project, i) => (
              <AnimateIn key={project.slug} delay={i * 100}>
                <ProjectCard project={project} />
              </AnimateIn>
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-muted hover:text-purple transition-colors font-mono text-sm"
            >
              View all projects
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Skills Overview */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-12">
              <p className="font-mono text-green text-sm tracking-widest uppercase mb-2">
                Toolkit
              </p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold">
                Skills &amp; Technologies
              </h2>
            </div>
          </AnimateIn>

          <SkillGrid skills={skills as SkillCategory[]} />
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <AnimateIn>
            <p className="font-mono text-pink text-sm tracking-widest uppercase mb-4">
              Get In Touch
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
              Let&apos;s Build Something
            </h2>
            <p className="text-muted text-lg mb-8">
              Looking for a developer who bridges software and infrastructure?
              Check out my work or reach out directly.
            </p>
          </AnimateIn>
          <AnimateIn delay={150}>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="mailto:jackson@actionjacksoninstalls.com"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 hover:border-purple/50 transition-all font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Me
              </a>
              <a
                href="https://www.linkedin.com/in/jackson-keithley-115582213/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:border-cyan/30 transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            </div>
          </AnimateIn>
        </div>
      </section>
    </>
  );
}
