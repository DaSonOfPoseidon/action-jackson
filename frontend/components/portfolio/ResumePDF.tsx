"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { ResumeData } from "@/lib/portfolio-types";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#333",
    lineHeight: 1.2,
  },
  header: {
    marginBottom: 8,
    alignItems: "center",
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#000",
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: "row",
    gap: 5,
    fontSize: 7.5,
    color: "#444",
  },
  contactLink: {
    color: "#333",
    textDecoration: "none",
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#000",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 7,
    marginBottom: 3,
    paddingBottom: 1.5,
    borderBottom: "1pt solid #000",
  },
  companyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: "#000",
  },
  dateText: {
    fontSize: 7.5,
    color: "#666",
  },
  companyDescription: {
    fontSize: 7,
    color: "#555",
    marginBottom: 1.5,
    fontStyle: "italic",
  },
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 1.5,
  },
  roleTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Oblique",
    color: "#333",
  },
  roleLocation: {
    fontSize: 7.5,
    color: "#666",
  },
  bullet: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 1,
    paddingLeft: 6,
  },
  bulletDot: {
    fontSize: 7.5,
    color: "#333",
  },
  bulletText: {
    fontSize: 7.5,
    color: "#444",
    flex: 1,
  },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  projectName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: "#000",
  },
  skillBullet: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 1,
    paddingLeft: 6,
  },
  skillLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#333",
  },
  skillItems: {
    fontSize: 7.5,
    color: "#444",
  },
  eduRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  eduSchool: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: "#000",
  },
  eduDegree: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 8,
    color: "#333",
  },
});

interface ResumePDFProps {
  data: ResumeData;
}

export function ResumePDF({ data }: ResumePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{data.contact.name}</Text>
          <View style={styles.contactRow}>
            <Link src={`mailto:${data.contact.email}`} style={styles.contactLink}>
              {data.contact.email}
            </Link>
            <Text>|</Text>
            <Text>{data.contact.location}</Text>
            <Text>|</Text>
            <Link
              src={`https://linkedin.com/in/${data.contact.linkedin}`}
              style={styles.contactLink}
            >
              LinkedIn
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

        {/* Work Experience */}
        <Text style={styles.sectionTitle}>Work Experience</Text>
        {data.experience.map((exp, i) => (
          <View key={i}>
            {/* Company + date range */}
            <View style={styles.companyRow}>
              <Text style={styles.companyName}>{exp.company}</Text>
              <Text style={styles.dateText}>
                {exp.startDate} – {exp.endDate}
              </Text>
            </View>

            {/* Company description */}
            {exp.companyDescription && (
              <Text style={styles.companyDescription}>{exp.companyDescription}</Text>
            )}

            {/* Roles */}
            {exp.roles?.map((role, ri) => (
              <View key={ri}>
                <View style={styles.roleRow}>
                  <Text style={styles.roleTitle}>
                    {role.title} | {role.startDate} – {role.endDate}
                  </Text>
                  {role.location && (
                    <Text style={styles.roleLocation}>{role.location}</Text>
                  )}
                </View>
                <View style={{ marginTop: 1.5 }}>
                  {role.highlights.map((h, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletDot}>{"\u2022"}</Text>
                      <Text style={styles.bulletText}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Single-role fallback */}
            {!exp.roles && exp.highlights && (
              <View style={{ marginTop: 1.5 }}>
                {exp.highlights.map((h, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>{"\u2022"}</Text>
                    <Text style={styles.bulletText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Projects */}
        {data.pdfProjects && data.pdfProjects.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Projects</Text>
            {data.pdfProjects.map((proj, i) => (
              <View key={i}>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectName}>{proj.name}</Text>
                  <Text style={styles.dateText}>
                    {proj.startDate} – {proj.endDate}
                  </Text>
                </View>
                <View style={{ marginTop: 1.5 }}>
                  {proj.highlights.map((h, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletDot}>{"\u2022"}</Text>
                      <Text style={styles.bulletText}>{h}</Text>
                    </View>
                  ))}
                  <View style={styles.bullet}>
                    <Text style={styles.bulletDot}>{"\u2022"}</Text>
                    <Text style={styles.bulletText}>{proj.tech}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Skills, Technologies & Interests */}
        {data.pdfSkills && data.pdfSkills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Skills, Technologies & Interests
            </Text>
            {data.pdfSkills.map((line, i) => (
              <View key={i} style={styles.skillBullet}>
                <Text style={styles.bulletDot}>{"\u2022"}</Text>
                <Text style={styles.skillItems}>
                  <Text style={styles.skillLabel}>{line.label}: </Text>
                  {line.items.join("; ")}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Education */}
        <Text style={styles.sectionTitle}>Education</Text>
        {data.education.map((edu, i) => (
          <View key={i}>
            <View style={styles.eduRow}>
              <Text style={styles.eduSchool}>{edu.institution}</Text>
              <Text style={styles.dateText}>
                {edu.endDate}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.eduDegree}>
                {edu.degree} in {edu.field}
              </Text>
              <Text style={styles.roleLocation}>{data.contact.location}</Text>
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}
