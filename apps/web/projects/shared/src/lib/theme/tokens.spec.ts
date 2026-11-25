import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, meetsAaa } from './contrast';
import { ALL_SITE_TOKENS } from './site-tokens';
import { TOKEN_NAMES, type SiteTokens, type TokenName, type TokenPair, cssVariable, resolvePairs, tokensToCss } from './tokens';

describe('theme tokens', () => {
  it('has one token module per site, admin included', () => {
    expect(ALL_SITE_TOKENS.map((t) => t.key).sort()).toEqual(['admin', 'car', 'dev', 'lan', 'main']);
  });

  for (const tokens of ALL_SITE_TOKENS) {
    describe(tokens.key, () => {
      it('defines every colour as a hex value', () => {
        for (const name of TOKEN_NAMES) {
          expect(tokens.colors[name], name).toMatch(/^#[0-9a-f]{6}$/i);
        }
      });

      it('meets AAA (7:1, or 4.5:1 when large) for every declared pair', () => {
        for (const pair of resolvePairs(tokens)) {
          expect(meetsAaa(pair), `${pair.label} is ${contrastRatio(pair.text, pair.background).toFixed(2)}:1`).toBe(true);
        }
      });

      it('declares a pair for every colour, so none is unchecked', () => {
        for (const name of TOKEN_NAMES) {
          expect(
            tokens.pairs.some((p) => p.text === name || p.background === name),
            `${name} is in no pair`,
          ).toBe(true);
        }
      });

      it('emits one :root rule with every variable', () => {
        const css = tokensToCss(tokens);
        expect(css.startsWith(':root{')).toBe(true);
        for (const name of TOKEN_NAMES) {
          expect(css).toContain(`${cssVariable(name)}:${tokens.colors[name]};`);
        }
      });
    });
  }

  it('catches a bad pair: the check is not vacuous', () => {
    const [good] = ALL_SITE_TOKENS;
    const bad: SiteTokens = { ...good, colors: { ...good.colors, text: '#777777' } };
    expect(resolvePairs(bad).some((pair) => !meetsAaa(pair))).toBe(true);
  });

  it('names the css variable of a camel-case token in kebab case', () => {
    expect(cssVariable('textMuted')).toBe('--aj-text-muted');
    expect(cssVariable('bg')).toBe('--aj-bg');
  });
});

// Every colour token used as a CSS `color` or `background` must have its pairing declared. This reads the real
// stylesheets (global and component), rule by rule.
interface Usage {
  readonly selector: string;
  readonly text: TokenName[];
  readonly background: TokenName[];
}

function camel(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function collectUsages(css: string): { usages: Usage[]; unknown: string[] } {
  const usages: Usage[] = [];
  const unknown: string[] = [];
  const names = new Set<string>(TOKEN_NAMES);
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const text: TokenName[] = [];
    const background: TokenName[] = [];
    for (const decl of rule[2].split(';')) {
      const m = /^\s*([a-z-]+)\s*:\s*(.*)$/s.exec(decl);
      if (!m) {
        continue;
      }
      for (const v of m[2].matchAll(/var\(--aj-([a-z-]+)\)/g)) {
        const token = camel(v[1]);
        if (!names.has(token)) {
          unknown.push(`${rule[1].trim()}: --aj-${v[1]}`);
        } else if (m[1] === 'color') {
          text.push(token as TokenName);
        } else if (m[1] === 'background' || m[1] === 'background-color') {
          background.push(token as TokenName);
        }
      }
    }
    if (text.length || background.length) {
      usages.push({ selector: rule[1].trim(), text, background });
    }
  }
  return { usages, unknown };
}

// The problems in a stylesheet: a text/background pair a rule uses together that is not declared, a text colour with
// no declared background at all, a background with no declared text, or an unknown --aj-* name.
function undeclared(css: string, pairs: readonly TokenPair[]): string[] {
  const problems: string[] = [];
  const { usages, unknown } = collectUsages(css);
  problems.push(...unknown.map((u) => `unknown token ${u}`));
  for (const usage of usages) {
    for (const t of usage.text) {
      for (const b of usage.background) {
        if (!pairs.some((p) => p.text === t && p.background === b)) {
          problems.push(`${usage.selector}: ${t} on ${b} is not declared`);
        }
      }
      if (usage.background.length === 0 && !pairs.some((p) => p.text === t)) {
        problems.push(`${usage.selector}: text colour ${t} is in no declared pair`);
      }
    }
    for (const b of usage.background) {
      if (usage.text.length === 0 && !pairs.some((p) => p.background === b)) {
        problems.push(`${usage.selector}: background ${b} is in no declared pair`);
      }
    }
  }
  return problems;
}

function stylesheets(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.css'))
    .map((e) => join(e.parentPath, e.name));
}

describe('token usage in css', () => {
  const pairs = ALL_SITE_TOKENS[0].pairs;

  it('flags a pair the CSS uses but nobody declared', () => {
    expect(undeclared('.x { color: var(--aj-text-muted); }', pairs)).toEqual([]);
    expect(undeclared('.x { color: var(--aj-text-muted); background: var(--aj-accent); }', pairs)).toEqual([
      '.x: textMuted on accent is not declared',
    ]);
    expect(undeclared('.x { color: var(--aj-bogus); }', pairs)).toEqual(['unknown token .x: --aj-bogus']);
  });

  it('flags a lone text or background colour that is in no pair', () => {
    const only: TokenPair[] = [{ text: 'text', background: 'bg' }];
    expect(undeclared('a { color: var(--aj-link); }', only)).toEqual(['a: text colour link is in no declared pair']);
    expect(undeclared('a { background: var(--aj-surface); }', only)).toEqual(['a: background surface is in no declared pair']);
  });

  it('accepts every stylesheet under projects/', () => {
    const files = stylesheets('projects');
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const css = readFileSync(file, 'utf8');
      for (const tokens of ALL_SITE_TOKENS) {
        expect(undeclared(css, tokens.pairs), `${file} (${tokens.key})`).toEqual([]);
      }
    }
  });
});
