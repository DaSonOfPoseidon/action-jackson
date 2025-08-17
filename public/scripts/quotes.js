// public/scripts/quotes.js

let selectedPackage = null;
let includeSurvey = false;
let selectedSpeedTier = null;
let equipmentCart = [];

// Base pricing configuration
const pricing = {
  cables: {
    coax: { cost: 50, time: 1.0 },
    cat6: { cost: 50, time: 1.0 }
  },
  services: {
    deviceMount: { cost: 10, time: 0.25 },
    clientDevice: { cost: 10, time: 0.25 },
    serverDevice: { cost: 50, time: 1.0 },
    mediaPanel: { cost: 50, time: 1.0 }
  },
  cameras: {
    internalCameras: { cost: 80, time: 1.0 },    // Placeholder - update when you determine prices
    externalCameras: { cost: 100, time: 1.5 },    // Placeholder - update when you determine prices
    doorbellCameras: { cost: 150, time: 2.0 }    // Placeholder - update when you determine prices
  },
  packages: {
    basic: {
      installFee: 50,
      depositThreshold: 100,
      depositAmount: 20
    },
    premium: {
      hourlyRate: 50,
      estimatedHours: { min: 2, max: 5 }  // Just for Step 1 display
    },
    survey: {
      cost: 100,
      estimatedHours: 2
    }
  }
};

// Legacy aliases for backward compatibility (will be updated throughout the code)
const cablePricing = pricing.cables;
cablePricing.installFee = pricing.packages.basic.installFee;
const servicePricing = pricing.services;
const packagePricing = pricing.packages;

