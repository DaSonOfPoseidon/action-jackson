import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders hero section", () => {
    render(<HomePage />);
    expect(screen.getByText("Upgrade Your Home Network.")).toBeInTheDocument();
  });

  it("renders problem section heading", () => {
    render(<HomePage />);
    expect(screen.getByText("Sound familiar?")).toBeInTheDocument();
  });

  it("renders all four problem cards", () => {
    render(<HomePage />);
    expect(screen.getByText("ISP Router in a Closet")).toBeInTheDocument();
    expect(screen.getByText("Smart Devices Competing")).toBeInTheDocument();
    expect(screen.getByText("Weak WiFi Coverage")).toBeInTheDocument();
    expect(screen.getByText("Subscription Camera Overload")).toBeInTheDocument();
  });

  it("renders solution section", () => {
    render(<HomePage />);
    expect(screen.getByText("The engineered alternative.")).toBeInTheDocument();
  });

  it("renders packages section with all four packages", () => {
    render(<HomePage />);
    expect(screen.getByText("Service Packages")).toBeInTheDocument();
    expect(screen.getByText("Foundation Network")).toBeInTheDocument();
    expect(screen.getByText("Smart Home Backbone")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Performance + Protection")).toBeInTheDocument();
  });

  it("renders why section", () => {
    render(<HomePage />);
    expect(screen.getByText("Why Action Jackson?")).toBeInTheDocument();
  });

  it("renders monospace section labels", () => {
    render(<HomePage />);
    expect(screen.getByText("The Problem")).toBeInTheDocument();
    expect(screen.getByText("The Solution")).toBeInTheDocument();
    expect(screen.getByText("Why Us")).toBeInTheDocument();
  });

  it("renders CTA band", () => {
    render(<HomePage />);
    expect(screen.getByText("Ready to upgrade your network?")).toBeInTheDocument();
  });
});
