export type ServiceId = "networking" | "cameras" | "smart-home" | "wiring";
export type AccentColor = "green" | "orange" | "purple" | "cyan";

export interface PainPoint {
  title: string;
  description: string;
  icon: string; // FontAwesome class
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface Feature {
  title: string;
  summary: string;
  detail: string;
  icon: string;
  badge?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface PricingInfo {
  label: string;
  price: string;
  unit?: string;
  description: string;
  inclusions: string[];
  note?: string;
}

export interface ServiceConfig {
  id: ServiceId;
  accent: AccentColor;
  title: string;
  subtitle: string;
  badge: string;
  painPointsHeading: string;
  painPointsSubheading: string;
  painPoints: PainPoint[];
  processSteps: ProcessStep[];
  features: Feature[];
  faqs: FAQItem[];
  pricing: PricingInfo;
  ctaHeadline: string;
  ctaSubtext: string;
}

// Complete Tailwind class string literals for JIT compatibility
export const ACCENT_TEXT: Record<AccentColor, string> = {
  green: "text-green",
  orange: "text-orange",
  purple: "text-purple",
  cyan: "text-cyan",
};

export const ACCENT_BG: Record<AccentColor, string> = {
  green: "bg-green",
  orange: "bg-orange",
  purple: "bg-purple",
  cyan: "bg-cyan",
};

export const ACCENT_BG_MUTED: Record<AccentColor, string> = {
  green: "bg-green-muted/20",
  orange: "bg-orange-muted/20",
  purple: "bg-purple-muted/20",
  cyan: "bg-cyan-muted/20",
};

export const ACCENT_BORDER: Record<AccentColor, string> = {
  green: "border-green/20",
  orange: "border-orange/20",
  purple: "border-purple/20",
  cyan: "border-cyan/20",
};

export const ACCENT_GLOW: Record<AccentColor, string> = {
  green: "shadow-glow",
  orange: "shadow-glow-orange",
  purple: "shadow-glow-purple",
  cyan: "shadow-glow-cyan",
};

export const ACCENT_GRADIENT: Record<AccentColor, string> = {
  green: "from-green/15 via-transparent to-transparent",
  orange: "from-orange/15 via-transparent to-transparent",
  purple: "from-purple/15 via-transparent to-transparent",
  cyan: "from-cyan/15 via-transparent to-transparent",
};

export const ACCENT_ICON_BG: Record<AccentColor, string> = {
  green: "bg-green/10 text-green",
  orange: "bg-orange/10 text-orange",
  purple: "bg-purple/10 text-purple",
  cyan: "bg-cyan/10 text-cyan",
};

export const ACCENT_BADGE_VARIANT: Record<AccentColor, "green" | "orange" | "purple" | "cyan"> = {
  green: "green",
  orange: "orange",
  purple: "purple",
  cyan: "cyan",
};

export const ACCENT_GLOW_TEXT: Record<AccentColor, string> = {
  green: "glow-text-green",
  orange: "glow-text-orange",
  purple: "glow-text-purple",
  cyan: "glow-text-cyan",
};

export const ACCENT_NUMBER: Record<AccentColor, string> = {
  green: "text-green/20",
  orange: "text-orange/20",
  purple: "text-purple/20",
  cyan: "text-cyan/20",
};

export const ACCENT_DIVIDER: Record<AccentColor, string> = {
  green: "from-transparent via-green/20 to-transparent",
  orange: "from-transparent via-orange/20 to-transparent",
  purple: "from-transparent via-purple/20 to-transparent",
  cyan: "from-transparent via-cyan/20 to-transparent",
};

export const ACCENT_RING: Record<AccentColor, string> = {
  green: "ring-green/30",
  orange: "ring-orange/30",
  purple: "ring-purple/30",
  cyan: "ring-cyan/30",
};
