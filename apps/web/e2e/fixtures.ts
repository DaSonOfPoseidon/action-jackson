// Every spec of a page uses this `test`: it records what the browser reports while the page runs, so a spec can
// fail on a Content-Security-Policy violation or a console error, whatever else it checks.
import { test as base, expect, type Page } from '@playwright/test';

interface Watch {
  // Every securitypolicyviolation event (the meta policy and the edge's header both raise it), and every console
  // error or uncaught page error, as short strings.
  // `knownNotFound` are URLs that are meant to answer 404 (the not-found spec's own page): the browser logs a console
  // error for such a response, and that one is not a problem.
  problems(knownNotFound?: string[]): Promise<string[]>;
}

declare global {
  interface Window {
    __ajViolations?: string[];
  }
}

async function watch(page: Page): Promise<Watch> {
  const reported: { text: string; url?: string }[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      reported.push({ text: `console: ${message.text()}`, url: message.location().url });
    }
  });
  page.on('pageerror', (error) => reported.push({ text: `pageerror: ${error.message}` }));
  await page.addInitScript(() => {
    window.__ajViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__ajViolations?.push(`csp: ${event.violatedDirective} blocked ${event.blockedURI} (${event.sample})`);
    });
  });
  return {
    problems: async (knownNotFound = []) => [
      ...(await page.evaluate(() => window.__ajViolations ?? [])),
      ...reported.filter((entry) => !(entry.url && knownNotFound.includes(entry.url))).map((entry) => entry.text),
    ],
  };
}

export const test = base.extend<{ watched: Watch }>({
  watched: async ({ page }, use) => {
    await use(await watch(page));
  },
});

export { expect };
