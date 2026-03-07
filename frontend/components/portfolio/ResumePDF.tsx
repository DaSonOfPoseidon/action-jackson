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
    padding: 40,
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
    marginTop: 14,
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
  entryDescription: {
    fontSize: 9,
    color: "#444",
    marginBottom: 4,
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
        {data.experience.map((exp, i) => (
          <View key={i} wrap={false}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryRole}>{exp.role}</Text>
              <Text style={styles.entryDate}>
                {exp.startDate} - {exp.endDate}
              </Text>
            </View>
            <Text style={styles.entryCompany}>{exp.company}</Text>
            {exp.description ? (
              <Text style={styles.entryDescription}>{exp.description}</Text>
            ) : null}
            {exp.highlights.map((h, j) => (
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
        ))}

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
                  <Text style={styles.entryDescription}>
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