// Equipment catalog with detailed meta tags for filtering and recommendations
const equipmentCatalog = {
  gateways: [
    { 
      sku: 'UCG-Max-NS', 
      name: 'UniFi Cloud Gateway Max', 
      price: 199,
      subCategory: 'Media Panel',
      speedTiers: ['1 Gig', '2.5 Gig'],
      features: {
        PoE: false,
        sfp: false,
        portSpeeds: [2.5],
        uplinkSpeeds: [2.5],
        maxThroughput: 2500,
        managedPorts: 1,
        wanPorts: 1
      },
      tags: ['entry-level', 'small-office', 'home-use', 'budget-friendly'],
      recommended: ['1 Gig'],
      description: 'Entry-level cloud gateway perfect for small offices and home networks'
    },
    { 
      sku: 'UCG-Fiber', 
      name: 'UniFi Cloud Gateway Fiber', 
      price: 279,
      subCategory: 'Media Panel',
      speedTiers: ['2.5 Gig', '10 Gig'],
      features: {
        PoE: true,
        sfp: true,
        portSpeeds: [2.5, 10],
        uplinkSpeeds: [10],
        maxThroughput: 10000,
        managedPorts: 4,
        wanPorts: 1
      },
      tags: ['mid-range', 'fiber-ready', 'poe-capable', 'scalable'],
      recommended: ['5 Gig'],
      description: 'Fiber-ready gateway with PoE support for growing networks'
    },
    { 
      sku: 'UDM-SE', 
      name: 'UniFi Dream Machine Special Edition', 
      price: 499,
      subCategory: 'Server Rack',
      speedTiers: ['5 Gig', '10 Gig'],
      features: {
        PoE: true,
        sfp: true,
        portSpeeds: [1, 2.5, 10],
        uplinkSpeeds: [10],
        maxThroughput: 10000,
        managedPorts: 8,
        wanPorts: 2
      },
      tags: ['high-performance', 'all-in-one', 'enterprise-grade', 'redundant-wan'],
      recommended: ['10 Gig'],
      description: 'High-performance all-in-one solution with built-in controller and redundant WAN'
    },
    {
      sku: 'UX7',
      name: 'UniFi Express 7',
      price: 199,
      subCategory: 'Exposed',
      speedTiers: ['5 Gig', '10 Gig'],
      features: {
        PoE: false,
        sfp: false,
        portSpeeds: [2.5, 10],
        uplinkSpeeds: [10],
        maxThroughput: 10000,
        managedPorts: 1,
        wanPorts: 1
      },
      tags: ['compact', 'mesh-scalable', 'wifi7', '10g'],
      recommended: ['5 Gig'],
      description: 'Mesh‑scalable, super‑compact 10G Cloud Gateway with integrated WiFi 7'
    },
    {
      sku: 'UDR7',
      name: 'UniFi Dream Router 7',
      price: 279,
      subCategory: 'Exposed',
      speedTiers: ['5 Gig', '10 Gig'],
      features: {
        PoE: true,
        sfp: false,
        portSpeeds: [1, 2.5, 10],
        uplinkSpeeds: [10],
        maxThroughput: 10000,
        managedPorts: 4,
        wanPorts: 1
      },
      tags: ['desktop', 'wifi7', 'poe-switch', 'nvr-storage'],
      recommended: ['10 Gig'],
      description: 'Desktop 10G Cloud Gateway with integrated WiFi 7, PoE switch, microSD storage, and full UniFi application support'
    },
    {
      sku: 'UCG-Ultra',
      name: 'Cloud Gateway Ultra',
      price: 129,
      subCategory: 'Media Panel',
      speedTiers: ['1 Gig'],
      features: {
        PoE: false,
        sfp: false,
        portSpeeds: [1],
        uplinkSpeeds: [1],
        maxThroughput: 1000,
        managedPorts: 0,
        wanPorts: 2
      },
      tags: ['compact', 'entry-level', 'multi-wan', 'budget-friendly'],
      recommended: ['1 Gig'],
      description: 'Compact Cloud Gateway with 30+ UniFi device/300+ client support, 1 Gbps IPS routing, and multi‑WAN load balancing'
    }
  ],
  switches: [ 
    { 
      sku: 'USW-Flex-Mini', 
      name: 'UniFi Switch Flex Mini', 
      price: 29,
      speedTiers: ['1 Gig'],
      features: {
        sfp: false,
        PoE: false,
        numPorts: 5,
        portSpeeds: [1],
        uplinkSpeeds: [1],
        maxThroughput: 5000,
        powerConsumption: 5
      },
      tags: ['compact', 'desktop', 'budget', 'plug-and-play'],
      recommended: ['1 Gig'],
      description: 'Compact 5-port desktop switch for simple expansion'
    },
    { 
      sku: 'USW-Flex-2.5G-8-PoE', 
      name: 'UniFi Switch Flex 2.5G PoE', 
      price: 199,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        sfp: true,
        PoE: true,
        numPorts: 8,
        portSpeeds: [2.5],
        uplinkSpeeds: [10],
        maxThroughput: 60000,
        poeWattage: 120
      },
      tags: ['2.5g-capable', 'poe-plus', 'rack-mountable', 'high-speed'],
      recommended: ['5 Gig'],
      description: '8-port 2.5G PoE+ switch with SFP+ uplink for high-speed networks'
    },
    { 
      sku: 'USW-Pro-XG-8-PoE', 
      name: 'UniFi Switch Pro XG 8 PoE', 
      price: 499,
      speedTiers: ['10 Gig'],
      features: {
        sfp: true,
        PoE: true,
        numPorts: 8,
        portSpeeds: [10],
        uplinkSpeeds: [10],
        maxThroughput: 200000,
        poeWattage: 400
      },
      tags: ['10g-capable', 'high-power-poe', 'enterprise-grade', 'fiber-ready'],
      recommended: ['10 Gig'],
      description: '8-port 10G PoE++ switch for high-performance enterprise networks'
    },
    {
      sku: 'USW-Flex-2.5G-8',
      name: 'UniFi Switch Flex 2.5G',
      price: 159,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        sfp: true,
        PoE: false,
        numPorts: 8,
        portSpeeds: [2.5],
        uplinkSpeeds: [10],
        maxThroughput: 60000,
        poeWattage: 0
      },
      tags: ['non-poe', '2.5g-capable', 'compact', 'fanless'],
      recommended: ['2.5 Gig'],
      description: 'Flexible, 8‑port 2.5 GbE switch with a 10 GbE RJ45/SFP+ combination uplink port that can be powered with a USB‑C or PoE+ adapter'
    },
    {
      sku: 'USW-Flex-2.5G-5',
      name: 'UniFi Switch Flex Mini 2.5G',
      price: 49,
      speedTiers: ['2.5 Gig'],
      features: {
        sfp: false,
        PoE: false,
        numPorts: 5,
        portSpeeds: [2.5],
        uplinkSpeeds: [2.5],
        maxThroughput: 12500,
        poeWattage: 0
      },
      tags: ['compact', '2.5g', 'desk-mount', 'budget-friendly'],
      recommended: ['2.5 Gig'],
      description: 'Compact, 5‑port 2.5G switch that can be powered with PoE or a USB‑C adapter'
    },
    {
      sku: 'USW-Lite-8-POE',
      name: 'UniFi Switch Lite 8 PoE',
      price: 109,
      speedTiers: ['1 Gig'],
      features: {
        sfp: false,
        PoE: true,
        numPorts: 8,
        portSpeeds: [1],
        uplinkSpeeds: [1],
        maxThroughput: 16000,
        poeWattage: 52
      },
      tags: ['fanless', 'poe', 'budget', 'quiet'],
      recommended: ['1 Gig'],
      description: 'An 8‑port, Layer 2 PoE switch supporting silent fanless cooling'
    },
    {
      sku: 'USW-Lite-16-POE',
      name: 'UniFi Switch Lite 16 PoE',
      price: 199,
      speedTiers: ['1 Gig'],
      features: {
        sfp: false,
        PoE: true,
        numPorts: 16,
        portSpeeds: [1],
        uplinkSpeeds: [1],
        maxThroughput: 32000,
        poeWattage: 45
      },
      tags: ['wall-mountable', 'fanless', 'poe', 'mid-range'],
      recommended: ['1 Gig'],
      description: 'A wall‑mountable, 16‑port, Layer 2 PoE switch with a fanless cooling system'
    },
    {
      sku: 'USW-Pro-Max-16',
      name: 'UniFi Switch Pro Max 16',
      price: 279,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        sfp: true,
        PoE: false,
        numPorts: 16,
        portSpeeds: [2.5],
        uplinkSpeeds: [10],
        maxThroughput: 84000,
        poeWattage: 0
      },
      tags: ['etherlighting', '2.5g', 'enterprise', 'silent'],
      recommended: ['2.5 Gig'],
      description: 'A 16‑port, Layer 3 Etherlighting™ switch 2.5 GbE and versatile mounting options'
    },
    {
      sku: 'USW-Pro-Max-24',
      name: 'UniFi Switch Pro Max 24',
      price: 449,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        sfp: true,
        PoE: false,
        numPorts: 24,
        portSpeeds: [2.5],
        uplinkSpeeds: [10],
        maxThroughput: 126000,
        poeWattage: 0
      },
      tags: ['layer3', '2.5g', 'enterprise', 'scalable'],
      recommended: ['2.5 Gig'],
      description: 'A 24‑port, Layer 3 Etherlighting™ switch with 2.5 GbE'
    },
    {
      sku: 'USW-24-POE',
      name: 'UniFi Switch Standard 24 PoE',
      price: 379,
      speedTiers: ['1 Gig'],
      features: {
        sfp: false,
        PoE: true,
        numPorts: 24,
        portSpeeds: [1],
        uplinkSpeeds: [1],
        maxThroughput: 52000,
        poeWattage: 95
      },
      tags: ['layer2', 'poe', 'fanless', 'standard'],
      recommended: ['1 Gig'],
      description: 'A 24‑port, Layer 2 PoE switch with a fanless cooling system'
    },
    {
      sku: 'USW-48',
      name: 'UniFi Switch Standard 48',
      price: 399,
      speedTiers: ['1 Gig'],
      features: {
        sfp: false,
        PoE: false,
        numPorts: 48,
        portSpeeds: [1],
        uplinkSpeeds: [1],
        maxThroughput: 104000,
        poeWattage: 0
      },
      tags: ['layer2', 'silent', 'high-density', 'standard'],
      recommended: ['1 Gig'],
      description: 'A 48‑port, Layer 2 switch with a silent, fanless cooling system'
    },
    {
      sku: 'USW-Pro-Max-48',
      name: 'UniFi Switch Pro Max 48',
      price: 649,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        sfp: true,
        PoE: false,
        numPorts: 48,
        portSpeeds: [2.5],
        uplinkSpeeds: [10],
        maxThroughput: 168000,
        poeWattage: 0
      },
      tags: ['layer3', '2.5g', 'high-density', 'enterprise'],
      recommended: ['2.5 Gig'],
      description: 'A 48‑port, Layer 3 Etherlighting™ switch with 2.5 GbE'
    }
  ],
  accessPoints: [
    { 
      sku: 'U6-PRO', 
      name: 'UniFi 6 Pro', 
      price: 149,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        wifiStandard: 'WiFi 6',
        maxSpeed: 4800,
        bands: ['2.4GHz', '5GHz'],
        mimo: '4x4',
        powerConsumption: 16,
        mountType: 'ceiling'
      },
      tags: ['high-performance', 'wifi6', 'indoor', '2.5g-uplink'],
      recommended: ['5 Gig'],
      description: 'High-performance WiFi 6 access point with 2.5G uplink'
    },
    { 
      sku: 'U7-PRO', 
      name: 'UniFi 7 Pro', 
      price: 189,
      speedTiers: ['5 Gig', '10 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 6600,
        bands: ['2.4GHz', '5GHz', '6GHz'],
        mimo: '4x4',
        powerConsumption: 25,
        mountType: 'ceiling'
      },
      tags: ['cutting-edge', 'wifi7', 'tri-band', 'future-proof'],
      recommended: ['10 Gig'],
      description: 'Latest WiFi 7 access point with tri-band support and maximum performance'
    },
    { 
      sku: 'U6-IW', 
      name: 'UniFi 6 In-Wall', 
      price: 179,
      speedTiers: ['1 Gig', '2.5 Gig'],
      features: {
        wifiStandard: 'WiFi 6',
        maxSpeed: 1500,
        bands: ['2.4GHz', '5GHz'],
        mimo: '2x2',
        powerConsumption: 15,
        mountType: 'wall',
        additionalPorts: 1
      },
      tags: ['in-wall', 'wifi6', 'hotel-style', 'integrated-switch'],
      recommended: ['1 Gig'],
      description: 'In-wall WiFi 6 access point with additional Ethernet port'
    },
    {
      sku: 'U7-Pro-XG',
      name: 'UniFi 7 Pro XG',
      price: 199,
      speedTiers: ['5 Gig', '10 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 8000,
        bands: ['2.4GHz', '5GHz', '6GHz'],
        mimo: '6x6',
        powerConsumption: 25,
        mountType: 'ceiling',
        uplinkPorts: ['10G', '5G', '2.5G', '1G']
      },
      tags: ['wifi7', 'ceiling', 'six-stream', '10g-uplink'],
      recommended: ['10 Gig'],
      description: 'Ceiling‑mounted 6‑stream WiFi 7 AP with 10/5/2.5/1 GbE support'
    },
    {
      sku: 'U7-Lite',
      name: 'UniFi 7 Lite',
      price: 99,
      speedTiers: ['2.5 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 3600,
        bands: ['2.4GHz', '5GHz', '6GHz'],
        mimo: '4x4',
        powerConsumption: 18,
        mountType: 'ceiling',
        uplinkPorts: ['2.5G']
      },
      tags: ['compact', 'wifi7', 'four-stream', 'budget'],
      recommended: ['2.5 Gig'],
      description: 'Compact, ceiling‑mounted WiFi 7 AP with 4 spatial streams and a 2.5 GbE uplink'
    },
    {
      sku: 'U7-Pro-Outdoor',
      name: 'UniFi 7 Pro Outdoor',
      price: 279,
      speedTiers: ['2.5 Gig', '5 Gig', '10 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 6000,
        bands: ['2.4GHz', '5GHz', '6GHz'],
        mimo: '6x6',
        powerConsumption: 25,
        mountType: 'outdoor',
        weatherRating: 'IP67',
        antenna: 'directional super antenna'
      },
      tags: ['outdoor', 'wifi7', 'directional', 'weatherproof'],
      recommended: ['5 Gig'],
      description: 'All‑weather IP67 WiFi 7 AP with 6 spatial streams, extended‑range AFC 6 GHz support, integrated directional super antenna, and an articulation mounting bracket'
    },
    {
      sku: 'U7-Outdoor',
      name: 'UniFi 7 Outdoor',
      price: 199,
      speedTiers: ['2.5 Gig', '5 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 4800,
        bands: ['2.4GHz', '5GHz', '6GHz'],
        mimo: '4x4',
        powerConsumption: 20,
        mountType: 'outdoor',
        weatherRating: 'IP67',
        antenna: 'directional super antenna'
      },
      tags: ['outdoor', 'wifi7', 'directional', 'weatherproof'],
      recommended: ['2.5 Gig'],
      description: 'All‑weather WiFi 7 AP with 4 spatial streams, an integrated directional super antenna, and versatile mounting options'
    },
    {
      sku: 'U7-IW',
      name: 'UniFi 7 In‑Wall',
      price: 149,
      speedTiers: ['1 Gig', '2.5 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 3600,
        bands: ['2.4GHz', '5GHz'],
        mimo: '4x4',
        powerConsumption: 15,
        mountType: 'wall',
        additionalPorts: 1,
        integratedSwitch: true
      },
      tags: ['in-wall', 'wifi7', 'poe-switch', 'hospitality'],
      recommended: ['1 Gig'],
      description: 'Wall‑mounted WiFi 7 AP with 4 spatial streams and an integrated 2.5 GbE PoE switch designed for hospitality environments'
    },
    {
      sku: 'U7-Pro-Wall',
      name: 'UniFi 7 Pro Wall',
      price: 199,
      speedTiers: ['2.5 Gig', '5 Gig', '10 Gig'],
      features: {
        wifiStandard: 'WiFi 7',
        maxSpeed: 6600,
        bands: ['2.4GHz', '5GHz', '6GHz'],
        mimo: '6x6',
        powerConsumption: 20,
        mountType: 'wall',
        additionalPorts: 0
      },
      tags: ['wall-mount', 'wifi7', 'six-stream', 'home-builder'],
      recommended: ['5 Gig'],
      description: 'Wall‑mounted WiFi 7 AP with 6 spatial streams and 6 GHz support tailored for home builders with seamless installation options'
    },
    {
      sku: 'U6+',
      name: 'UniFi 6 Plus',
      price: 129,
      speedTiers: ['1 Gig', '2.5 Gig'],
      features: {
        wifiStandard: 'WiFi 6',
        maxSpeed: 3000,
        bands: ['2.4GHz', '5GHz'],
        mimo: '4x4',
        powerConsumption: 15,
        mountType: 'ceiling'
      },
      tags: ['wifi6', 'ceiling', 'four-stream', 'smb'],
      recommended: ['1 Gig'],
      description: 'Compact, ceiling‑mounted WiFi 6 AP with 4 spatial streams that improves upon the U6 Lite with higher performance and dual‑band WiFi 6 support—ideal for small and medium‑sized businesses'
    }
  ],
  cameras: [
    {
      sku: 'UVC-G4-Doorbell-Pro-PoE-Kit',
      name: 'G4 Doorbell Pro PoE Kit',
      price: 379,
      subCategory: 'Doorbell Camera',
      speedTiers: ['all'],
      securityTypes: ['doorbellCameras'],
      features: {
        resolution: '2K',
        nightVision: true,
        weatherRating: 'IP65',
        powerType: 'PoE',
        storageType: 'network',
        fieldOfView: 160,
        twoWayAudio: true
      },
      tags: ['doorbell', 'poe', 'night-vision', 'chime-included'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'Premium UniFi doorbell with integrated PoE and included PoE chime for plug‑and‑play installation'
    },
    {
      sku: 'UVC-G5-Bullet',
      name: 'G5 Bullet',
      price: 129,
      subCategory: 'Bullet Camera',
      speedTiers: ['all'],
      securityTypes: ['externalCameras'],
      features: {
        resolution: '2K',
        nightVision: true,
        weatherRating: 'IP66',
        powerType: 'PoE',
        storageType: 'network',
        fieldOfView: 102,
        multiAIEngine: false
      },
      tags: ['2k', 'poe', 'outdoor', 'compact'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'Next‑gen indoor/outdoor 2K HD PoE camera'
    },
    {
      sku: 'UVC-G5-Turret-Ultra',
      name: 'G5 Turret Ultra',
      price: 129,
      subCategory: 'Turret Camera',
      speedTiers: ['all'],
      securityTypes: ['externalCameras'],
      features: {
        resolution: '2K',
        nightVision: true,
        weatherRating: 'IP67',
        powerType: 'PoE',
        storageType: 'network',
        fieldOfView: 102,
        tamperResistant: true
      },
      tags: ['2k', 'weatherproof', 'turret', 'long-range'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'Ultra‑compact, tamper‑resistant, and weatherproof 2K HD PoE camera with long‑range night vision'
    },
    {
      sku: 'UVC-G6-Bullet',
      name: 'G6 Bullet',
      price: 199,
      subCategory: 'Bullet Camera',
      speedTiers: ['all'],
      securityTypes: ['externalCameras'],
      features: {
        resolution: '4K',
        nightVision: true,
        weatherRating: 'IP67',
        powerType: 'PoE',
        storageType: 'network',
        fieldOfView: 120,
        multiAIEngine: true
      },
      tags: ['4k', 'multi-ai', 'all-weather', 'long-range'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'All‑weather 4K PoE camera with a 1/1.8" 8MP image sensor, Multi‑TOPS AI Engine, and long‑range IR night vision'
    },
    {
      sku: 'UVC-G6-Dome',
      name: 'G6 Dome',
      price: 279,
      subCategory: 'Dome Camera',
      speedTiers: ['all'],
      securityTypes: ['internalCameras', 'externalCameras'],
      features: {
        resolution: '4K',
        nightVision: true,
        weatherRating: 'IK10',
        powerType: 'PoE',
        storageType: 'network',
        fieldOfView: 125,
        multiAIEngine: true,
        vandalProof: true
      },
      tags: ['4k', 'vandal-proof', 'high-traffic', 'discreet'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'All‑weather, vandal‑proof 4K PoE camera with a 1/1.8" 8MP image sensor, Multi‑TOPS AI Engine, and long‑range IR night vision ideal for discreet installations in high‑traffic areas'
    }
  ],
  doorAccess: [
    { 
      sku: 'UA-G2-PRO', 
      name: 'UniFi Access G2 Pro', 
      price: 159,
      subCategory: 'Access Reader',
      speedTiers: ['all'],
      securityTypes: ['doorAccess'],
      features: {
        connectivity: 'PoE',
        cardTypes: ['NFC', 'RFID'],
        weatherRating: 'IP65',
        display: 'OLED',
        keypad: true
      },
      tags: ['poe', 'keypad', 'weatherproof', 'oled-display'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'Professional access control reader with keypad and OLED display'
    },
    { 
      sku: 'UA-HUB', 
      name: 'UniFi Access Hub', 
      price: 379,
      subCategory: 'Access Controller',
      speedTiers: ['all'],
      securityTypes: ['doorAccess'],
      features: {
        connectivity: 'PoE',
        maxReaders: 4,
        backup: 'battery',
        storage: 'local'
      },
      tags: ['controller', 'poe', 'battery-backup', 'multi-door'],
      recommended: ['1 Gig', '2.5 Gig', '5 Gig', '10 Gig'],
      description: 'Central access control hub supporting up to 4 door readers'
    }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initializeStepNavigation();
  initializePackageSelection();
  initializeEquipmentSelection();
  initializeFormHandling();
  setupCalculationListeners();
  populatePackagePricing();
  initializeCameraListeners();
});



function populatePackagePricing() {
  // Update Basic package pricing - calculate from cable pricing since they should be the same
  const basicPriceElement = document.querySelector('[data-price="basic"]');
  if (basicPriceElement) {
    // Assuming coax and cat6 have the same cost for the "per drop" display
    const dropPrice = pricing.cables.coax.cost; // or could be Math.min of both cable types
    basicPriceElement.textContent = `$${dropPrice} per drop + $${pricing.packages.basic.installFee} install fee`;
  }
  
  const basicDepositElement = document.querySelector('[data-deposit="basic"]');
  if (basicDepositElement) {
    basicDepositElement.textContent = `$${pricing.packages.basic.depositAmount} deposit on quotes over $${pricing.packages.basic.depositThreshold}`;
  }
  
  // Update Premium package pricing
  const premiumPriceElement = document.querySelector('[data-price="premium"]');
  if (premiumPriceElement) {
    premiumPriceElement.textContent = `$${pricing.packages.premium.hourlyRate}/hr (Est. ${pricing.packages.premium.estimatedHours.min}-${pricing.packages.premium.estimatedHours.max} hours)`;
  }
  
  // Update Survey pricing
  const surveyPriceElement = document.querySelector('[data-price="survey"]');
  if (surveyPriceElement) {
    surveyPriceElement.textContent = `$${pricing.packages.survey.cost} (≈${pricing.packages.survey.estimatedHours} hrs) due up front`;
  }
}

// Step Navigation Functions
function initializeStepNavigation() {
  const step1 = document.getElementById('step-1-package');
  const step2 = document.getElementById('step-2-drop-info');
  const step3 = document.getElementById('step-3-equipment');
  const step4 = document.getElementById('step-4-contact');

  // Initialize page to show only Step 1
  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
  if (step3) step3.style.display = 'none';
  if (step4) step4.style.display = 'none';

  const showStep = (step) => {
    [step1, step2, step3, step4].forEach(s => s.style.display = 'none');
    step.style.display = 'block';
    
    // Smooth scroll to top
    step.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Step navigation buttons
  const toStep3Btn = document.getElementById('to-step-3');
  const backToStep2Btn = document.getElementById('back-to-step-2');
  const toStep4Btn = document.getElementById('to-step-4');
  const backToStep3Btn = document.getElementById('back-to-step-3');

  if (toStep3Btn) toStep3Btn.onclick = () => showStep(step3);
  if (backToStep2Btn) backToStep2Btn.onclick = () => showStep(step2);
  if (toStep4Btn) toStep4Btn.onclick = () => {
    updateFinalQuoteSummary();
    showStep(step4);
  };
  if (backToStep3Btn) backToStep3Btn.onclick = () => showStep(step3);

  // Change Package button should go back to Step 1
  const changePackageBtn = document.getElementById('changePackageBtn');
  if (changePackageBtn) {
    changePackageBtn.onclick = () => showStep(step1);
  }

  // Store step navigation function globally for other functions
  window.showStep = showStep;
  window.steps = { step1, step2, step3, step4 };
}

function initializePackageSelection() {
  // Package selection buttons
  const packageCards = document.querySelectorAll('.package-card');
  const packageButtons = document.querySelectorAll('.package-select-btn');
  
  packageButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const packageType = e.target.dataset.package;
      selectPackage(packageType);
    });
  });

  // Survey checkbox
  const surveyCheckbox = document.getElementById('includeSurvey');
  if (surveyCheckbox) {
    surveyCheckbox.addEventListener('change', (e) => {
      includeSurvey = e.target.checked;
      updateSurveyDisplay();
      calculatePricing();
    });
  }

  // Change package button
  const changePackageBtn = document.getElementById('changePackageBtn');
  if (changePackageBtn) {
    changePackageBtn.addEventListener('click', () => {
      showPackageSelection();
    });
  }
}

function selectPackage(packageType) {
  selectedPackage = packageType;
  
  // Update hidden input
  const hiddenInput = document.getElementById('selectedPackage');
  if (hiddenInput) {
    hiddenInput.value = packageType;
  }

  // Update display
  const displayName = document.getElementById('packageDisplayName');
  if (displayName) {
    displayName.textContent = packageType;
  }

  // Update service labels based on package type
  updateServiceLabels(packageType);

  // Move to Step 2: Drop Info and Pricing
  if (window.showStep && window.steps) {
    window.showStep(window.steps.step2);
  }
  
  // Calculate pricing immediately
  calculatePricing();
}

function updateServiceLabels(packageType) {
  // Update service labels
  const serviceLabels = document.querySelectorAll('.service-label');
  
  // Define the base service names
  const serviceNames = {
    deviceMount: 'Device mounting',
    clientDevice: 'Client device setup',
    serverDevice: 'Host/server device setup',
    mediaPanel: 'Media panel install',
    internalCameras: 'Internal cameras',
    externalCameras: 'External cameras',
    doorbellCameras: 'Doorbell cameras'
  };
  
  serviceLabels.forEach(label => {
    const serviceType = label.dataset.service;
    let service = null;
    
    // Check if it's a regular service or camera service
    if (servicePricing[serviceType]) {
      service = servicePricing[serviceType];
    } else if (pricing.cameras[serviceType]) {
      service = pricing.cameras[serviceType];
    }
    
    if (service && serviceNames[serviceType]) {
      const baseName = serviceNames[serviceType];
      
      if (packageType === 'Basic') {
        const unit = serviceType === 'mediaPanel' ? '' : 
                    serviceType.includes('device') || serviceType.includes('Device') ? '/device' : 
                    serviceType.includes('Cameras') ? '/camera' : '/item';
        label.textContent = `${baseName} ($${service.cost}${unit})`;
      } else if (packageType === 'Premium') {
        const timeText = service.time === 1 ? '1 hr' : `${service.time} hrs`;
        label.textContent = `${baseName} (${timeText} each)`;
      }
    }
  });

  // Update cable run labels
  const cableLabels = document.querySelectorAll('.cable-label');
  
  // Define the base cable names
  const cableNames = {
    coax: 'Coax runs',
    cat6: 'Cat6 runs'
  };
  
  cableLabels.forEach(label => {
    const cableType = label.dataset.cable;
    if (cablePricing[cableType] && cableNames[cableType]) {
      const cable = cablePricing[cableType];
      const baseName = cableNames[cableType];
      
      if (packageType === 'Basic') {
        label.textContent = `${baseName} ($${cable.cost}/run)`;
      } else if (packageType === 'Premium') {
        const timeText = cable.time === 1 ? '1 hr' : `${cable.time} hrs`;
        label.textContent = `${baseName} (${timeText} each)`;
      }
    }
  });
}

function updateSurveyDisplay() {
  const surveyFeeInfo = document.getElementById('surveyFeeInfo');
  const premiumSurveyFeeInfo = document.getElementById('premiumSurveyFeeInfo');
  
  if (includeSurvey) {
    if (surveyFeeInfo) surveyFeeInfo.style.display = 'block';
    if (premiumSurveyFeeInfo) premiumSurveyFeeInfo.style.display = 'block';
  } else {
    if (surveyFeeInfo) surveyFeeInfo.style.display = 'none';
    if (premiumSurveyFeeInfo) premiumSurveyFeeInfo.style.display = 'none';
  }
}

function initializeEquipmentSelection() {
  // Speed tier radio buttons
  const speedTierRadios = document.querySelectorAll('input[name="speedTier"]');
  speedTierRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedSpeedTier = e.target.value;
        showEquipmentOptions();
      }
    });
  });

  // Initialize filter controls
  initializeEquipmentFilters();
}

