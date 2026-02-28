import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PackageCard } from "@/components/sections/PackageCard";

describe("PackageCard", () => {
  const props = {
    name: "Foundation Network",
    priceRange: "$799\u2013$1,499",
    idealFor: "Builder-grade homes using ISP router only.",
    includes: [
      "Network assessment",
      "Router/firewall configuration",
      "1\u20132 PoE access point install",
    ],
  };

  it("renders package name", () => {
    render(<PackageCard {...props} />);
    expect(screen.getByText("Foundation Network")).toBeInTheDocument();
  });

  it("renders price range", () => {
    render(<PackageCard {...props} />);
    expect(screen.getByText("$799\u2013$1,499")).toBeInTheDocument();
  });

  it("renders ideal for text", () => {
    render(<PackageCard {...props} />);
    expect(screen.getByText(props.idealFor)).toBeInTheDocument();
  });

  it("renders all inclusion items", () => {
    render(<PackageCard {...props} />);
    props.includes.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it("renders CTA link", () => {
    render(<PackageCard {...props} />);
    expect(screen.getByText("Schedule Consultation")).toBeInTheDocument();
  });

  it("shows Most Popular badge when featured", () => {
    render(<PackageCard {...props} featured />);
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("does not show badge when not featured", () => {
    render(<PackageCard {...props} />);
    expect(screen.queryByText("Most Popular")).not.toBeInTheDocument();
  });
});
