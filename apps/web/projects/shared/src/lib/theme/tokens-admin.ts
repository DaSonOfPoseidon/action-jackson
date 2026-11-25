import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// Placeholder palette for the admin app until its design unit (20). Every pair is checked by tokens.spec.ts.
export const ADMIN_TOKENS: SiteTokens = {
  key: 'admin',
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
    panel: '#101828',
    onPanel: '#ffffff',
  },
  pairs: STANDARD_PAIRS,
};