function showEquipmentOptions() {
  if (!selectedSpeedTier) return;
  
  const equipmentOptions = document.getElementById('equipmentOptions');
  const equipmentCards = document.getElementById('equipmentCards');
  
  if (!equipmentOptions || !equipmentCards) return;
  
  // Clear existing cards
  equipmentCards.innerHTML = '';
  
  // Get all equipment that supports the selected speed tier
  const filteredEquipment = getAllEquipmentForSpeedTier(selectedSpeedTier);
  
  // Group equipment by category
  const groupedEquipment = groupEquipmentByCategory(filteredEquipment);
  
  // Create category sections
  Object.entries(groupedEquipment).forEach(([category, items]) => {
    const categorySection = createCategorySection(category, items);
    equipmentCards.appendChild(categorySection);
  });
  
  // Show the equipment options
  equipmentOptions.style.display = 'block';
  
  // Show recommendations
  showRecommendations(selectedSpeedTier);
}

function getAllEquipmentForSpeedTier(speedTier) {
  const allEquipment = [];
  
  Object.entries(equipmentCatalog).forEach(([categoryKey, categoryItems]) => {
    const categoryName = getCategoryDisplayName(categoryKey);
    categoryItems.forEach(item => {
      // Include item if it matches the speed tier or if it's security equipment (marked with 'all')
      const speedTierMatch = item.speedTiers.includes(speedTier) || item.speedTiers.includes('all');
      
      if (speedTierMatch) {
        // Add the category name to the item when we retrieve it
        allEquipment.push({ ...item, category: categoryName });
      }
    });
  });
  
  return allEquipment;
}


