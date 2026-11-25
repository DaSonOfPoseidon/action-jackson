import { DOCUMENT } from '@angular/common';
import { type EnvironmentProviders, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { SITE_KEY } from '../sites/site-key';
import { tokensFor } from './site-tokens';
import { tokensToCss } from './tokens';

export const THEME_STYLE_ID = 'aj-tokens';

// Writes the site's tokens as one <style id="aj-tokens"> :root rule in <head>. It runs while the page is prerendered,
// so the variables are in the HTML; in the browser the element is already there, and is left alone. The CSP allows
// inline styles (style-src 'unsafe-inline'), and no script depends on it.
export function applyTheme(doc: Document, css: string): void {
  if (doc.getElementById(THEME_STYLE_ID)) {
    return;
  }
  const style = doc.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}

export function provideTheme(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => applyTheme(inject(DOCUMENT), tokensToCss(tokensFor(inject(SITE_KEY))))),
  ]);
}
