import type { IconName } from '../ui/icons';

// The about page's copy, ported word for word from frontend/app/(business)/about/page.tsx.

export const ABOUT_META = {
  title: 'About',
  description:
    'Home network performance specialist serving Columbia, MO. Engineered WiFi, structured cabling, smart home integration, and security systems.',
} as const;

export const EXPERTISE: readonly { readonly icon: IconName; readonly title: string; readonly description: string }[] = [
  {
    icon: 'network',
    title: 'Network Engineering',
    description:
      'Enterprise-grade routing, managed switching, VLAN segmentation, and wireless design tailored for residential environments. Proper throughput, proper security.',
  },
  {
    icon: 'smart-home',
    title: 'Smart Home Integration',
    description:
      'Centralized automation with local control. Hub configuration, device onboarding, and network isolation so your smart home stays fast and private.',
  },
  {
    icon: 'shield',
    title: 'Security Systems',
    description:
      'PoE camera installations with local NVR storage. No subscriptions, no cloud dependency. Motion zones, remote access, and UPS-backed recording.',
  },
  {
    icon: 'ethernet',
    title: 'Structured Cabling',
    description:
      'Cat6/Cat6a home runs, flush-mount wall plates, labeled patch panels, and clean cable management. Built to spec, built to last.',
  },
];

export const DIFFERENTIATORS: readonly { readonly title: string; readonly description: string }[] = [
  {
    title: 'Design Before Install',
    description:
      'Every project starts with a site survey and a documented plan. Cable pathways, AP placement, switch port allocation, and VLAN topology are mapped before anything gets mounted.',
  },
  {
    title: 'Clean, Concealed Work',
    description:
      'Flush-mount access points, concealed cable runs, and organized patch panels. The infrastructure should be invisible to the people living in the house.',
  },
  {
    title: 'Full Documentation',
    description:
      'You get a network diagram, device inventory, port map, and configuration summary. If you ever need to troubleshoot or hand it off to someone else, everything is documented.',
  },
  {
    title: 'Ongoing Support',
    description:
      'Networks evolve. New devices get added, firmware needs updating, and configurations need tuning. Post-install support is part of the service, not an afterthought.',
  },
];