function getCategoryDisplayName(categoryKey) {
  const categoryNames = {
    'gateways': 'Gateway',
    'switches': 'Switch', 
    'accessPoints': 'Access Point',
    'cameras': 'Camera',
    'doorAccess': 'Door Access'
  };
  return categoryNames[categoryKey] || categoryKey;
}

function groupEquipmentByCategory(equipment) {
  return equipment.reduce((groups, item) => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
    return groups;
  }, {});
}

function createCategorySection(category, items) {
  const section = document.createElement('div');
  section.className = 'equipment-category-section';
  
  const categoryHeader = document.createElement('h4');
  categoryHeader.className = 'equipment-category-header';
  categoryHeader.textContent = category;
  section.appendChild(categoryHeader);
  
  const categoryGrid = document.createElement('div');
  categoryGrid.className = 'equipment-category-grid';
  
  items.forEach(item => {
    const card = createEquipmentCard(item);
    categoryGrid.appendChild(card);
  });
  
  section.appendChild(categoryGrid);
  return section;
}

function showRecommendations(speedTier) {
  const recommendationContainer = document.getElementById('equipmentRecommendations') || createRecommendationContainer();
  
  // Get recommended items for this speed tier
  const recommendations = getAllEquipmentForSpeedTier(speedTier)
    .filter(item => item.recommended.includes(speedTier))
    .slice(0, 3); // Show top 3 recommendations
  
  if (recommendations.length > 0) {
    recommendationContainer.innerHTML = '<h4>Recommended for ' + speedTier + ':</h4>';
    const recGrid = document.createElement('div');
    recGrid.className = 'recommendations-grid';
    
    recommendations.forEach(item => {
      const recCard = createRecommendationCard(item);
      recGrid.appendChild(recCard);
    });
    
    recommendationContainer.appendChild(recGrid);
    recommendationContainer.style.display = 'block';
  }
}

