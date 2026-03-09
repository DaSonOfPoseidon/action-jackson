import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Web applications, infrastructure tools, and automation systems built by Jackson Keithley. Explore professional, personal, and open-source projects.",
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
