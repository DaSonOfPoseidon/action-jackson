import type { Metadata } from "next";
import { AnimateIn } from "@/components/portfolio/AnimateIn";
import { SkillGrid } from "@/components/portfolio/SkillGrid";
import { Timeline } from "@/components/portfolio/Timeline";
import resume from "@/data/resume.json";
import type { ResumeData, SkillCategory, Experience } from "@/lib/portfolio-types";

const data = resume as ResumeData;

const timelineEntries: Experience[] = [
  ...data.experience,
  ...data.education.map((edu) => ({
    company: edu.institution,
    role: `${edu.degree} in ${edu.field}`,
    startDate: edu.startDate,
    endDate: edu.endDate,
    description: edu.description || "",
    highlights: [],
    tech: [],
    type: "education" as const,
  })),
].sort((a, b) => {
  const dateA = new Date(a.startDate);
  const dateB = new Date(b.startDate);
  return dateB.getTime() - dateA.getTime();
});

export const metadata: Metadata = {
  title: "About",
  description:
    "Full-stack developer and automation engineer based in Columbia, MO. Building web apps, infrastructure tools, and home networking solutions.",
};

export default function AboutPage() {
  return (
    <div className="pt-24">
      {/* Bio */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimateIn>
            <p className="font-mono text-purple text-sm tracking-widest uppercase mb-4">
              About Me
            </p>
          </AnimateIn>

          <div className="grid md:grid-cols-[1fr_280px] gap-12 items-start">
            <div>
              <AnimateIn delay={100}>
                <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6">
                  {data.contact.name}
                </h1>
              </AnimateIn>

              <AnimateIn delay={200}>
                <p className="text-lg text-muted leading-relaxed mb-4">
                  {data.summary}
                </p>
              </AnimateIn>

              <AnimateIn delay={300}>
                <p className="text-muted leading-relaxed mb-6">
                  Based in {data.contact.location}, I split my time between
                  building production web applications and running a networking
                  installation business. This dual background gives me a unique
                  perspective — I don&apos;t just write code, I deploy and maintain
                  the physical and virtual infrastructure it runs on.
                </p>
              </AnimateIn>

              <AnimateIn delay={400}>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`https://github.com/${data.contact.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass text-sm text-muted hover:text-foreground transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    GitHub
                  </a>
                  <a
                    href={`https://www.linkedin.com/in/${data.contact.linkedin}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass text-sm text-muted hover:text-foreground transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                  <a
                    href={`mailto:${data.contact.email}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg glass text-sm text-muted hover:text-foreground transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                </div>
              </AnimateIn>
            </div>

            <AnimateIn variant="scale-in" delay={200}>
              <div className="glass rounded-2xl p-1 shadow-glow">
                <div className="aspect-square rounded-xl bg-surface-light flex items-center justify-center overflow-hidden">
                  <div className="text-center p-6">
                    <div className="w-24 h-24 rounded-full bg-purple/20 border-2 border-purple/40 flex items-center justify-center mx-auto mb-3">
                      <span className="text-4xl font-heading font-bold text-purple">JK</span>
                    </div>
                    <p className="font-mono text-sm text-muted">{data.contact.location}</p>
                  </div>
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 px-6 relative">
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative z-10 max-w-5xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <p className="font-mono text-green text-sm tracking-widest uppercase mb-2">
                Experience
              </p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold">
                Timeline
              </h2>
            </div>
          </AnimateIn>

          <Timeline entries={timelineEntries} />
        </div>
      </section>

      {/* Skills */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-12">
              <p className="font-mono text-pink text-sm tracking-widest uppercase mb-2">
                Technologies
              </p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold">
                Skills &amp; Tools
              </h2>
            </div>
          </AnimateIn>

          <SkillGrid skills={data.skills as SkillCategory[]} />
        </div>
      </section>
    </div>
  );
}