function createRecommendationContainer() {
  const container = document.createElement('div');
  container.id = 'equipmentRecommendations';
  container.className = 'equipment-recommendations';
  
  const equipmentOptions = document.getElementById('equipmentOptions');
  if (equipmentOptions) {
    equipmentOptions.insertBefore(container, equipmentOptions.firstChild);
  }
  
  return container;
}

function createRecommendationCard(item) {
  const card = document.createElement('div');
  card.className = 'recommendation-card';
  card.innerHTML = `
    <div class="rec-badge">Recommended</div>
    <h5>${item.name}</h5>
    <p class="rec-price">$${item.price}</p>
    <p class="rec-description">${item.description}</p>
    <button type="button" class="add-to-cart-btn" data-sku="${item.sku}">Add to Cart</button>
  `;
  
  const addButton = card.querySelector('.add-to-cart-btn');
  addButton.addEventListener('click', () => addToCart(item));
  
  return card;
}

function createEquipmentCard(item) {
  const card = document.createElement('div');
  card.className = 'equipment-card card';
  
  // Create feature tags
  const featureTags = item.tags.slice(0, 3).map(tag => 
    `<span class="feature-tag">${tag}</span>`
  ).join('');
  
  // Create key features list
  const keyFeatures = [];
  if (item.features.PoE) keyFeatures.push('PoE Support');
  if (item.features.sfp) keyFeatures.push('SFP+ Ports');
  if (item.features.numPorts) keyFeatures.push(`${item.features.numPorts} Ports`);
  if (item.features.wifiStandard) keyFeatures.push(item.features.wifiStandard);
  if (item.features.resolution) keyFeatures.push(item.features.resolution);
  
  const featuresHTML = keyFeatures.slice(0, 3).map(feature => 
    `<li>${feature}</li>`
  ).join('');
  
  card.innerHTML = `
    <div class="card-header">
      <h4>${item.name}</h4>
      ${item.subCategory ? `<p class="equipment-subcategory">${item.subCategory}</p>` : ''}
      <div class="feature-tags">${featureTags}</div>
    </div>
    <div class="card-body">
      <p class="equipment-description">${item.description}</p>
      ${featuresHTML ? `<ul class="key-features">${featuresHTML}</ul>` : ''}
      <div class="equipment-specs">
        ${item.features.maxSpeed ? `<span class="spec">Max Speed: ${item.features.maxSpeed} Mbps</span>` : ''}
        ${item.features.powerConsumption ? `<span class="spec">Power: ${item.features.powerConsumption}W</span>` : ''}
      </div>
    </div>
    <div class="card-footer">
      <p class="equipment-price">$${item.price}</p>
      <p class="equipment-sku">SKU: ${item.sku}</p>
      <button type="button" class="add-to-cart-btn" data-sku="${item.sku}">Add to Cart</button>
    </div>
  `;
  
  // Add event listener to the add to cart button
  const addButton = card.querySelector('.add-to-cart-btn');
  addButton.addEventListener('click', () => addToCart(item));
  
  return card;
}

