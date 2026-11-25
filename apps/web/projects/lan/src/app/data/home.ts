import type { IconName } from '../ui/icons';
import type { Accent } from './service-links';

// The home page's copy, ported word for word from frontend/app/(business)/page.tsx. The prices are the original's copy
// (issue #38 is about the catalog disagreeing with some of them); nothing here is computed from them.

export const HOME_META = {
  description:
    'Upgrade your builder-grade home network with engineered WiFi, VLAN segmentation, PoE cameras, and structured wiring. Serving Columbia, MO.',
} as const;

export const PROBLEMS: readonly { readonly icon: IconName; readonly title: string; readonly description: string; readonly long?: string }[] = [
  {
    icon: 'door',
    title: 'ISP Router in a Closet',
    description: "Your internet service provider gave you one router and called it a day. It's buried behind coats.",
    long: 'A single consumer router hidden in a closet, expected to handle 30+ modern devices across multiple floors. No central placement, no wired backhaul, no traffic management.',
  },
  {
    icon: 'tower',
    title: 'Smart Devices Competing',
    description: 'Every smart plug, thermostat, and speaker fights for bandwidth on the same congested network.',
  },
  {
    icon: 'wifi',
    title: 'Weak WiFi Coverage',
    description: 'Dead zones in the bedroom, buffering in the office, dropped video calls in the kitchen.',
  },
  {
    icon: 'dollar',
    title: 'Subscription Camera Overload',
    description: 'Monthly fees for cloud storage that still misses events. No local control, no real security.',
  },
];

// The solution diagram: the path from the internet to the devices.
export const DIAGRAM_STEPS: readonly { readonly icon: IconName; readonly label: string; readonly description: string }[] = [
  { icon: 'globe', label: 'Internet', description: 'ISP uplink' },
  { icon: 'shield', label: 'Firewall', description: 'Traffic filtering' },
  { icon: 'network', label: 'PoE Switch', description: 'Power & data' },
  { icon: 'wifi', label: 'Access Points', description: 'Wireless coverage' },
  { icon: 'camera', label: 'Cameras', description: 'Local recording' },
  { icon: 'home', label: 'Smart Devices', description: 'IoT automation' },
];

export interface HomePackage {
  readonly name: string;
  readonly priceRange: string;
  readonly idealFor: string;
  readonly includes: readonly string[];
  readonly accent: Accent;
  readonly featured?: boolean;
}

export const PACKAGES: readonly HomePackage[] = [
  {
    name: 'Foundation Network',
    priceRange: '$799–$1,499',
    idealFor: 'Builder-grade homes using ISP router only.',
    includes: [
      'Network assessment',
      'Mesh router setup with optional wired backhaul',
      'Latency optimization',
      'Cable management & clean mounting',
    ],
    accent: 'green',
  },
  {
    name: 'Smart Home Backbone',
    priceRange: '$1,500–$3,500',
    idealFor: 'Homes adding automation and security devices.',
    includes: [
      'Full network redesign',
      'Managed PoE switch',
      '2–4 PoE access point installs',
      'VLAN segmentation (Main / Guest / IoT / Cameras)',
      'Structured panel or rack cleanup',
      'Smart home hub setup',
      'Optional remote management',
    ],
    accent: 'purple',
    featured: true,
  },
  {
    name: 'Security',
    priceRange: '$999–$1,999',
    idealFor: 'Homes adding PoE cameras with local recording.',
    includes: [
      '2–4 PoE camera installs',
      'Local NVR setup (no subscriptions)',
      'Detection zone configuration',
      'Night vision optimization',
      'Remote access (add-on available)',
      'Camera VLAN isolation',
    ],
    accent: 'orange',
  },
  {
    name: 'Performance + Protection',
    priceRange: '$2,500–$6,000',
    idealFor: 'Full coverage: network, cameras, and smart home.',
    includes: [
      'Everything in Smart Home Backbone',
      'Everything in Security package',
      'UPS battery protection',
      'Full labeling & documentation',
      'Network diagram provided',
    ],
    accent: 'cyan',
  },
];

export const WHY_US: readonly { readonly title: string; readonly description: string }[] = [
  {
    title: 'Clean Professional Installs',
    description: 'Flush-mount APs, concealed cabling, labeled patch panels. No visible cable spaghetti.',
  },
  {
    title: 'Proper VLAN Segmentation',
    description: 'Separate traffic for your main network, guests, IoT devices, and cameras. Security by design.',
  },
  {
    title: 'No Subscription Cameras',
    description: 'Local NVR storage with PoE cameras. No monthly fees, no cloud dependency, full ownership.',
  },
  {
    title: 'Documentation Provided',
    description: "Network diagram, device inventory, and configuration notes. Know exactly what's in your home.",
  },
];
