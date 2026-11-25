// WCAG 2.x contrast: the relative-luminance formula and the AAA thresholds (invariant 7).

export interface ContrastPair {
  readonly text: string;
  readonly background: string;
  // Large text (18pt, or 14pt bold) needs 4.5:1 instead of 7:1.
  readonly large?: boolean;
}

const AAA_NORMAL = 7;
const AAA_LARGE = 4.5;

// '#rgb' or '#rrggbb' to [r, g, b] in 0..255. Anything else is a bug in a token module, so it throws.
function parseHex(colour: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour);
  if (!match) {
    throw new Error(`"${colour}" is not a hex colour (#rgb or #rrggbb)`);
  }
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(colour: string): number {
  const [r, g, b] = parseHex(colour).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The ratio is symmetric: it is always lighter over darker, from 1 to 21.
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function meetsRatio(ratio: number, large: boolean): boolean {
  return ratio >= (large ? AAA_LARGE : AAA_NORMAL);
}

export function meetsAaa(pair: ContrastPair): boolean {
  return meetsRatio(contrastRatio(pair.text, pair.background), pair.large ?? false);
}
