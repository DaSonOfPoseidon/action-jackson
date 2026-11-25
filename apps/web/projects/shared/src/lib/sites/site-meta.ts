import type { SiteKey } from './site-registry';

// What each site calls itself. The registry (contracts/sites.json) is about hosts; the words live here.
export interface SiteMeta {
  // The home page's h1 and the footer's name.
  readonly name: string;
  // The switcher's link text.
  readonly label: string;
  // After the page name in <title>, and og:site_name: "<page> · <titleSuffix>".
  readonly titleSuffix: string;
  // The default meta description, for a route that sets none.
  readonly description: string;
}

export const SITE_META: Readonly<Record<SiteKey, SiteMeta>> = {
  main: {
    name: 'Action Jackson',
    label: 'Action Jackson',
    titleSuffix: 'Action Jackson',
    description: 'Action Jackson: home networking and car audio installs, and the developer behind them.',
  },
  lan: {
    name: 'Action Jackson Installs · Home Networking',
    label: 'Home Networking',
    titleSuffix: 'Action Jackson Home Networking',
    description: 'Home networking installs by Action Jackson: wired and wireless networks, cameras and media panels.',
  },
  car: {
    name: 'Action Jackson · Car Audio & Remote Start',
    label: 'Car Audio & Remote Start',
    titleSuffix: 'Action Jackson Car Audio & Remote Start',
    description: 'Car audio and remote-start installs by Action Jackson.',
  },
  dev: {
    name: 'Jackson · Developer Portfolio',
    label: 'Developer Portfolio',
    titleSuffix: 'Action Jackson Developer Portfolio',
    description: "Jackson's developer portfolio: projects, skills and resume.",
  },
  admin: {
    name: 'Action Jackson Admin',
    label: 'Admin',
    titleSuffix: 'Action Jackson Admin',
    description: 'Action Jackson administration.',
  },
};
