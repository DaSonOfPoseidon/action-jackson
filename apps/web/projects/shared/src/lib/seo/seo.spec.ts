import { DOCUMENT } from '@angular/core';
import { Router, type Routes, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { SITE_KEY } from '../sites/site-key';
import { canonicalPath, canonicalUrl } from './canonical';
import { TrailingSlashUrlSerializer, provideSeo } from './seo';

@Component({ selector: 'aj-test-page', template: '' })
class TestPage {}

const routes: Routes = [
  { path: '', component: TestPage, title: 'Home', data: { description: 'The home page.' } },
  { path: 'about', component: TestPage, title: 'About' },
  { path: 'missing', component: TestPage, title: 'Page not found', data: { notFound: true } },
  { path: 'untitled', component: TestPage },
];

async function setup(site: 'lan' | 'main' = 'lan') {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideSeo(), { provide: SITE_KEY, useValue: site }],
  });
  const router = TestBed.inject(Router);
  const doc = TestBed.inject(DOCUMENT);
  const meta = (selector: string) => doc.head.querySelectorAll(selector);
  const content = (selector: string) => doc.head.querySelector(selector)?.getAttribute('content');
  return { router, doc, meta, content };
}

describe('canonicalPath', () => {
  it('keeps the root as /', () => {
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('')).toBe('/');
    expect(canonicalPath('/?x=1')).toBe('/');
    expect(canonicalPath('/#top')).toBe('/');
  });

  it('drops a trailing slash, the query and the fragment', () => {
    expect(canonicalPath('/about/')).toBe('/about');
    expect(canonicalPath('/about?x=1')).toBe('/about');
    expect(canonicalPath('/about/?x=1#y')).toBe('/about');
    expect(canonicalPath('/a/b//')).toBe('/a/b');
  });

  it('builds the absolute production url', () => {
    expect(canonicalUrl('lan', '/about/?x=1')).toBe('https://lan.actionjacksoninstalls.com/about');
    expect(canonicalUrl('main', '/')).toBe('https://actionjacksoninstalls.com/');
  });
});

describe('TrailingSlashUrlSerializer', () => {
  const parse = (url: string) => new TrailingSlashUrlSerializer().parse(url).toString();

  it('drops a trailing slash before the end, the query or the fragment', () => {
    expect(parse('/about/')).toBe('/about');
    expect(parse('/a/b//?x=1#f')).toBe('/a/b?x=1#f');
  });

  it('leaves the root and ordinary urls alone', () => {
    expect(parse('/')).toBe('/');
    expect(parse('/?x=1')).toBe('/?x=1');
    expect(parse('/a/b')).toBe('/a/b');
  });
});

describe('SEO helpers', () => {
  afterEach(() => {
    document.head.querySelectorAll('link[rel="canonical"], meta[property^="og:"], meta[name="description"], meta[name="robots"]').forEach((e) => e.remove());
  });

  it('sets the canonical link, with no trailing slash and no query', async () => {
    const { router, meta } = await setup();
    await router.navigateByUrl('/about/?x=1');
    const links = meta('link[rel="canonical"]');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://lan.actionjacksoninstalls.com/about');
  });

  it('makes the root canonical https://<host>/', async () => {
    const { router, meta } = await setup('main');
    await router.navigateByUrl('/');
    expect(meta('link[rel="canonical"]')[0].getAttribute('href')).toBe('https://actionjacksoninstalls.com/');
  });

  it('sets the Open Graph tags, with og:url equal to the canonical and no image', async () => {
    const { router, content, doc } = await setup();
    await router.navigateByUrl('/about');
    expect(content('meta[property="og:url"]')).toBe('https://lan.actionjacksoninstalls.com/about');
    expect(content('meta[property="og:title"]')).toBe('About · Action Jackson Home Networking');
    expect(content('meta[property="og:type"]')).toBe('website');
    expect(content('meta[property="og:site_name"]')).toBe('Action Jackson Home Networking');
    expect(content('meta[property="og:description"]')).toContain('Home networking');
    expect(doc.head.querySelector('meta[property="og:image"]')).toBeNull();
  });

  it('sets the title as "<page> · Action Jackson <site name>"', async () => {
    const { router, doc } = await setup();
    await router.navigateByUrl('/about');
    expect(doc.title).toBe('About · Action Jackson Home Networking');
    await router.navigateByUrl('/');
    expect(doc.title).toBe('Home · Action Jackson Home Networking');
  });

  it('falls back to the site title for a route with no title', async () => {
    const { router, doc } = await setup('main');
    await router.navigateByUrl('/untitled');
    expect(doc.title).toBe('Action Jackson');
  });

  it('uses the route description, then the site default', async () => {
    const { router, content } = await setup();
    await router.navigateByUrl('/');
    expect(content('meta[name="description"]')).toBe('The home page.');
    expect(content('meta[property="og:description"]')).toBe('The home page.');
    await router.navigateByUrl('/about');
    expect(content('meta[name="description"]')).toContain('Home networking installs');
  });

  it('updates the tags on every navigation instead of adding more', async () => {
    const { router, meta } = await setup();
    await router.navigateByUrl('/');
    await router.navigateByUrl('/about');
    expect(meta('link[rel="canonical"]').length).toBe(1);
    expect(meta('meta[property="og:url"]').length).toBe(1);
    expect(meta('meta[name="description"]').length).toBe(1);
  });

  it('gives a not-found page no canonical and no og:url, and marks it noindex', async () => {
    const { router, meta, content } = await setup();
    await router.navigateByUrl('/about');
    await router.navigateByUrl('/missing');
    expect(meta('link[rel="canonical"]').length).toBe(0);
    expect(meta('meta[property="og:url"]').length).toBe(0);
    expect(content('meta[name="robots"]')).toBe('noindex');
    await router.navigateByUrl('/about');
    expect(meta('meta[name="robots"]').length).toBe(0);
    expect(meta('link[rel="canonical"]').length).toBe(1);
  });
});
