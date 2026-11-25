import { STANDARD_PAIRS, type SiteTokens } from './tokens';

// The main site's palette: a pale cool-grey page with a deep petrol blue (link, accent) and a dark slate "panel" that
// holds the hub's name and site cards, like the faceplate of a patch panel. Every pair is checked by tokens.spec.ts.
export const MAIN_TOKENS: SiteTokens = {
  key: 'main',
  colors: {
    bg: '#eef1f4',
    surface: '#ffffff',
    text: '#0f1c26',
    textMuted: '#394a58',
    link: '#0b4f6c',
    accent: '#0b4f6c',
    onAccent: '#ffffff',
    focus: '#1d4ed8',
    bannerBg: '#fff3bf',
    bannerText: '#3b2f00',
    panel: '#14283a',
    onPanel: '#eef1f4',
  },
  pairs: STANDARD_PAIRS,
};
