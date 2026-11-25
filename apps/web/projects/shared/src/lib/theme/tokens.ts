import type { SiteKey } from '../sites/site-registry';
import { type ContrastPair } from './contrast';

// Theme tokens. The source of truth is one TypeScript module per site (tokens-<key>.ts): named colours and an explicit
// list of the text/background pairs the CSS may use. The same module drives the CSS (tokensToCss, which the app applies
// as :root variables) and the contrast test, so the two cannot drift. The palettes are placeholders until each site's
// design unit.

export const TOKEN_NAMES = [
  'bg',
  'surface',
  'text',
  'textMuted',
  'link',
  'accent',
  'onAccent',
  'focus',
  'bannerBg',
  'bannerText',
  'lanAccent',
  'carAccent',
  'devAccent',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

export interface TokenPair {
  readonly text: TokenName;
  readonly background: TokenName;
  // Large text needs 4.5:1; everything else 7:1 (WCAG AAA).
  readonly large?: boolean;
}

export interface SiteTokens {
  readonly key: SiteKey;
  readonly colors: Readonly<Record<TokenName, string>>;
  readonly pairs: readonly TokenPair[];
}

// The pairings the shell's CSS uses. lanAccent, carAccent and devAccent are the colours of the sites' icons on a
// surface (the main site's hub); the other sites set them to their link colour. The focus ring is not text, but it is held to the large-text bar so it stays
// visible on both surfaces.
export const STANDARD_PAIRS: readonly TokenPair[] = [
  { text: 'text', background: 'bg' },
  { text: 'text', background: 'surface' },
  { text: 'textMuted', background: 'bg' },
  { text: 'textMuted', background: 'surface' },
  { text: 'link', background: 'bg' },
  { text: 'link', background: 'surface' },
  { text: 'onAccent', background: 'accent' },
  { text: 'bannerText', background: 'bannerBg' },
  { text: 'lanAccent', background: 'surface' },
  { text: 'carAccent', background: 'surface' },
  { text: 'devAccent', background: 'surface' },
  { text: 'focus', background: 'bg', large: true },
  { text: 'focus', background: 'surface', large: true },
];

// "textMuted" is --aj-text-muted in CSS.
export function cssVariable(name: TokenName): string {
  return '--aj-' + name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

// One :root rule with every colour. Applied once per page (see ThemeService).
export function tokensToCss(tokens: SiteTokens): string {
  const lines = TOKEN_NAMES.map((name) => `${cssVariable(name)}:${tokens.colors[name]};`);
  return `:root{${lines.join('')}}`;
}

// The declared pairs as colours, for the contrast test.
export function resolvePairs(tokens: SiteTokens): (ContrastPair & { readonly label: string })[] {
  return tokens.pairs.map((pair) => ({
    label: `${tokens.key}: ${pair.text} on ${pair.background}`,
    text: tokens.colors[pair.text],
    background: tokens.colors[pair.background],
    large: pair.large,
  }));
}
