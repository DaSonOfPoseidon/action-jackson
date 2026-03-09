"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { ResumeData, Project } from "@/lib/portfolio-types";
import projects from "@/data/projects.json";

const allProjects = projects as Project[];

const styles = StyleSheet.create({
  page: {
    padding: 34,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a2e",
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 16,
    borderBottom: "2px solid #c084fc",
    paddingBottom: 12,
  },
  name: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    color: "#7c3aed",
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: "row",
    gap: 8,
    fontSize: 9,
    color: "#666",
  },
  contactLink: {
    color: "#7c3aed",
    textDecoration: "none",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#7c3aed",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 10,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  entryRole: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  entryDate: {
    fontSize: 9,
    color: "#666",
  },
  entryCompany: {
    fontSize: 9,
    color: "#7c3aed",
    marginBottom: 4,
  },
  roleLineItem: {
    fontSize: 9,
    color: "#333",
    marginBottom: 1,
  },
  bullet: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 2,
  },
  bulletDot: {
    fontSize: 9,
    color: "#7c3aed",
  },
  bulletText: {
    fontSize: 9,
    color: "#444",
    flex: 1,
  },
  techRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  techBadge: {
    fontSize: 8,
    color: "#666",
    backgroundColor: "#f0f0f5",
    padding: "2 6",
    borderRadius: 3,
  },
  skillRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  skillCategory: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    width: 100,
  },
  skillList: {
    fontSize: 9,
    color: "#444",
    flex: 1,
  },
  certRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  summary: {
    fontSize: 10,
    color: "#333",
    marginBottom: 4,
  },
  projectLine: {
    flexDirection: "row",
    marginBottom: 2,
    fontSize: 9,
  },
  projectTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: "#7c3aed",
    textDecoration: "none",
  },
  projectTagline: {
    fontSize: 9,
    color: "#444",
  },
});

interface ResumePDFProps {
  data: ResumeData;
}

export function ResumePDF({ data }: ResumePDFProps) {
  // Collect all notable project slugs from experience
  const notableSlugs = new Set<string>();
  for (const exp of data.experience) {
    if (exp.notableProjects) {
      for (const slug of exp.notableProjects) {
        notableSlugs.add(slug);
      }
    }
    if (exp.roles) {
      for (const role of exp.roles) {
        if (role.notableProjects) {
          for (const slug of role.notableProjects) {
            notableSlugs.add(slug);
          }
        }
      }
    }
  }
  const notableProjects = allProjects
    .filter((p) => notableSlugs.has(p.slug))
    .slice(0, 3);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{data.contact.name}</Text>
          <Text style={styles.title}>{data.contact.title}</Text>
          <View style={styles.contactRow}>
            <Text>{data.contact.location}</Text>
            <Text>|</Text>
            <Link src={`mailto:${data.contact.email}`} style={styles.contactLink}>
              {data.contact.email}
            </Link>
            <Text>|</Text>
            <Link
              src={`https://github.com/${data.contact.github}`}
              style={styles.contactLink}
            >
              github.com/{data.contact.github}
            </Link>
            <Text>|</Text>
            <Link
              src={`https://${data.contact.website}`}
              style={styles.contactLink}
            >
              {data.contact.website}
            </Link>
          </View>
        </View>

        {/* Summary */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.summary}>{data.summary}</Text>

        {/* Experience */}
        <Text style={styles.sectionTitle}>Experience</Text>
        {data.experience.map((exp, i) => {
          const hasRoles = exp.roles && exp.roles.length > 0;

          if (hasRoles) {
            // Consolidated multi-role block
            const allHighlights = exp.roles!.flatMap((r) => r.highlights);
            const bestHighlights = allHighlights.slice(0, 4);

            return (
              <View key={i} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryRole}>{exp.company}</Text>
                  <Text style={styles.entryDate}>
                    {exp.startDate} - {exp.endDate}
                  </Text>
                </View>
                {/* List role titles with dates */}
                {exp.roles!.map((role, ri) => (
                  <Text key={ri} style={styles.roleLineItem}>
                    {role.title} ({role.startDate} – {role.endDate})
                  </Text>
                ))}
                {/* Combined highlights */}
                <View style={{ marginTop: 3 }}>
                  {bestHighlights.map((h, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletDot}>{"\u2022"}</Text>
                      <Text style={styles.bulletText}>{h}</Text>
                    </View>
                  ))}
                </View>
                {exp.tech.length > 0 && (
                  <View style={styles.techRow}>
                    {exp.tech.map((t) => (
                      <Text key={t} style={styles.techBadge}>
                        {t}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          }

          // Single role entry — no description (highlights are sufficient)
          return (
            <View key={i} wrap={false}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryRole}>{exp.role}</Text>
                <Text style={styles.entryDate}>
                  {exp.startDate} - {exp.endDate}
                </Text>
              </View>
              <Text style={styles.entryCompany}>{exp.company}</Text>
              {(exp.highlights ?? []).map((h, j) => (
                <View key={j} style={styles.bullet}>
                  <Text style={styles.bulletDot}>{"\u2022"}</Text>
                  <Text style={styles.bulletText}>{h}</Text>
                </View>
              ))}
              {exp.tech.length > 0 && (
                <View style={styles.techRow}>
                  {exp.tech.map((t) => (
                    <Text key={t} style={styles.techBadge}>
                      {t}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Notable Projects */}
        {notableProjects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Notable Projects</Text>
            {notableProjects.map((project) => {
              const href = project.links.live || project.links.github || "";
              return (
                <View key={project.slug} style={styles.projectLine}>
                  <Link src={href} style={styles.projectTitle}>
                    {project.title}
                  </Link>
                  <Text style={styles.projectTagline}>
                    {" "}&mdash; {project.tagline}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Education */}
        <Text style={styles.sectionTitle}>Education</Text>
        {data.education.map((edu, i) => (
          <View key={i} wrap={false}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryRole}>
                {edu.degree} in {edu.field}
              </Text>
              <Text style={styles.entryDate}>
                {edu.startDate} - {edu.endDate}
              </Text>
            </View>
            <Text style={styles.entryCompany}>{edu.institution}</Text>
          </View>
        ))}

        {/* Skills */}
        <Text style={styles.sectionTitle}>Skills</Text>
        {data.skills.map((cat) => (
          <View key={cat.category} style={styles.skillRow}>
            <Text style={styles.skillCategory}>{cat.category}</Text>
            <Text style={styles.skillList}>{cat.skills.join(", ")}</Text>
          </View>
        ))}

        {/* Certifications */}
        {data.certifications.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Certifications</Text>
            {data.certifications.map((cert, i) => (
              <View key={i} style={styles.certRow}>
                <Text>
                  <Text style={styles.entryRole}>{cert.name}</Text>
                  <Text style={{ fontSize: 9, color: "#444" }}>
                    {" "}
                    - {cert.issuer}
                  </Text>
                </Text>
                <Text style={styles.entryDate}>{cert.date}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
