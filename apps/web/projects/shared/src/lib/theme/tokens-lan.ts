import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// Placeholder palette for the lan site until its design unit (12). Every pair is checked by tokens.spec.ts.
export const LAN_TOKENS: SiteTokens = {
  key: 'lan',
  colors: {
    bg: '#ffffff',
    surface: '#f2f4f7',
    text: '#101828',
    textMuted: '#344054',
    link: '#0b5563',
    accent: '#0b5563',
    onAccent: '#ffffff',
    focus: '#1d4ed8',
    bannerBg: '#fff3bf',
    bannerText: '#3b2f00',
    panel: '#101828',
    onPanel: '#ffffff',
  },
  pairs: STANDARD_PAIRS,
};
