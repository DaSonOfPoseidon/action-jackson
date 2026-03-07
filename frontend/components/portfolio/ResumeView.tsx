import type { ResumeData } from "@/lib/portfolio-types";

interface ResumeViewProps {
  data: ResumeData;
}

export function ResumeView({ data }: ResumeViewProps) {
  return (
    <div className="glass rounded-2xl p-8 md:p-12 space-y-10">
      {/* Contact Bar */}
      <div className="flex flex-wrap gap-4 text-sm text-muted font-mono pb-6 border-b border-border">
        <span>{data.contact.location}</span>
        <span className="hidden sm:inline text-border">|</span>
        <a href={`mailto:${data.contact.email}`} className="hover:text-purple transition-colors">
          {data.contact.email}
        </a>
        <span className="hidden sm:inline text-border">|</span>
        <a
          href={`https://github.com/${data.contact.github}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-purple transition-colors"
        >
          github.com/{data.contact.github}
        </a>
        <span className="hidden sm:inline text-border">|</span>
        <a
          href={`https://${data.contact.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-purple transition-colors"
        >
          {data.contact.website}
        </a>
      </div>

      {/* Summary */}
      <div>
        <h2 className="font-heading text-lg font-bold text-purple uppercase tracking-wider mb-3">
          Summary
        </h2>
        <p className="text-foreground leading-relaxed">{data.summary}</p>
      </div>

      {/* Experience */}
      <div>
        <h2 className="font-heading text-lg font-bold text-purple uppercase tracking-wider mb-4">
          Experience
        </h2>
        <div className="space-y-6">
          {data.experience.map((exp, i) => (
            <div key={i} className="group">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h3 className="font-heading font-semibold text-foreground">
                  {exp.role}
                </h3>
                <span className="font-mono text-xs text-muted">
                  {exp.startDate} &ndash; {exp.endDate}
                </span>
              </div>
              <p className="text-sm text-purple mb-2">{exp.company}</p>
              {exp.description && (
                <p className="text-sm text-muted mb-2">{exp.description}</p>
              )}
              {exp.highlights.length > 0 && (
                <ul className="space-y-1">
                  {exp.highlights.map((h, j) => (
                    <li key={j} className="text-sm text-muted flex gap-2">
                      <span className="text-purple shrink-0 mt-1">&bull;</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
              {exp.tech.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {exp.tech.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 text-xs font-mono rounded bg-surface-light text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div>
        <h2 className="font-heading text-lg font-bold text-purple uppercase tracking-wider mb-4">
          Education
        </h2>
        <div className="space-y-4">
          {data.education.map((edu, i) => (
            <div key={i}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h3 className="font-heading font-semibold text-foreground">
                  {edu.degree} in {edu.field}
                </h3>
                <span className="font-mono text-xs text-muted">
                  {edu.startDate} &ndash; {edu.endDate}
                </span>
              </div>
              <p className="text-sm text-purple">{edu.institution}</p>
              {edu.description && (
                <p className="text-sm text-muted mt-1">{edu.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <h2 className="font-heading text-lg font-bold text-purple uppercase tracking-wider mb-4">
          Skills
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {data.skills.map((cat) => (
            <div key={cat.category}>
              <h3 className="font-mono text-sm font-medium text-foreground mb-2">
                {cat.category}
              </h3>
              <p className="text-sm text-muted">
                {cat.skills.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Certifications */}
      {data.certifications.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold text-purple uppercase tracking-wider mb-4">
            Certifications
          </h2>
          <div className="space-y-2">
            {data.certifications.map((cert, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-foreground font-medium">{cert.name}</span>
                  <span className="text-muted text-sm ml-2">&mdash; {cert.issuer}</span>
                </div>
                <span className="font-mono text-xs text-muted">{cert.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
