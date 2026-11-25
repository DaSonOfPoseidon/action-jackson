// What the edge does around the sites, checked against the real edge: redirects, the admin SPA and the API proxy.
// These use Playwright's `request` (no browser) with a Host header, and never follow a redirect.
import type { APIRequestContext } from '@playwright/test';
import { edgeOrigin, pageUrl } from './sites';
import { expect, test } from './fixtures';

const get = (request: APIRequestContext, host: string, path = '/') =>
  request.get(edgeOrigin() + path, { headers: { Host: host }, maxRedirects: 0 });

test('www.localhost/ is a 301 to the apex', async ({ request }) => {
  const response = await get(request, 'www.localhost');
  expect(response.status()).toBe(301);
  expect(response.headers()['location']).toBe('https://localhost/');
});

test('localhost/get-started?a=1 is a 301 to the lan site with the path and the query kept', async ({ request }) => {
  const response = await get(request, 'localhost', '/get-started?a=1');
  expect(response.status()).toBe(301);
  expect(response.headers()['location']).toBe('https://lan.localhost/get-started?a=1');
});

test('a redirect carries the edge CSP header too', async ({ request }) => {
  const response = await get(request, 'www.localhost');
  expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});

test('the admin app: / is 200 and noindex, any other path falls back to it, and it runs clean', async ({ page, request, watched }) => {
  const home = await get(request, 'admin.localhost');
  expect(home.status()).toBe(200);
  expect(await home.text()).toContain('<meta name="robots" content="noindex, nofollow">');

  const deep = await get(request, 'admin.localhost', '/anything/else');
  expect(deep.status()).toBe(200);
  expect(await deep.text()).toContain('<aj-root>');

  await page.goto(pageUrl('admin.localhost', '/anything'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin');
  await expect(page.getByText('Sign-in arrives in a later unit.')).toBeVisible();
  expect(await watched.problems()).toEqual([]);
});

test('the admin app has a Disallow robots.txt and no sitemap', async ({ request }) => {
  const robots = await get(request, 'admin.localhost', '/robots.txt');
  expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
  // A file that is not there is not the SPA's page either: an extension means "a file", so it is a 404.
  expect((await get(request, 'admin.localhost', '/sitemap.xml')).status()).toBe(404);
});

test('/api/lan/quotes/pricing answers 503 problem+json with Retry-After, because the API is down', async ({ request }) => {
  const response = await get(request, 'lan.localhost', '/api/lan/quotes/pricing');
  expect(response.status()).toBe(503);
  expect(response.headers()['content-type']).toContain('application/problem+json');
  expect(response.headers()['retry-after']).toBe('30');
  expect((await response.json()).status).toBe(503);
});
