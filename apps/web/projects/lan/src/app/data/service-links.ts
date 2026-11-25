// What the rest of the site needs to know about the four service pages without loading their content: where they are,
// what they are called in the menus, and their title and description. (The content is in services.ts, which only the
// service pages load, so the other pages do not carry it.)

export type ServiceId = 'networking' | 'smart-home' | 'cameras' | 'wiring';
export type Accent = 'green' | 'purple' | 'orange' | 'cyan';

export interface ServiceLink {
  readonly id: ServiceId;
  readonly path: string;
  // The text of its link in the header, the footer and the breadcrumbs.
  readonly navLabel: string;
  // The page name in <title> ("<seoTitle> · Action Jackson Home Networking") and the meta description.
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly breadcrumbName: string;
}

export const SERVICE_LINKS: readonly ServiceLink[] =[
  {
    id: 'networking',
    path: '/services/networking',
    navLabel: 'Networking',
    seoTitle: 'Networking Services',
    seoDescription: 'Professional home network design and installation in Columbia, MO. Mesh WiFi, VLAN segmentation, managed switches, and wired backhaul for reliable whole-home coverage.',
    breadcrumbName: 'Networking',
  },
  {
    id: 'smart-home',
    path: '/services/smart-home',
    navLabel: 'Smart Home',
    seoTitle: 'Smart Home Automation',
    seoDescription: 'Smart home automation with dedicated IoT VLANs, Home Assistant, and managed PoE switches. Zigbee, Z-Wave, Matter, and Thread support in Columbia, MO.',
    breadcrumbName: 'Smart Home Automation',
  },
  {
    id: 'cameras',
    path: '/services/cameras',
    navLabel: 'Cameras',
    seoTitle: 'PoE Camera Systems',
    seoDescription: 'Local PoE security camera installation with no monthly fees. NVR setup, night vision, motion detection, and remote access in Columbia, MO.',
    breadcrumbName: 'PoE Camera Systems',
  },
  {
    id: 'wiring',
    path: '/services/wiring',
    navLabel: 'Structured Wiring',
    seoTitle: 'Structured Cabling & Low Voltage',
    seoDescription: 'Cat6, Cat6a, and fiber optic cabling installation for homes in Columbia, MO. Patch panels, wall plates, and certified testing for future-proof connectivity.',
    breadcrumbName: 'Structured Cabling',
  },
];
