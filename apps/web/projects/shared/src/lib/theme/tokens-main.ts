import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// The main site's palette, taken from the original site: near-black page, slightly lighter surface for the hub's
// buttons, green as the brand colour, and each site's own accent for its icon. Every pair is checked by tokens.spec.ts.
export const MAIN_TOKENS: SiteTokens = {
  key: 'main',
  colors: {
    bg: '#0a0a0f',
    surface: '#12121c',
    text: '#f0f0f5',
    textMuted: '#a3a3b8',
    link: '#22c55e',
    accent: '#22c55e',
    onAccent: '#0a0a0f',
    focus: '#d8b4fe',
    bannerBg: '#fff3bf',
    bannerText: '#3b2f00',
    lanAccent: '#22c55e',
    carAccent: '#fb923c',
    devAccent: '#d8b4fe',
  },
  pairs: STANDARD_PAIRS,
};
