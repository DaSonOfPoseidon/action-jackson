import { canonicalUrl } from '@aj/shared';
import type { ServiceLink } from './service-links';
import type { Service } from './services';

// The structured data (schema.org JSON-LD), ported from the original's layout and service pages (components/JsonLd.tsx
// and the schemas in app/(business)/layout.tsx and services/*/page.tsx), built from the same constants as the visible
// pages. The URLs are this site's canonical ones: the original named the apex host, which now redirects here.

const url = (path: string): string => canonicalUrl('lan', path);

export function localBusiness(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Action Jackson Installs',
    description: 'Smart home networking and automation services for builder-grade homes in Columbia, MO.',
    url: url('/'),
    areaServed: { '@type': 'Place', name: 'Columbia, MO area' },
    serviceType: ['Networking', 'Smart Home Automation', 'Security Cameras', 'Structured Cabling'],
  };
}

export function breadcrumbList(service: ServiceLink): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: url('/') },
      { '@type': 'ListItem', position: 2, name: 'Services' },
      { '@type': 'ListItem', position: 3, name: service.breadcrumbName, item: url(service.path) },
    ],
  };
}

export function faqPage(service: Service): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: service.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}
