import { describe, it, expect } from "vitest";
import resume from "@/data/resume.json";
import projects from "@/data/projects.json";
import skills from "@/data/skills.json";
import type { ResumeData, Project, SkillCategory } from "@/lib/types";

describe("Data integrity", () => {
  describe("resume.json", () => {
    const data = resume as ResumeData;

    it("has valid contact info", () => {
      expect(data.contact.name).toBeTruthy();
      expect(data.contact.email).toContain("@");
      expect(data.contact.github).toBeTruthy();
      expect(data.contact.linkedin).toBeTruthy();
      expect(data.contact.website).toBeTruthy();
    });

    it("has a summary", () => {
      expect(data.summary.length).toBeGreaterThan(20);
    });

    it("has experience entries", () => {
      expect(data.experience.length).toBeGreaterThan(0);
      data.experience.forEach((exp) => {
        expect(exp.company).toBeTruthy();
        expect(exp.role).toBeTruthy();
        expect(exp.startDate).toBeTruthy();
        expect(exp.endDate).toBeTruthy();
        expect(exp.type).toBe("work");
      });
    });

    it("has education entries", () => {
      expect(data.education.length).toBeGreaterThan(0);
      data.education.forEach((edu) => {
        expect(edu.institution).toBeTruthy();
        expect(edu.degree).toBeTruthy();
        expect(edu.field).toBeTruthy();
      });
    });

    it("has skill categories", () => {
      expect(data.skills.length).toBeGreaterThan(0);
      data.skills.forEach((cat) => {
        expect(cat.category).toBeTruthy();
        expect(cat.skills.length).toBeGreaterThan(0);
      });
    });
  });

  describe("projects.json", () => {
    const data = projects as Project[];

    it("has projects", () => {
      expect(data.length).toBeGreaterThan(0);
    });

    it("each project has required fields", () => {
      data.forEach((p) => {
        expect(p.slug).toBeTruthy();
        expect(p.title).toBeTruthy();
        expect(p.tagline).toBeTruthy();
        expect(p.description).toBeTruthy();
        expect(p.stack.length).toBeGreaterThan(0);
        expect(["web-app", "tool", "infrastructure"]).toContain(p.category);
      });
    });

    it("has highlighted projects", () => {
      const highlighted = data.filter((p) => p.highlighted);
      expect(highlighted.length).toBeGreaterThan(0);
    });

    it("slugs are unique", () => {
      const slugs = data.map((p) => p.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  describe("skills.json", () => {
    const data = skills as SkillCategory[];

    it("has skill categories", () => {
      expect(data.length).toBeGreaterThan(0);
    });

    it("each category has skills", () => {
      data.forEach((cat) => {
        expect(cat.category).toBeTruthy();
        expect(cat.icon).toBeTruthy();
        expect(cat.color).toBeTruthy();
        expect(cat.skills.length).toBeGreaterThan(0);
      });
    });
  });
});
