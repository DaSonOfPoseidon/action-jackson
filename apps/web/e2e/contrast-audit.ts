// Checks the contrast of every piece of text against what is really drawn behind it, pixel by pixel.
//
// axe's color-contrast cannot evaluate text on a gradient, a glow or a translucent layer (it reports "incomplete", which
// the specs do not fail on), and the lan site has such backgrounds behind text (the hero mesh, the badges, the glass cards).
// So this takes the real rendering: it records each text run's colour and boxes, makes all text transparent, takes a
// screenshot, and reads the pixels under every box. The darkest and the lightest pixel behind a run are the two worst
// cases for any fixed text colour, so those two are the ones checked, at WCAG AAA (7:1, or 4.5:1 for large text).
import type { Browser, Page } from '@playwright/test';

export interface TextRun {
  readonly text: string;
  readonly color: [number, number, number, number];
  readonly large: boolean;
  readonly boxes: { x: number; y: number; width: number; height: number }[];
}

export interface Failure {
  readonly text: string;
  readonly ratio: number;
  readonly needed: number;
  readonly where: string;
  // The text colour and the background pixel it was worst against, as rgb(...) strings.
  readonly colors: string;
}

// Runs in the page: every visible text node, with the boxes it occupies in page coordinates, clipped by any ancestor that
// clips (a scrolling table, an overflow: clip section).
function collectTextRuns(): TextRun[] {
  const runs: TextRun[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const clipOf = (element: Element): DOMRect[] => {
    const clips: DOMRect[] = [];
    for (let el: Element | null = element; el && el !== document.documentElement; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (['hidden', 'auto', 'scroll', 'clip'].some((v) => style.overflowX === v || style.overflowY === v)) {
        clips.push(el.getBoundingClientRect());
      }
    }
    return clips;
  };
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const element = node.parentElement;
    if (!text || !element || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(element.tagName)) {
      continue;
    }
    const style = getComputedStyle(element);
    // Not drawn at all: display none, hidden (also inside a closed <details>, or an ancestor), or fully transparent.
    if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true }) || parseFloat(style.opacity) === 0) {
      continue;
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    const clips = clipOf(element);
    const boxes: TextRun['boxes'] = [];
    for (const rect of range.getClientRects()) {
      let left = rect.left;
      let top = rect.top;
      let right = rect.right;
      let bottom = rect.bottom;
      for (const clip of clips) {
        left = Math.max(left, clip.left);
        top = Math.max(top, clip.top);
        right = Math.min(right, clip.right);
        bottom = Math.min(bottom, clip.bottom);
      }
      // A box above or left of the page (the skip link, parked off screen until it has focus) is not on the page to read.
      if (right - left >= 2 && bottom - top >= 2 && bottom + scrollY > 0 && right + scrollX > 0) {
        boxes.push({ x: left + scrollX, y: top + scrollY, width: right - left, height: bottom - top });
      }
    }
    if (boxes.length === 0) {
      continue;
    }
    const match = /rgba?\(([^)]+)\)/.exec(style.color);
    const [r, g, b, a = 1] = (match?.[1] ?? '0,0,0').split(/[ ,/]+/).map(Number);
    const px = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight);
    // WCAG "large": 18pt (24px), or 14pt (18.66px) and bold.
    runs.push({ text: text.slice(0, 60), color: [r, g, b, a], large: px >= 24 || (px >= 18.66 && weight >= 700), boxes });
  }
  return runs;
}

// Runs in a blank page: decodes the screenshot and finds the worst contrast under each run.
async function worstContrasts({
  png,
  runs,
}: {
  png: string;
  runs: readonly TextRun[];
}): Promise<{ text: string; ratio: number; needed: number; at: { x: number; y: number }; colors: string }[]> {
  const image = new Image();
  image.src = `data:image/png;base64,${png}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);

  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (r: number, g: number, b: number): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  const out: { text: string; ratio: number; needed: number; at: { x: number; y: number }; colors: string }[] = [];
  for (const run of runs) {
    const [tr, tg, tb, ta] = run.color;
    let worst = Infinity;
    let at = { x: 0, y: 0 };
    let colors = '';
    for (const box of run.boxes) {
      const x = Math.max(0, Math.floor(box.x));
      const y = Math.max(0, Math.floor(box.y));
      const width = Math.min(image.width - x, Math.ceil(box.width));
      const height = Math.min(image.height - y, Math.ceil(box.height));
      if (width <= 0 || height <= 0) {
        continue;
      }
      const data = context.getImageData(x, y, width, height).data;
      let darkest = Infinity;
      let lightest = -Infinity;
      let darkAt = 0;
      let lightAt = 0;
      for (let i = 0; i < data.length; i += 4) {
        const l = luminance(data[i], data[i + 1], data[i + 2]);
        if (l < darkest) {
          darkest = l;
          darkAt = i;
        }
        if (l > lightest) {
          lightest = l;
          lightAt = i;
        }
      }
      for (const index of [darkAt, lightAt]) {
        const [br, bg, bb] = [data[index], data[index + 1], data[index + 2]];
        // The text colour as it looks over this pixel (a colour with alpha blends with it).
        const l = luminance(tr * ta + br * (1 - ta), tg * ta + bg * (1 - ta), tb * ta + bb * (1 - ta));
        const r = ratio(l, luminance(br, bg, bb));
        if (r < worst) {
          worst = r;
          const pixel = index / 4;
          at = { x: x + (pixel % width), y: y + Math.floor(pixel / width) };
          colors = `text rgba(${tr},${tg},${tb},${ta}) on rgb(${br},${bg},${bb})`;
        }
      }
    }
    if (worst !== Infinity) {
      out.push({ text: run.text, ratio: worst, needed: run.large ? 4.5 : 7, at, colors });
    }
  }
  return out;
}

// Waits for every finite animation and transition to end, so the colours read are the settled ones. The endless ones (a
// glow, the dashed lines of the diagram) only move a decoration and never change a text colour.
export async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

// The text runs of the page that fall short, at both ends of the endless animations (the mesh drifts, a glow pulses).
export async function contrastFailures(page: Page, browser: Browser): Promise<Failure[]> {
  const failures = new Map<string, Failure>();
  const blank = await browser.newPage();
  try {
    for (const phase of [0, 4000]) {
      await page.evaluate((time) => {
        for (const animation of document.getAnimations()) {
          if (animation.effect?.getComputedTiming().iterations === Infinity) {
            animation.pause();
            animation.currentTime = time;
          }
        }
      }, phase);
      const runs = await page.evaluate(collectTextRuns);
      const style = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; transition: none !important; }' });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const png = (await page.screenshot({ fullPage: true, animations: 'allow' })).toString('base64');
      await style.evaluate((element) => element.remove());
      // The text colours come back by transition (a link fades over 150ms): read them only when they have settled.
      await settled(page);
      const results = await blank.evaluate(worstContrasts, { png, runs });
      for (const result of results) {
        if (result.ratio < result.needed) {
          const key = `${result.text}|${Math.round(result.at.y / 50)}`;
          const previous = failures.get(key);
          if (!previous || result.ratio < previous.ratio) {
            failures.set(key, { text: result.text, ratio: Math.round(result.ratio * 100) / 100, needed: result.needed, where: `(${Math.round(result.at.x)}, ${Math.round(result.at.y)})`, colors: result.colors });
          }
        }
      }
    }
  } finally {
    await blank.close();
  }
  return [...failures.values()];
}
