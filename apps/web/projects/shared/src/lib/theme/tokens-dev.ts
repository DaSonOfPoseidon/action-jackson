import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// Placeholder palette for the dev site until its design unit (19). Every pair is checked by tokens.spec.ts.
export const DEV_TOKENS: SiteTokens = {
  key: 'dev',
  colors: {
    bg: '#ffffff',
    surface: '#f2f4f7',
    text: '#101828',
    textMuted: '#344054',
    link: '#4a2f8f',
    accent: '#4a2f8f',
    onAccent: '#ffffff',
    focus: '#1d4ed8',
    bannerBg: '#fff3bf',
    bannerText: '#3b2f00',
    panel: '#101828',
    onPanel: '#ffffff',
  },
  pairs: STANDARD_PAIRS,
};
