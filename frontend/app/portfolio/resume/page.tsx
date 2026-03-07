import type { Metadata } from "next";
import { ResumeView } from "@/components/portfolio/ResumeView";
import { DownloadButton } from "@/components/portfolio/DownloadButton";
import { AnimateIn } from "@/components/portfolio/AnimateIn";
import resume from "@/data/resume.json";
import type { ResumeData } from "@/lib/portfolio-types";

const data = resume as ResumeData;

export const metadata: Metadata = {
  title: "Resume",
  description: `Resume for ${data.contact.name} - ${data.contact.title}`,
};

export default function ResumePage() {
  return (
    <div className="pt-24">
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimateIn>
            <div className="flex items-start justify-between mb-10 flex-wrap gap-4">
              <div>
                <p className="font-mono text-purple text-sm tracking-widest uppercase mb-2">
                  Resume
                </p>
                <h1 className="font-heading text-4xl md:text-5xl font-bold">
                  {data.contact.name}
                </h1>
                <p className="text-muted text-lg mt-2">{data.contact.title}</p>
              </div>
              <DownloadButton resumeData={data} />
            </div>
          </AnimateIn>

          <AnimateIn delay={100}>
            <ResumeView data={data} />
          </AnimateIn>
        </div>
      </section>
    </div>
  );
}
