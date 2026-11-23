import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// Placeholder palette for the main site until its design unit (11). Every pair is checked by tokens.spec.ts.
export const MAIN_TOKENS: SiteTokens = {
  key: 'main',
  colors: {
    bg: '#ffffff',
    surface: '#f2f4f7',
    text: '#101828',
    textMuted: '#344054',
    link: '#1b3a6b',
    accent: '#1b3a6b',
    onAccent: '#ffffff',
    focus: '#1d4ed8',
    bannerBg: '#fff3bf',
    bannerText: '#3b2f00',
  },
  pairs: STANDARD_PAIRS,
};
