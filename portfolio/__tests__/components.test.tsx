import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "@/components/ProjectCard";
import { SkillGrid } from "@/components/SkillGrid";
import { ResumeView } from "@/components/ResumeView";
import type { Project, SkillCategory, ResumeData } from "@/lib/types";

const mockProject: Project = {
  slug: "test-project",
  title: "Test Project",
  tagline: "A test project",
  description: "This is a test project for testing.",
  stack: ["React", "TypeScript"],
  features: ["Feature 1", "Feature 2"],
  links: { github: "https://github.com/test/test" },
  category: "web-app",
  highlighted: true,
};

const mockSkills: SkillCategory[] = [
  {
    category: "Languages",
    icon: "terminal",
    color: "purple",
    skills: ["Python", "TypeScript"],
  },
  {
    category: "Frameworks",
    icon: "layers",
    color: "pink",
    skills: ["React", "Next.js"],
  },
];

const mockResume: ResumeData = {
  contact: {
    name: "Test User",
    title: "Developer",
    email: "test@example.com",
    location: "Test City",
    github: "testuser",
    linkedin: "testuser",
    website: "test.dev",
  },
  summary: "A skilled developer with experience in testing.",
  experience: [
    {
      company: "Test Corp",
      role: "Senior Developer",
      startDate: "2023",
      endDate: "Present",
      description: "Building test suites.",
      highlights: ["Built testing framework", "Improved coverage"],
      tech: ["Vitest", "React"],
      type: "work",
    },
  ],
  education: [
    {
      institution: "Test University",
      degree: "B.S.",
      field: "Computer Science",
      startDate: "2019",
      endDate: "2023",
    },
  ],
  skills: mockSkills,
  certifications: [
    {
      name: "Test Cert",
      issuer: "Test Org",
      date: "2024",
    },
  ],
};

describe("ProjectCard", () => {
  it("renders project title and tagline", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("A test project")).toBeInTheDocument();
  });

  it("renders stack badges", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders github link", () => {
    render(<ProjectCard project={mockProject} />);
    const link = screen.getByRole("link", { name: /github/i });
    expect(link).toHaveAttribute("href", "https://github.com/test/test");
  });
});

describe("SkillGrid", () => {
  it("renders all categories", () => {
    render(<SkillGrid skills={mockSkills} />);
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("Frameworks")).toBeInTheDocument();
  });

  it("renders skills within categories", () => {
    render(<SkillGrid skills={mockSkills} />);
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Next.js")).toBeInTheDocument();
  });
});

describe("ResumeView", () => {
  it("renders contact info", () => {
    render(<ResumeView data={mockResume} />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Test City")).toBeInTheDocument();
  });

  it("renders summary", () => {
    render(<ResumeView data={mockResume} />);
    expect(
      screen.getByText("A skilled developer with experience in testing.")
    ).toBeInTheDocument();
  });

  it("renders experience", () => {
    render(<ResumeView data={mockResume} />);
    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText("Test Corp")).toBeInTheDocument();
  });

  it("renders education", () => {
    render(<ResumeView data={mockResume} />);
    expect(screen.getByText("Test University")).toBeInTheDocument();
  });

  it("renders certifications", () => {
    render(<ResumeView data={mockResume} />);
    expect(screen.getByText("Test Cert")).toBeInTheDocument();
  });
});
