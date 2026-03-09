interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  // JSON-LD structured data for SEO - content is always server-defined, never user input
  const jsonString = JSON.stringify(data);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
}
