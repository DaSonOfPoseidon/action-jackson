import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/auth"],
      },
    ],
    sitemap: [
      "https://actionjacksoninstalls.com/sitemap.xml",
      "https://dev.actionjacksoninstalls.com/sitemap.xml",
    ],
  };
}
