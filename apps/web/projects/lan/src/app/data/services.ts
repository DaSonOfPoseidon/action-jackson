import type { IconName } from '../ui/icons';
import type { Accent, ServiceId } from './service-links';

// The content of the four service pages, one typed constant each, ported word for word from the original site's pages
// (frontend/app/(business)/services/*/page.tsx and lib/services.ts) with the changes listed in the PR: the reply-time
// promise ("within 24 hours") and the volume-discount line are gone. The prices are the original's copy; the catalog
// (issue #38) disagrees with some of them, and nothing here is computed from them.

export interface PainPoint {
  readonly title: string;
  readonly description: string;
  readonly icon: IconName;
}

export interface Feature {
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
  readonly icon: IconName;
  readonly badge?: string;
}

export interface Faq {
  readonly question: string;
  readonly answer: string;
}

export interface Pricing {
  readonly label: string;
  readonly price: string;
  readonly unit?: string;
  readonly description: string;
  readonly inclusions: readonly string[];
  readonly note?: string;
}

// The "technical specifications" section differs per service: three side-by-side tiers, four spec cards, or a table.
export type Specs =
  | {
      readonly kind: 'tiers';
      readonly label: string;
      readonly tiers: readonly {
        readonly tier: string;
        readonly tagline: string;
        readonly specs: readonly { readonly label: string; readonly value: string }[];
      }[];
    }
  | {
      readonly kind: 'cards';
      readonly label: string;
      readonly cards: readonly { readonly title: string; readonly value: string; readonly detail: string; readonly icon: IconName }[];
    }
  | {
      readonly kind: 'table';
      readonly label: string;
      readonly columns: readonly string[];
      // The column (if any) set in mono type and the accent colour.
      readonly monoColumn?: number;
      readonly rows: readonly (readonly string[])[];
    };

// The content of one service page (its link, title and description are in service-links.ts).
export interface Service {
  readonly id: ServiceId;
  readonly accent: Accent;
  readonly heroTitle: string;
  readonly heroSubtitle: string;
  readonly badge: string;
  readonly painHeading: string;
  readonly painSubheading: string;
  readonly painPoints: readonly PainPoint[];
  readonly features: readonly Feature[];
  readonly specs: Specs;
  readonly faqs: readonly Faq[];
  readonly pricing: Pricing;
  readonly ctaHeadline: string;
  readonly ctaSubtext: string;
}

// The steps every service page shows (the original's ProcessSteps defaults): a real sequence, so an ordered list.
export const PROCESS_STEPS: readonly { readonly title: string; readonly description: string }[] = [
  { title: 'Consultation', description: 'Discuss your goals, assess current setup, and identify requirements.' },
  { title: 'Site Survey', description: 'On-site evaluation of layout, access paths, and infrastructure.' },
  { title: 'Proposal', description: 'Detailed scope, timeline, equipment list, and transparent pricing.' },
  { title: 'Installation', description: 'Professional install with clean cable management and minimal disruption.' },
  { title: 'Configuration', description: 'Full system setup, optimization, and thorough testing.' },
  { title: 'Handoff', description: 'Documentation, walkthrough, and ongoing support options.' },
];

