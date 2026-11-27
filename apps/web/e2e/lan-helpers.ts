// What the lan specs share: waiting for hydration, and axe.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { settled } from './contrast-audit';
import { expect } from './fixtures';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Waits until the page is hydrated. A click on the skip link is handled only by the bootstrapped app: it cancels the
// click and focuses <main>. (Same proof as sites.spec.ts.)
export async function hydrated(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          const link = document.querySelector<HTMLAnchorElement>('a.skip-link');
          const notCancelled = link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          return { cancelled: notCancelled === false, focused: document.activeElement?.id };
        }),
      { timeout: 15_000 },
    )
    .toEqual({ cancelled: true, focused: 'main' });
}

export async function axeViolations(page: Page): Promise<string[]> {
  await settled(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
