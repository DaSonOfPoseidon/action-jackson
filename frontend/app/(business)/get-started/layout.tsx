import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description:
    "Schedule a free consultation for home networking, smart home automation, or security camera installation in Columbia, MO. Custom proposals within 24 hours.",
};

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