export const SERVICES: readonly Service[] =[
  {
    id: 'networking',
    accent: 'green',
    heroTitle: 'Engineered WiFi & Network Performance.',
    heroSubtitle: 'Replace your ISP router with a properly designed, segmented network built for speed and reliability.',
    badge: 'Networking',
    painHeading: 'The problem with builder-grade networking.',
    painSubheading: 'ISP-provided equipment was never designed for how modern homes actually use their network.',
    painPoints: [
      {
        title: 'One Router, 30+ Devices',
        description: "Your ISP router was designed to handle a few laptops. Now it's managing phones, tablets, smart TVs, thermostats, cameras, and gaming consoles on a single network.",
        icon: 'router',
      },
      {
        title: 'No Network Segmentation',
        description: 'Every device shares the same network. A compromised smart plug has direct access to your work laptop, personal files, and financial data.',
        icon: 'shield',
      },
      {
        title: 'Interference & Dead Zones',
        description: 'Builder-grade router placement and neighboring WiFi networks create interference patterns that degrade performance throughout the house.',
        icon: 'signal',
      },
      {
        title: 'Buffering & Latency',
        description: "Video calls drop, games lag, and streaming buffers because traffic isn't prioritized. Your ISP router treats a firmware update the same as a Zoom call.",
        icon: 'gauge',
      },
    ],
    features: [
      {
        title: 'Network Assessment',
        summary: 'Full evaluation of your current setup, coverage gaps, and bandwidth requirements.',
        detail: 'We map your floor plan, count every connected device, measure signal strength in every room, and identify bandwidth bottlenecks before designing your new network.',
        icon: 'clipboard',
        badge: 'All Packages',
      },
      {
        title: 'Mesh Router Setup',
        summary: 'Replace your ISP router with a high-performance mesh system.',
        detail: 'Foundation includes a mesh router with optional wired backhaul for whole-home coverage. Backbone upgrades to enterprise-grade hardware (UniFi, Omada) with managed PoE switch and dedicated APs.',
        icon: 'server',
        badge: 'Foundation+',
      },
      {
        title: 'PoE Access Point Installs',
        summary: 'Ceiling or wall-mounted APs with hardwired backhaul.',
        detail: '2-4 APs for Smart Home Backbone and above. Each AP connects via a dedicated low-voltage cable run — no wireless backhaul, no signal degradation.',
        icon: 'wifi',
        badge: 'Backbone',
      },
      {
        title: 'VLAN Segmentation',
        summary: 'Isolated networks for Main, Guest, IoT, and Cameras.',
        detail: "Each segment has its own rules, bandwidth allocation, and security posture. IoT devices can't reach your personal network. Guests get internet only.",
        icon: 'diagram',
        badge: 'Backbone',
      },
      {
        title: 'Latency Optimization',
        summary: 'QoS rules tuned for gaming and remote work.',
        detail: 'Traffic shaping ensures real-time applications always have priority over background downloads. Smart queue management for symmetric and asymmetric connections.',
        icon: 'bolt',
        badge: 'All Packages',
      },
      {
        title: 'Cable Management & Mounting',
        summary: 'Clean, professional mounting with concealed cabling.',
        detail: 'No exposed wires, no cable spaghetti, no zip-tied mess behind the TV. Equipment rack or structured panel with proper ventilation and cable routing.',
        icon: 'tools',
        badge: 'All Packages',
      },
    ],
    specs: {
      kind: 'tiers',
      label: 'Comparison',
      tiers: [
        {
          tier: 'ISP Router',
          tagline: 'What you have now',
          specs: [
            { label: 'Devices', value: '10-15' },
            { label: 'VLANs', value: 'None' },
            { label: 'WiFi', value: '1 SSID' },
            { label: 'Firewall', value: 'Basic NAT' },
            { label: 'QoS', value: 'None' },
            { label: 'Management', value: 'Web only' },
          ],
        },
        {
          tier: 'Foundation',
          tagline: 'Entry-level upgrade',
          specs: [
            { label: 'Devices', value: '30+' },
            { label: 'VLANs', value: 'None' },
            { label: 'WiFi', value: 'Mesh Router' },
            { label: 'Firewall', value: 'Router Built-in' },
            { label: 'QoS', value: 'Smart Queue' },
            { label: 'Management', value: 'App-Based' },
          ],
        },
        {
          tier: 'Backbone',
          tagline: 'Smart home ready',
          specs: [
            { label: 'Devices', value: '100+' },
            { label: 'VLANs', value: '5+' },
            { label: 'WiFi', value: '2-4 APs' },
            { label: 'Firewall', value: 'DPI + IDS/IPS' },
            { label: 'QoS', value: 'Per-VLAN Rules' },
            { label: 'Management', value: 'Remote + Alerts' },
          ],
        },
      ],
    },
    faqs: [
      {
        question: 'Do I need to buy my own hardware?',
        answer: "You can purchase hardware yourself or have us source it. We recommend specific models based on your home's size and device count. Hardware is billed separately from labor. If we purchase equipment on your behalf, a 20% acquisition and stocking fee applies.",
      },
      {
        question: 'Will this work with my ISP?',
        answer: 'Yes. We replace the routing and WiFi functions of your ISP equipment while keeping the modem or ONT connection. Works with any provider — cable, fiber, or fixed wireless.',
      },
      {
        question: 'How long does installation take?',
        answer: 'Foundation installs typically take 3-5 hours. Backbone packages with multiple AP installs and structured cabling may take a full day. We schedule around your availability.',
      },
      {
        question: 'Can I manage the network myself after install?',
        answer: 'Absolutely. We provide full admin access and a walkthrough of the management interface. Optional remote management is available if you prefer hands-off administration.',
      },
      {
        question: 'What about smart home devices on the network?',
        answer: 'IoT devices are placed on a dedicated VLAN with internet access but no path to your personal devices. We configure mDNS reflection so casting and discovery still work across VLANs.',
      },
    ],
    pricing: {
      label: 'Starting Price',
      price: '$799',
      description: 'Foundation Network',
      inclusions: [
        'Network assessment & floor plan evaluation',
        'Mesh router setup with optional wired backhaul',
        'Latency optimization (gaming + remote work)',
        'Cable management & clean mounting',
        'Hardware billed separately or bundled',
      ],
    },
    ctaHeadline: 'Ready to replace your ISP router?',
    ctaSubtext: 'Schedule a consultation and get a custom network proposal.',
  },
  {
    id: 'smart-home',
    accent: 'purple',
    heroTitle: 'Smart Home Infrastructure That Actually Works.',
    heroSubtitle: "Stop adding smart devices to a network that can't support them. Build the backbone first.",
    badge: 'Smart Home',
    painHeading: 'Smart devices, dumb infrastructure.',
    painSubheading: "Most smart home problems aren't device problems. They're network problems.",
    painPoints: [
      {
        title: 'Congested Network, Broken Automations',
        description: "Smart devices crammed onto a consumer router with 40 other devices. Automations fail because the network can't handle the traffic reliably.",
        icon: 'alert',
      },
      {
        title: 'Cloud Dependency',
        description: 'Every device phones home to a different cloud service. Internet goes down, your lights stop working. Vendor kills the product, your investment is gone.',
        icon: 'cloud',
      },
      {
        title: 'No Isolation or Security',
        description: 'That cheap smart plug from Amazon has direct network access to your work laptop, NAS, and personal data. No segmentation, no firewall rules.',
        icon: 'shield',
      },
      {
        title: 'Fragmented Control',
        description: 'Five different apps to control five different brands. No unified dashboard, no cross-device automations, no central management.',
        icon: 'puzzle',
      },
    ],
    features: [
      {
        title: 'Managed PoE Switch',
        summary: 'Enterprise-grade managed switch for centralized power and data.',
        detail: 'Powers your access points, cameras, and wired devices over a single low-voltage cable. VLAN-aware with port isolation, PoE budgeting, and traffic monitoring.',
        icon: 'server',
        badge: 'Infrastructure',
      },
      {
        title: 'Dedicated IoT VLAN',
        summary: 'Smart devices on their own isolated network segment.',
        detail: 'They can reach the internet and your automation hub, but they cannot touch your personal devices. mDNS reflection configured so casting and discovery still work.',
        icon: 'diagram',
        badge: 'Security',
      },
      {
        title: 'Home Assistant Setup',
        summary: 'Local-first automation hub that runs without the cloud.',
        detail: 'Control Zigbee, Z-Wave, WiFi, and Matter devices from a single dashboard. Full automation support with YAML or visual editor. Runs on dedicated hardware or VM.',
        icon: 'smart-home',
        badge: 'Automation',
      },
      {
        title: 'Structured Panel Cleanup',
        summary: 'Organize the rats nest in your structured media panel.',
        detail: 'Proper patch panel, labeled connections, and clean cable routing for easy future expansion. Low-voltage structured cabling with professional termination.',
        icon: 'toolbox',
        badge: 'Infrastructure',
      },
      {
        title: '2-4 Access Point Installs',
        summary: 'Ceiling or wall-mounted APs with hardwired backhaul.',
        detail: 'Positioned based on your floor plan and device density, not guesswork. Each AP connects via a dedicated low-voltage cable run from the structured panel.',
        icon: 'wifi',
        badge: 'Coverage',
      },
      {
        title: 'Remote Management',
        summary: 'Optional secure remote access for management.',
        detail: 'Monitor device health, update configurations, and troubleshoot remotely. VPN or Cloudflare Tunnel access without exposing ports to the internet.',
        icon: 'globe',
        badge: 'Optional',
      },
    ],
    specs: {
      kind: 'table',
      label: 'Protocol Support',
      columns: ['Protocol', 'Range', 'Mesh', 'Power', 'Common Devices'],
      rows: [
        ['Zigbee', '10-20m', 'Yes', 'Ultra-low', 'Sensors, lights, locks'],
        ['Z-Wave', '30m', 'Yes', 'Low', 'Locks, thermostats, blinds'],
        ['WiFi', '50m+', 'No', 'High', 'Cameras, plugs, displays'],
        ['Matter', 'Varies', 'Thread', 'Low', 'Next-gen unified devices'],
        ['Thread', '15m', 'Yes', 'Ultra-low', 'Sensors, locks, lights'],
      ],
    },
    faqs: [
      {
        question: 'Do I need to replace my existing smart devices?',
        answer: "Usually not. Home Assistant supports 2,000+ integrations. Most WiFi, Zigbee, Z-Wave, and Matter devices work out of the box. We'll audit your devices during the site survey.",
      },
      {
        question: 'What if my internet goes down?',
        answer: 'Home Assistant runs locally. All local automations (lights, locks, sensors) continue to work without internet. Cloud-dependent devices (voice assistants, some cameras) will be limited.',
      },
      {
        question: 'Can I still use Alexa/Google Home for voice control?',
        answer: 'Yes. Home Assistant integrates with both Alexa and Google Home. You can use voice control while keeping all automation logic local and private.',
      },
      {
        question: 'How complex can automations get?',
        answer: 'As complex as you want. From simple schedules to multi-condition automations triggered by motion, time, weather, presence, or device state. Visual editor for simple flows, YAML for advanced logic.',
      },
      {
        question: 'What hardware runs Home Assistant?',
        answer: 'We recommend a dedicated mini PC or Home Assistant Yellow for reliability. It can also run on a Raspberry Pi 4/5, NAS, or as a VM. Dedicated hardware ensures best performance and uptime.',
      },
      {
        question: 'Do I need to buy my own equipment?',
        answer: "You can purchase hardware yourself or have us source it. We recommend specific switches, access points, and hubs based on your home's size and device count. Hardware is billed separately from labor. If we purchase equipment on your behalf, a 20% acquisition and stocking fee applies.",
      },
    ],
    pricing: {
      label: 'Starting Price',
      price: '$1,500',
      description: 'Smart Home Backbone Package',
      inclusions: [
        'Full network redesign and VLAN segmentation',
        'Managed PoE switch installation',
        '2-4 access point installs with hardwired backhaul',
        'Structured media panel cleanup',
        'Home Assistant setup and configuration',
        'Hardware billed separately or bundled',
      ],
    },
    ctaHeadline: 'Ready to build your smart home backbone?',
    ctaSubtext: 'Schedule a consultation and get a custom automation proposal.',
  },
  {
    id: 'cameras',
    accent: 'orange',
    heroTitle: 'Subscription-Free Security Cameras.',
    heroSubtitle: 'PoE cameras with local NVR storage. No monthly fees, no cloud dependency, full ownership of your footage.',
    badge: 'Cameras',
    painHeading: 'The real cost of consumer cameras.',
    painSubheading: "Ring and Nest sell you cheap hardware so they can charge you forever. There's a better model.",
    painPoints: [
      {
        title: 'Monthly Subscription Fees',
        description: 'Ring, Nest, and Arlo charge $10-$30/month per camera for cloud storage. Four cameras cost more per year than a local NVR costs once.',
        icon: 'card',
      },
      {
        title: 'Cloud-Dependent Recording',
        description: "Your cameras rely on someone else's servers. Internet outage means no recording. Company discontinues the product, your hardware becomes a paperweight.",
        icon: 'cloud',
      },
      {
        title: 'Missed Events & Delays',
        description: 'WiFi cameras with battery power miss events during sleep cycles. Cloud processing adds latency. By the time you get the alert, the moment has passed.',
        icon: 'clock',
      },
      {
        title: 'No Local Control',
        description: "Your footage lives on a corporate server. You can't run custom detection, can't integrate with your smart home, and can't guarantee data privacy.",
        icon: 'lock',
      },
    ],
    features: [
      {
        title: 'PoE Camera Installation',
        summary: 'Professional mounting with weatherproof housings and concealed cabling.',
        detail: 'Each camera runs on a single low-voltage cable for power and data. No batteries, no WiFi dropouts. Weatherproof housings rated for outdoor exposure at every mounting point.',
        icon: 'camera',
        badge: 'Installation',
      },
      {
        title: 'Local NVR Setup',
        summary: 'Network video recorder with configurable retention periods.',
        detail: 'Your footage stays on your hardware, accessible only from your network. Configurable retention from 7 to 90+ days depending on drive capacity and camera count.',
        icon: 'drive',
        badge: 'Storage',
      },
      {
        title: 'Remote Access (Add-On)',
        summary: 'Optional upgrade: view cameras from anywhere through encrypted connections.',
        detail: 'Many cameras include their own apps for basic mobile viewing. For self-hosted remote access to your full NVR interface — via VPN or Cloudflare Tunnel, with no port forwarding or cloud relay — we offer an optional remote access add-on.',
        icon: 'globe',
        badge: 'Add-On',
      },
      {
        title: 'Motion Detection Setup',
        summary: 'Basic zone-based detection included. Advanced smart detection available as upgrade.',
        detail: 'Every install includes zone-based motion detection with separate sensitivity settings for driveways, entry points, and perimeter areas. Advanced features — person/vehicle classification, facial recognition — are available upgrades on supported models.',
        icon: 'target',
        badge: 'Basic + Upgrades',
      },
      {
        title: 'Night Vision Optimization',
        summary: 'IR and ambient light settings calibrated per camera position.',
        detail: 'Proper angle and exposure adjustment for clear footage in all conditions. IR intensity tuned to avoid wash-out on close surfaces. Supplemental IR illuminators where needed.',
        icon: 'moon',
        badge: 'Configuration',
      },
      {
        title: 'Network Integration',
        summary: 'Cameras on a dedicated VLAN, isolated from personal devices.',
        detail: 'Bandwidth allocated to prevent recording from affecting daily use. Cameras can reach the NVR but cannot access your personal network. Firewall rules enforced at the switch level.',
        icon: 'diagram',
        badge: 'Security',
      },
    ],
    specs: {
      kind: 'cards',
      label: 'Camera Specs',
      cards: [
        {
          title: 'Resolution',
          value: '4K / 8MP',
          detail: 'Standard recommendation. 2K/4MP available for budget-conscious installs. Sufficient for license plate and face identification at typical distances.',
          icon: 'expand',
        },
        {
          title: 'Recording Modes',
          value: '24/7 + Motion',
          detail: 'Continuous recording with motion-tagged event search. Basic motion detection included with every install. Smart detection (person/vehicle/facial recognition) available as upgrades on supported models. Configurable schedules per camera.',
          icon: 'record',
        },
        {
          title: 'Storage',
          value: '2-8 TB NVR',
          detail: '7-90+ days retention depending on camera count and resolution. RAID-capable NVRs available for drive redundancy. Expandable as needs grow.',
          icon: 'database',
        },
        {
          title: 'IR Range',
          value: '30-50m',
          detail: 'Built-in IR LEDs for clear night footage. Supplemental IR illuminators available for extended range. Color night vision on select models with ambient light.',
          icon: 'eye',
        },
      ],
    },
    faqs: [
      {
        question: 'Do I need an existing network upgrade for cameras?',
        answer: "Not necessarily. If you have a PoE switch or can add one, cameras can run on your existing network. We'll assess during the site survey and recommend upgrades only if needed.",
      },
      {
        question: 'How many cameras do I need?',
        answer: "Most homes need 4-8 cameras to cover all entry points, the driveway, and key perimeter areas. We'll walk the property during the site survey and recommend positions based on your priorities.",
      },
      {
        question: 'What about cloud backup of footage?',
        answer: 'Local storage is primary. If you want offsite backup, we can configure encrypted upload to your own cloud storage (Backblaze B2, Wasabi, etc.) — no monthly subscription to a camera vendor.',
      },
      {
        question: 'Can I view cameras on my phone?',
        answer: 'Yes. Most cameras have their own apps for basic mobile viewing and playback. For full NVR access from anywhere, the optional remote access add-on provides self-hosted connectivity via VPN or Cloudflare Tunnel — no port forwarding or cloud relay required.',
      },
      {
        question: 'What camera brands do you recommend?',
        answer: 'We primarily install Reolink, UniFi Protect, and Hikvision/Dahua cameras depending on your budget, feature requirements, and NVR platform. All are PoE with local storage support.',
      },
      {
        question: 'Do I need to buy my own equipment?',
        answer: 'You can purchase cameras and NVR hardware yourself or have us source it. We recommend specific models based on your property layout and recording requirements. Hardware is billed separately from labor. If we purchase equipment on your behalf, a 20% acquisition and stocking fee applies.',
      },
    ],
    pricing: {
      label: 'Standalone Pricing',
      price: '$125–$175',
      unit: '/ camera',
      description: 'Mount, configure, and integrate per camera',
      inclusions: [
        'Professional mounting with weatherproof housings',
        'Concealed low-voltage cabling',
        'NVR configuration and zone setup',
        'Basic motion detection setup',
        'Night vision optimization',
        'Network VLAN integration',
      ],
      note: 'Cameras are also included in the Security package (2–4 cameras) starting at $999. Low-voltage cabling billed separately if new runs are needed.',
    },
    ctaHeadline: 'Ready to ditch the subscriptions?',
    ctaSubtext: 'Schedule a consultation and get a custom camera system proposal.',
  },
  {
    id: 'wiring',
    accent: 'cyan',
    heroTitle: 'Structured Cabling & Low-Voltage Networking.',
    heroSubtitle: 'Cat6, Cat6a, single mode fiber, and coax. Clean installs with professional termination, testing, and documentation.',
    badge: 'Structured Cabling',
    painHeading: 'Why wired infrastructure still wins.',
    painSubheading: 'WiFi is convenient. Structured cabling is reliable. The best networks use both, with low-voltage wiring as the backbone.',
    painPoints: [
      {
        title: 'WiFi-Only Bottleneck',
        description: 'Your gaming PC, streaming box, and work desktop are all competing for wireless bandwidth. Hardwired connections deliver consistent, full-speed throughput with zero interference.',
        icon: 'gauge',
      },
      {
        title: 'No Wired Backhaul for APs',
        description: 'Mesh systems using wireless backhaul lose 50% of bandwidth per hop. Hardwired access points deliver the full speed of your internet plan to every corner of the house.',
        icon: 'wifi',
      },
      {
        title: 'Cameras & PoE Devices Need Cable',
        description: 'PoE cameras, access points, and VoIP phones all require low-voltage cabling. Without structured cable runs in place, every new device means fishing cable through finished walls.',
        icon: 'camera',
      },
      {
        title: 'No Future-Proofing',
        description: 'Builder-grade homes ship with coax and phone lines. Cat6 supports 10 Gbps and single mode fiber handles 100 Gbps+. Proper structured cabling outlasts every wireless standard.',
        icon: 'forward',
      },
    ],
    features: [
      {
        title: 'Cat6 / Cat6a Data Drops',
        summary: 'Dedicated data cable runs from patch panel to destination.',
        detail: 'Cat6 rated for 10 Gbps at 55m, Cat6a at 100m. Solid copper conductors with proper shielding. Each drop is a home run to the structured panel — no daisy chains, no splices.',
        icon: 'ethernet',
        badge: 'Data Cabling',
      },
      {
        title: 'Single Mode Fiber Runs',
        summary: 'Future-proof fiber optic connections for high-bandwidth links.',
        detail: 'Single mode fiber supports 100 Gbps+ over distances up to 10km. Ideal for building-to-building links, backbone connections between floors, or future-proofing critical paths.',
        icon: 'bolt',
        badge: 'Fiber',
      },
      {
        title: 'Coax Distribution',
        summary: 'RG6 coax runs for antenna, cable TV, and MoCA.',
        detail: 'Proper RG6 runs with compression fittings for OTA antenna distribution, cable TV, or MoCA network backhaul. Splitters, amplifiers, and grounding as needed.',
        icon: 'antenna',
        badge: 'Coax',
      },
      {
        title: 'Patch Panel Termination',
        summary: 'All cables terminate at a structured patch panel.',
        detail: 'Proper strain relief, clean organization, and labeled ports for easy expansion. Keystone or punch-down depending on panel type. Ready for future additions without retermination.',
        icon: 'server',
        badge: 'Infrastructure',
      },
      {
        title: 'Wall Plate Installation',
        summary: 'Low-voltage wall plates with keystone jacks at each location.',
        detail: 'Flush-mount finish that looks clean and professional in any room. Support for data, coax, and fiber keystones in the same plate. Old-work or new-work boxes as needed.',
        icon: 'plug',
        badge: 'Finish Work',
      },
      {
        title: 'Testing & Certification',
        summary: 'Every run tested end-to-end before the job is closed out.',
        detail: 'Continuity, speed rating, proper pin configuration, and signal quality verified on every cable. Test results documented and provided with the install package.',
        icon: 'clipboard',
        badge: 'Quality',
      },
    ],
    specs: {
      kind: 'table',
      label: 'Cable Comparison',
      columns: ['Cable Type', 'Max Speed', 'Max Distance', 'Use Case', 'Price Range'],
      monoColumn: 1,
      rows: [
        [
          'Cat6',
          '10 Gbps',
          '55m (10G) / 100m (1G)',
          'Data drops, PoE devices, AP backhaul',
          '$150 / drop',
        ],
        ['Cat6a', '10 Gbps', '100m', 'Long runs, 10G backbones, high-PoE', '$200 / drop'],
        [
          'Single Mode Fiber',
          '100 Gbps+',
          '10km+',
          'Building links, backbone, future-proof',
          '$300+ / run',
        ],
        [
          'RG6 Coax',
          '3 Gbps (MoCA 2.5)',
          '100m',
          'Antenna, cable TV, MoCA network',
          '$125 / drop',
        ],
      ],
    },
    faqs: [
      {
        question: "What's the difference between Cat6 and Cat6a?",
        answer: 'Both support 10 Gbps, but Cat6 is limited to 55 meters at that speed while Cat6a supports the full 100 meters. Cat6a also has better shielding against crosstalk. For most residential drops, Cat6 is sufficient.',
      },
      {
        question: 'Do I need fiber in my house?',
        answer: 'For most homes, Cat6/Cat6a handles everything. Fiber makes sense for building-to-building links (house to detached garage/office), backbone connections between floors in large homes, or if you want 10/25/100G capacity on specific paths.',
      },
      {
        question: 'Can you run cable through finished walls?',
        answer: 'Yes. Most runs go through the attic, crawlspace, or existing conduit. Difficult routes (no attic access, exterior walls, concrete) take more time and are priced accordingly.',
      },
      {
        question: 'How many drops do I need?',
        answer: "At minimum: one per access point location, one per camera location, and one per room where you want hardwired devices (office, entertainment center, gaming setup). We'll recommend a plan during the site survey.",
      },
      {
        question: 'Is coax still useful?',
        answer: "Absolutely. RG6 coax is essential for OTA antenna distribution and MoCA 2.5 provides 2.5 Gbps network backhaul using existing coax — useful when running new data cable isn't practical.",
      },
      {
        question: 'Do you handle permits and code compliance?',
        answer: "Low-voltage cabling typically doesn't require permits in most jurisdictions. All installs follow NEC low-voltage separation requirements and manufacturer specifications for bend radius and cable support.",
      },
      {
        question: 'Do I need to buy my own materials?',
        answer: 'You can purchase cable, keystones, and wall plates yourself or have us source everything. We recommend specific brands and grades based on your project requirements. Materials are billed separately from labor. If we purchase equipment or materials on your behalf, a 20% acquisition and stocking fee applies.',
      },
    ],
    pricing: {
      label: 'Starting Price',
      price: '$150',
      unit: '/ drop',
      description: 'Standard attic-access data drop',
      inclusions: [
        'Cat6 cable run from patch panel to wall plate',
        'Patch panel termination with strain relief',
        'Keystone jack and low-voltage wall plate',
        'Proper cable routing and support',
        'Labeling and documentation',
        'End-to-end testing and certification',
      ],
      note: 'Difficult wall routes (no attic access, exterior walls, concrete) priced at $200-$300 per drop. Cat6a, fiber, and coax priced individually.',
    },
    ctaHeadline: 'Ready to wire your home properly?',
    ctaSubtext: 'Schedule a consultation and get a custom structured cabling proposal.',
  },
];
