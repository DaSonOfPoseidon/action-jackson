import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// The lan site's palette, taken from the original site (frontend/tailwind.config.ts) with the fixes AAA needs: near-black
// page, slightly lighter surface, green as the brand colour, and purple, orange and cyan as the service accents.
// - textMuted is #a3a3b8, not the original #8888a0 (5.7:1 on the page colour).
// - surfaceRaised is #181825, a hair darker than the original #1c1c2a, which gave muted text only 6.8:1.
// - A green button gets dark text, and its gradient is #22c55e to #1eb257: the original #16a34a to #15803d gives dark
//   text 6.0:1 and 3.9:1.
// - Normal-size text uses the vivid colours (#22c55e, #d8b4fe, #fb923c, #22d3ee). The original's #16a34a, #9333ea and
//   #ea580c are for edges and glows only, which carry no text and are plain values in the CSS.
// Every pair is checked by tokens.spec.ts.
export const LAN_TOKENS: SiteTokens = {
  key: 'lan',
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
    surfaceRaised: '#181825',
    accentDeep: '#1eb257',
    accentPurple: '#d8b4fe',
    accentOrange: '#fb923c',
    accentCyan: '#22d3ee',
  },
  pairs: STANDARD_PAIRS,
};
