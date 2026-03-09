import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
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
  ];

  return [...businessPages, ...portfolioPages];
}
