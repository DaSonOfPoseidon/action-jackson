import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe("Page smoke tests", () => {
  it("home page renders without errors", async () => {
    const { default: HomePage } = await import("@/app/page");
    render(<HomePage />);
    expect(
      screen.getByText("Full-Stack Developer")
    ).toBeInTheDocument();
  });

  it("projects page renders without errors", async () => {
    const { default: ProjectsPage } = await import("@/app/projects/page");
    render(<ProjectsPage />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });
});