function initializeEquipmentFilters() {
  // This function will be called when filters are added to the HTML
  // For now, we'll prepare the structure for future filtering capabilities
}

// Equipment filtering functions
function filterEquipmentByFeature(equipment, featureKey, featureValue) {
  return equipment.filter(item => {
    if (featureKey === 'category') {
      // Category is now dynamically added, so this still works
      return item.category === featureValue;
    }
    if (featureKey === 'subCategory') {
      return item.subCategory === featureValue;
    }
    if (featureKey === 'tags') {
      return item.tags.includes(featureValue);
    }
    if (featureKey === 'priceRange') {
      const [min, max] = featureValue.split('-').map(Number);
      return item.price >= min && item.price <= max;
    }
    if (item.features && item.features[featureKey] !== undefined) {
      return item.features[featureKey] === featureValue;
    }
    return false;
  });
}

function getEquipmentByRecommendation(speedTier, maxItems = 5) {
  const allEquipment = getAllEquipmentForSpeedTier(speedTier);
  
  // Sort by recommendation priority and price
  return allEquipment
    .filter(item => item.recommended.includes(speedTier))
    .sort((a, b) => {
      // Prioritize recommended items, then by price
      const aRec = item.recommended.includes(speedTier) ? 1 : 0;
      const bRec = item.recommended.includes(speedTier) ? 1 : 0;
      
      if (aRec !== bRec) return bRec - aRec; // Recommended first
      return a.price - b.price; // Then by price ascending
    })
    .slice(0, maxItems);
}

function addToCart(item) {
  // Check if item already exists in cart
  const existingItem = equipmentCart.find(cartItem => cartItem.sku === item.sku);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    equipmentCart.push({ ...item, quantity: 1 });
  }
  
  updateCartDisplay();
  calculatePricing();
}

function removeFromCart(sku) {
  equipmentCart = equipmentCart.filter(item => item.sku !== sku);
  updateCartDisplay();
  calculatePricing();
}

