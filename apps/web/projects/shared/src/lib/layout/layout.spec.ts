import { provideHttpClient, withFetch } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SITE_KEY } from '../sites/site-key';
import type { SiteKey } from '../sites/site-registry';
import { SiteFrame } from './site-frame';
import { SiteSwitcher } from './site-switcher';

@Component({ imports: [SiteFrame], template: '<aj-site-frame><p id="content">Hello</p></aj-site-frame>' })
class Host {}

async function render<T>(component: new () => T, site: SiteKey) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(withFetch()), { provide: SITE_KEY, useValue: site }],
  });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const links = (root: HTMLElement) =>
  [...root.querySelectorAll('a')].map((a) => [a.textContent!.trim(), a.getAttribute('href')]);

describe('SiteSwitcher', () => {
  it('on lan lists main, car and dev as absolute production links, and lan as the current page, not a link', async () => {
    const root = await render(SiteSwitcher, 'lan');
    expect(links(root)).toEqual([
      ['Action Jackson', 'https://actionjacksoninstalls.com/'],
      ['Car Audio & Remote Start', 'https://car.actionjacksoninstalls.com/'],
      ['Developer Portfolio', 'https://dev.actionjacksoninstalls.com/'],
    ]);
    const current = root.querySelector('[aria-current="page"]')!;
    expect(current.tagName).not.toBe('A');
    expect(current.textContent!.trim()).toBe('Home Networking');
    expect(root.querySelectorAll('[aria-current]').length).toBe(1);
  });

  it('on main marks main current and links the other three', async () => {
    const root = await render(SiteSwitcher, 'main');
    expect(links(root).map(([, href]) => href)).toEqual([
      'https://lan.actionjacksoninstalls.com/',
      'https://car.actionjacksoninstalls.com/',
      'https://dev.actionjacksoninstalls.com/',
    ]);
    expect(root.querySelector('[aria-current="page"]')!.textContent!.trim()).toBe('Action Jackson');
  });

  it('never lists admin, and on admin marks nothing current', async () => {
    for (const site of ['main', 'lan', 'car', 'dev', 'admin'] as const) {
      const root = await render(SiteSwitcher, site);
      expect(root.textContent).not.toContain('Admin');
      expect(root.innerHTML).not.toContain('admin.');
      TestBed.resetTestingModule();
    }
    const root = await render(SiteSwitcher, 'admin');
    expect(root.querySelector('[aria-current]')).toBeNull();
    expect(links(root).length).toBe(4);
  });

  it('is a labelled navigation landmark', async () => {
    const root = await render(SiteSwitcher, 'car');
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Action Jackson sites');
  });
});

describe('SiteFrame', () => {
  it('has a skip link, a header with the switcher, main#main, and a footer with the year and the site name', async () => {
    const root = await render(Host, 'car');
    const skip = root.querySelector('a.skip-link')!;
    expect(skip.textContent!.trim()).toBe('Skip to main content');
    expect(skip.getAttribute('href')).toBe('#main');
    expect(root.querySelector('header nav')).not.toBeNull();
    const main = root.querySelector('main#main')!;
    expect(main.querySelector('#content')!.textContent).toBe('Hello');
    expect(root.querySelectorAll('main').length).toBe(1);
    const footer = root.querySelector('footer')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(footer).toBe(`© ${new Date().getFullYear()} Action Jackson · Car Audio & Remote Start`);
  });

  it('puts the skip link before everything else, so it is the first tab stop', async () => {
    const root = await render(Host, 'lan');
    const first = root.querySelector('a, button, input')!;
    expect(first.classList.contains('skip-link')).toBe(true);
  });

  it('includes the offline banner region', async () => {
    const root = await render(Host, 'lan');
    expect(root.querySelector('[role="status"]')).not.toBeNull();
  });
});
