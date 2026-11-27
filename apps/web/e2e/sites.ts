// What each public site must show, written out here on purpose (not imported from the shared library): the specs
// check the built pages against an independent statement of what they should say.
export interface SiteExpectation {
  readonly key: 'main' | 'lan' | 'car' | 'dev';
  // The host the browser opens through the edge (http://<host>), and the production host the page names.
  readonly host: string;
  readonly production: string;
  readonly h1: string;
  readonly title: string;
  // A sentence the home page's <main> must contain.
  readonly text: string;
  // Whether the home page sits in the page frame (skip link, header with the switcher, footer). The main site's hub is a
  // whole screen without it; its not-found page has the frame.
  readonly framed: boolean;
}

export const SITES: readonly SiteExpectation[] = [
  {
    key: 'main',
    host: 'localhost',
    production: 'actionjacksoninstalls.com',
    h1: 'What are you looking for?',
    title: 'Home · Action Jackson',
    text: 'Developer portfolio',
    framed: false,
  },
  {
    key: 'lan',
    host: 'lan.localhost',
    production: 'lan.actionjacksoninstalls.com',
    h1: 'Upgrade Your Home Network.',
    title: 'Home · Action Jackson Home Networking',
    text: 'Smart networking and automation for builder-grade homes.',
    framed: true,
  },
  {
    key: 'car',
    host: 'car.localhost',
    production: 'car.actionjacksoninstalls.com',
    h1: 'Action Jackson · Car Audio & Remote Start',
    title: 'Home · Action Jackson Car Audio & Remote Start',
    text: 'This site is being rebuilt.',
    framed: true,
  },
  {
    key: 'dev',
    host: 'dev.localhost',
    production: 'dev.actionjacksoninstalls.com',
    h1: 'Jackson · Developer Portfolio',
    title: 'Home · Action Jackson Developer Portfolio',
    text: 'This site is being rebuilt.',
    framed: true,
  },
];

// The switcher's link text per site, in the order the switcher lists them.
export const SWITCHER_LABELS: Readonly<Record<SiteExpectation['key'], string>> = {
  main: 'Action Jackson',
  lan: 'Home Networking',
  car: 'Car Audio & Remote Start',
  dev: 'Developer Portfolio',
};

export function edgeOrigin(): string {
  const origin = process.env['EDGE_ORIGIN'];
  if (!origin) {
    throw new Error('EDGE_ORIGIN is not set');
  }
  return origin.replace(/\/+$/, '');
}

// The second edge, with the real API behind it, when the run has one (scripts/web-e2e.sh and the CI web job set it).
export function apiEdgeOrigin(): string | undefined {
  return process.env['EDGE_API_ORIGIN']?.replace(/\/+$/, '') || undefined;
}

// The URL a browser opens for a site: its Host name, port 80, which Chromium maps to the edge.
export const pageUrl = (host: string, path = '/'): string => `http://${host}${path}`;