function updateCartQuantity(sku, quantity) {
  const item = equipmentCart.find(cartItem => cartItem.sku === sku);
  if (item) {
    if (quantity <= 0) {
      removeFromCart(sku);
    } else {
      item.quantity = quantity;
      updateCartDisplay();
      calculatePricing();
    }
  }
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const equipmentCart_ = document.getElementById('equipmentCart');
  const equipmentTotal = document.getElementById('equipmentTotal');
  
  if (!cartItems) return;
  
  // Clear existing cart items
  cartItems.innerHTML = '';
  
  if (equipmentCart.length === 0) {
    if (equipmentCart_) equipmentCart_.style.display = 'none';
    return;
  }
  
  // Show cart
  if (equipmentCart_) equipmentCart_.style.display = 'block';
  
  // Create cart item elements
  equipmentCart.forEach(item => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <span class="cart-item-price">$${item.price} each</span>
      </div>
      <div class="cart-item-controls">
        <input type="number" min="1" value="${item.quantity}" 
               onchange="updateCartQuantity('${item.sku}', parseInt(this.value))"
               class="quantity-input">
        <button type="button" onclick="removeFromCart('${item.sku}')" class="remove-btn">Remove</button>
      </div>
      <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
    `;
    cartItems.appendChild(cartItem);
  });
  
  // Update total
  const total = getEquipmentTotal();
  if (equipmentTotal) equipmentTotal.textContent = total.toFixed(2);
}

function getEquipmentTotal() {
  return equipmentCart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Make functions globally accessible for onclick handlers
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

function setupCalculationListeners() {
  // Add listeners to all input fields for real-time calculation
  const inputFields = [
    'coaxRuns', 'cat6Runs', 'deviceMountQty', 'clientDeviceQty', 'serverDeviceQty', 'mediaPanelQty',
    'internalCamerasQty', 'externalCamerasQty', 'doorbellCamerasQty'
  ];
  
  inputFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', calculatePricing);
    }
  });
}

async function calculatePricing() {
  if (!selectedPackage) return;

  const runs = {
    coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
    cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0
  };

  const services = {
    deviceMount: parseInt(document.getElementById('deviceMountQty')?.value) || 0,
    clientDevice: parseInt(document.getElementById('clientDeviceQty')?.value) || 0,
    serverDevice: parseInt(document.getElementById('serverDeviceQty')?.value) || 0,
    mediaPanel: parseInt(document.getElementById('mediaPanelQty')?.value) || 0,
    internalCameras: parseInt(document.getElementById('internalCamerasQty')?.value) || 0,
    externalCameras: parseInt(document.getElementById('externalCamerasQty')?.value) || 0,
    doorbellCameras: parseInt(document.getElementById('doorbellCamerasQty')?.value) || 0
  };

  const cameras = {
    internalCameras: parseInt(document.getElementById('internalCamerasQty')?.value) || 0,
    externalCameras: parseInt(document.getElementById('externalCamerasQty')?.value) || 0,
    doorbellCameras: parseInt(document.getElementById('doorbellCamerasQty')?.value) || 0
  };

  // Calculate equipment total
  const equipmentTotal = getEquipmentTotal();

  try {
    const params = new URLSearchParams({
      packageOption: selectedPackage,
      includeSurvey: includeSurvey,
      'runs[coax]': runs.coax,
      'runs[cat6]': runs.cat6,
      'services[deviceMount]': services.deviceMount,
      'services[clientDevice]': services.clientDevice,
      'services[serverDevice]': services.serverDevice,
      'services[mediaPanel]': services.mediaPanel,
      'services[internalCameras]': services.internalCameras,
      'services[externalCameras]': services.externalCameras,
      'services[doorbellCameras]': services.doorbellCameras,
      equipmentTotal: equipmentTotal
    });

    const response = await fetch(`/api/quotes/calculate?${params}`);
    const data = await response.json();

    if (response.ok) {
      updatePricingDisplay(data);
    } else {
      console.error('Calculation error:', data.error);
    }
  } catch (err) {
    console.error('Network error during calculation:', err);
  }
}

function updatePricingDisplay(data) {
  const { packageOption, pricing } = data;

  // Hide both pricing displays first
  const basicPricing = document.getElementById('basicPricing');
  const premiumPricing = document.getElementById('premiumPricing');
  
  if (basicPricing) basicPricing.style.display = 'none';
  if (premiumPricing) premiumPricing.style.display = 'none';

  if (packageOption === 'Basic') {
    if (basicPricing) basicPricing.style.display = 'block';
    
    // Update basic pricing elements
    const totalCost = document.getElementById('totalCost');
    const depositAmount = document.getElementById('depositAmount');
    const depositInfo = document.getElementById('depositInfo');
    const surveyFee = document.getElementById('surveyFee');
    const equipmentCostBasic = document.getElementById('equipmentCostBasic');
    const equipmentCostBasicAmount = document.getElementById('equipmentCostBasicAmount');
    
    if (totalCost) totalCost.textContent = pricing.totalCost || 0;
    if (depositAmount) depositAmount.textContent = pricing.depositRequired || 0;
    if (surveyFee) surveyFee.textContent = pricing.surveyFee || 0;
    
    // Show equipment cost if there is any
    if (pricing.equipmentTotal > 0) {
      if (equipmentCostBasic) equipmentCostBasic.style.display = 'block';
      if (equipmentCostBasicAmount) equipmentCostBasicAmount.textContent = pricing.equipmentTotal || 0;
    } else {
      if (equipmentCostBasic) equipmentCostBasic.style.display = 'none';
    }
    
    // Update deposit info text based on survey inclusion
    if (depositInfo) {
      if (includeSurvey && pricing.surveyFee > 0) {
        depositInfo.textContent = 'No deposit required (Survey covers deposit)';
      } else {
        depositInfo.innerHTML = `Deposit Required: $<span id="depositAmount">${pricing.depositRequired || 0}</span>`;
      }
    }
    
  } else if (packageOption === 'Premium') {
    if (premiumPricing) premiumPricing.style.display = 'block';
    
    // Update premium pricing elements
    const estimatedHours = document.getElementById('estimatedHours');
    const laborRate = document.getElementById('laborRate');
    const estimatedTotal = document.getElementById('estimatedTotal');
    const premiumSurveyFee = document.getElementById('premiumSurveyFee');
    const equipmentCostPremium = document.getElementById('equipmentCostPremium');
    const equipmentCostPremiumAmount = document.getElementById('equipmentCostPremiumAmount');
    
    if (estimatedHours) estimatedHours.textContent = pricing.estimatedLaborHours || 0;
    if (laborRate) laborRate.textContent = pricing.laborRate || 50;
    if (estimatedTotal) estimatedTotal.textContent = pricing.estimatedTotal || 0;
    if (premiumSurveyFee) premiumSurveyFee.textContent = pricing.surveyFee || 0;
    
    // Show equipment cost if there is any
    if (pricing.equipmentTotal > 0) {
      if (equipmentCostPremium) equipmentCostPremium.style.display = 'block';
      if (equipmentCostPremiumAmount) equipmentCostPremiumAmount.textContent = pricing.equipmentTotal || 0;
    } else {
      if (equipmentCostPremium) equipmentCostPremium.style.display = 'none';
    }
  }
}

function initializeFormHandling() {
  const form = document.getElementById('quoteForm');
  if (!form) {
    console.error('Could not find #quoteForm on the page.');
    return;
  }
  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!selectedPackage) {
    alert('Please select a package before submitting.');
    return;
  }

  const name = document.getElementById('name')?.value.trim() || '';
  const email = document.getElementById('email')?.value.trim() || '';

  if (!name || !email) {
    alert('Please fill in your name and email.');
    return;
  }

  const runs = {
    coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
    cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0
  };

  const services = {
    deviceMount: parseInt(document.getElementById('deviceMountQty')?.value) || 0,
    clientDevice: parseInt(document.getElementById('clientDeviceQty')?.value) || 0,
    serverDevice: parseInt(document.getElementById('serverDeviceQty')?.value) || 0,
    mediaPanel: parseInt(document.getElementById('mediaPanelQty')?.value) || 0,
    internalCameras: parseInt(document.getElementById('internalCamerasQty')?.value) || 0,
    externalCameras: parseInt(document.getElementById('externalCamerasQty')?.value) || 0,
    doorbellCameras: parseInt(document.getElementById('doorbellCamerasQty')?.value) || 0
  };

  const payload = {
    customer: { name, email },
    packageOption: selectedPackage,
    includeSurvey: includeSurvey,
    speedTier: selectedSpeedTier,
    discount: 0,
    runs,
    services,
    equipment: equipmentCart
  };

  try {
    const res = await fetch('/api/quotes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert(`Quote submitted successfully! Your quote number is: #${data.quoteNumber}`);
      // Reset form and return to step 1
      form.reset();
      selectedPackage = null;
      includeSurvey = false;
      selectedSpeedTier = null;
      equipmentCart = [];
      updateCartDisplay();
      
      // Return to step 1
      if (window.showStep && window.steps) {
        window.showStep(window.steps.step1);
      }
    } else {
      alert(`Error creating quote: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error(err);
    alert(`Network error: ${err.message}`);
  }
}

function updateFinalQuoteSummary() {
  // Update package summary
  updatePackageSummary();
  
  // Update cable runs summary
  updateCableRunsSummary();
  
  // Update services summary
  updateServicesSummary();
  
  // Update equipment summary
  updateEquipmentSummary();
  
  // Update survey summary
  updateSurveySummary();
  
  // Update final totals
  updateFinalTotals();
}

function updatePackageSummary() {
  const summaryPackageName = document.getElementById('summaryPackageName');
  const summaryPackagePrice = document.getElementById('summaryPackagePrice');
  
  if (summaryPackageName) {
    summaryPackageName.textContent = selectedPackage || 'Not selected';
  }
  
  if (summaryPackagePrice) {
    if (selectedPackage === 'Basic') {
      summaryPackagePrice.textContent = '$50 per drop + $50 install fee';
    } else if (selectedPackage === 'Premium') {
      summaryPackagePrice.textContent = '$50/hr (Est. 3-5 hours)';
    } else {
      summaryPackagePrice.textContent = '-';
    }
  }
}

function updateCableRunsSummary() {
  const summaryCableRuns = document.getElementById('summaryCableRuns');
  const summaryRuns = document.getElementById('summaryRuns');
  
  if (!summaryRuns) return;
  
  const coaxRuns = parseInt(document.getElementById('coaxRuns')?.value) || 0;
  const cat6Runs = parseInt(document.getElementById('cat6Runs')?.value) || 0;
  
  if (coaxRuns === 0 && cat6Runs === 0) {
    if (summaryCableRuns) summaryCableRuns.style.display = 'none';
    return;
  }
  
  if (summaryCableRuns) summaryCableRuns.style.display = 'block';
  
  let runsHTML = '';
  if (coaxRuns > 0) {
    runsHTML += `<div class="summary-run-item">
      <span>Coax runs: ${coaxRuns}</span>
      <span>$${coaxRuns * cablePricing.coax.cost}</span>
    </div>`;
  }
  if (cat6Runs > 0) {
    runsHTML += `<div class="summary-run-item">
      <span>Cat6 runs: ${cat6Runs}</span>
      <span>$${cat6Runs * cablePricing.cat6.cost}</span>
    </div>`;
  }
  
  summaryRuns.innerHTML = runsHTML;
}

function updateServicesSummary() {
  const summaryServices = document.getElementById('summaryServices');
  const summaryServicesList = document.getElementById('summaryServicesList');
  
  if (!summaryServicesList) return;
  
  const deviceMount = parseInt(document.getElementById('deviceMountQty')?.value) || 0;
  const clientDevice = parseInt(document.getElementById('clientDeviceQty')?.value) || 0;
  const serverDevice = parseInt(document.getElementById('serverDeviceQty')?.value) || 0;
  const mediaPanel = parseInt(document.getElementById('mediaPanelQty')?.value) || 0;
  const internalCameras = parseInt(document.getElementById('internalCamerasQty')?.value) || 0;
  const externalCameras = parseInt(document.getElementById('externalCamerasQty')?.value) || 0;
  const doorbellCameras = parseInt(document.getElementById('doorbellCamerasQty')?.value) || 0;
  
  if (deviceMount === 0 && clientDevice === 0 && serverDevice === 0 && mediaPanel === 0 &&
      internalCameras === 0 && externalCameras === 0 && doorbellCameras === 0) {
    if (summaryServices) summaryServices.style.display = 'none';
    return;
  }
  
  if (summaryServices) summaryServices.style.display = 'block';
  
  let servicesHTML = '';
  if (deviceMount > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>Device mounting (${deviceMount}x)</span>
      <span>$${deviceMount * servicePricing.deviceMount.cost}</span>
    </div>`;
  }
  if (clientDevice > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>Client device setup (${clientDevice}x)</span>
      <span>$${clientDevice * servicePricing.clientDevice.cost}</span>
    </div>`;
  }
  if (serverDevice > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>Host/server device setup (${serverDevice}x)</span>
      <span>$${serverDevice * servicePricing.serverDevice.cost}</span>
    </div>`;
  }
  if (mediaPanel > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>Media panel install (${mediaPanel}x)</span>
      <span>$${mediaPanel * servicePricing.mediaPanel.cost}</span>
    </div>`;
  }
  if (internalCameras > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>Internal cameras (${internalCameras}x)</span>
      <span>$${internalCameras * pricing.cameras.internalCameras.cost}</span>
    </div>`;
  }
  if (externalCameras > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>External cameras (${externalCameras}x)</span>
      <span>$${externalCameras * pricing.cameras.externalCameras.cost}</span>
    </div>`;
  }
  if (doorbellCameras > 0) {
    servicesHTML += `<div class="summary-service-item">
      <span>Doorbell cameras (${doorbellCameras}x)</span>
      <span>$${doorbellCameras * pricing.cameras.doorbellCameras.cost}</span>
    </div>`;
  }
  
  summaryServicesList.innerHTML = servicesHTML;
}

function updateEquipmentSummary() {
  const summaryEquipment = document.getElementById('summaryEquipment');
  const summaryEquipmentList = document.getElementById('summaryEquipmentList');
  
  if (!summaryEquipmentList) return;
  
  if (equipmentCart.length === 0) {
    if (summaryEquipment) summaryEquipment.style.display = 'none';
    return;
  }
  
  if (summaryEquipment) summaryEquipment.style.display = 'block';
  
  let equipmentHTML = '';
  equipmentCart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    equipmentHTML += `<div class="summary-equipment-item">
      <span>${item.name} (${item.quantity}x)</span>
      <span>$${itemTotal.toFixed(2)}</span>
    </div>`;
  });
  
  summaryEquipmentList.innerHTML = equipmentHTML;
}

function updateSurveySummary() {
  const summarySurvey = document.getElementById('summarySurvey');
  
  if (!summarySurvey) return;
  
  if (includeSurvey) {
    summarySurvey.style.display = 'block';
  } else {
    summarySurvey.style.display = 'none';
  }
}

function updateFinalTotals() {
  const summarySubtotal = document.getElementById('summarySubtotal');
  const summarySubtotalAmount = document.getElementById('summarySubtotalAmount');
  const summaryEquipmentTotal = document.getElementById('summaryEquipmentTotal');
  const summaryEquipmentAmount = document.getElementById('summaryEquipmentAmount');
  const summaryFinalTotal = document.getElementById('summaryFinalTotal');
  
  // Calculate totals
  const coaxRuns = parseInt(document.getElementById('coaxRuns')?.value) || 0;
  const cat6Runs = parseInt(document.getElementById('cat6Runs')?.value) || 0;
  const deviceMount = parseInt(document.getElementById('deviceMountQty')?.value) || 0;
  const clientDevice = parseInt(document.getElementById('clientDeviceQty')?.value) || 0;
  const serverDevice = parseInt(document.getElementById('serverDeviceQty')?.value) || 0;
  const mediaPanel = parseInt(document.getElementById('mediaPanelQty')?.value) || 0;
  const internalCameras = parseInt(document.getElementById('internalCamerasQty')?.value) || 0;
  const externalCameras = parseInt(document.getElementById('externalCamerasQty')?.value) || 0;
  const doorbellCameras = parseInt(document.getElementById('doorbellCamerasQty')?.value) || 0;
  
  let serviceSubtotal = 0;
  
  if (selectedPackage === 'Basic') {
    // Basic package: cable runs + services + install fee
    const totalRuns = coaxRuns + cat6Runs;
    const runsTotal = (coaxRuns * pricing.cables.coax.cost) + (cat6Runs * pricing.cables.cat6.cost);
    const servicesTotal = (deviceMount * pricing.services.deviceMount.cost) + 
                         (clientDevice * pricing.services.clientDevice.cost) + 
                         (serverDevice * pricing.services.serverDevice.cost) + 
                         (mediaPanel * pricing.services.mediaPanel.cost);
    const camerasTotal = (internalCameras * pricing.cameras.internalCameras.cost) + 
                        (externalCameras * pricing.cameras.externalCameras.cost) + 
                        (doorbellCameras * pricing.cameras.doorbellCameras.cost);
    const installFee = totalRuns > 0 ? pricing.packages.basic.installFee : 0;
    
    serviceSubtotal = runsTotal + servicesTotal + camerasTotal + installFee;
    
  } else if (selectedPackage === 'Premium') {
    // Premium package: hours calculated purely from actual work
    const runHours = (coaxRuns * pricing.cables.coax.time) + (cat6Runs * pricing.cables.cat6.time);
    const serviceHours = (deviceMount * pricing.services.deviceMount.time) + 
                        (clientDevice * pricing.services.clientDevice.time) + 
                        (serverDevice * pricing.services.serverDevice.time) + 
                        (mediaPanel * pricing.services.mediaPanel.time);
    const cameraHours = (internalCameras * pricing.cameras.internalCameras.time) + 
                       (externalCameras * pricing.cameras.externalCameras.time) + 
                       (doorbellCameras * pricing.cameras.doorbellCameras.time);
    const totalHours = runHours + serviceHours + cameraHours;
    
    const laborTotal = totalHours * pricing.packages.premium.hourlyRate;
    
    serviceSubtotal = laborTotal;
  }
  
  const equipmentTotal = getEquipmentTotal();
  const surveyFee = includeSurvey ? pricing.packages.survey.cost : 0;
  
  // Update displays
  if (serviceSubtotal > 0) {
    if (summarySubtotal) summarySubtotal.style.display = 'block';
    if (summarySubtotalAmount) summarySubtotalAmount.textContent = `$${serviceSubtotal.toFixed(2)}`;
  } else {
    if (summarySubtotal) summarySubtotal.style.display = 'none';
  }
  
  if (equipmentTotal > 0) {
    if (summaryEquipmentTotal) summaryEquipmentTotal.style.display = 'block';
    if (summaryEquipmentAmount) summaryEquipmentAmount.textContent = `$${equipmentTotal.toFixed(2)}`;
  } else {
    if (summaryEquipmentTotal) summaryEquipmentTotal.style.display = 'none';
  }
  
  const finalTotal = serviceSubtotal + equipmentTotal + surveyFee;
  if (summaryFinalTotal) {
    summaryFinalTotal.textContent = `$${finalTotal.toFixed(2)}`;
  }
}

function initializeCameraListeners() {
  // Camera installations factor in their own ethernet drops, so no Cat6 auto-increment needed
  // Camera quantity changes will only trigger pricing recalculations through existing setupCalculationListeners
}

