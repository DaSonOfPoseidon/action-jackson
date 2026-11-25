import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// Placeholder palette for the car site until its design unit (18). Every pair is checked by tokens.spec.ts.
export const CAR_TOKENS: SiteTokens = {
  key: 'car',
  colors: {
    bg: '#ffffff',
    surface: '#f2f4f7',
    text: '#101828',
    textMuted: '#344054',
    link: '#8a1c1c',
    accent: '#8a1c1c',
    onAccent: '#ffffff',
    focus: '#1d4ed8',
    bannerBg: '#fff3bf',
    bannerText: '#3b2f00',
    lanAccent: '#8a1c1c',
    carAccent: '#8a1c1c',
    devAccent: '#8a1c1c',
  },
  pairs: STANDARD_PAIRS,
};
