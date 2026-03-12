import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import projects from "@/data/projects.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const headersList = headers();
  const host = headersList.get("host") ?? "";
  const isPortfolio = host.startsWith("dev.");

  const businessBase = "https://actionjacksoninstalls.com";
  const portfolioBase = "https://dev.actionjacksoninstalls.com";

  const businessPages: MetadataRoute.Sitemap = [
    {
      url: businessBase,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${businessBase}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${businessBase}/get-started`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${businessBase}/services/networking`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${businessBase}/services/cameras`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${businessBase}/services/smart-home`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${businessBase}/services/wiring`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const projectSlugs = (projects as { slug: string }[]).map((p) => p.slug);

  const portfolioPages: MetadataRoute.Sitemap = [
    {
      url: portfolioBase,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${portfolioBase}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${portfolioBase}/projects`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${portfolioBase}/resume`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...projectSlugs.map((slug) => ({
      url: `${portfolioBase}/projects/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  if (isPortfolio) {
    return portfolioPages;
  }

  return businessPages;
}
