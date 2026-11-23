import { provideHttpClient, withFetch } from '@angular/common/http';
import { type EnvironmentProviders, makeEnvironmentProviders, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideSeo } from './seo/seo';
import { SITE_KEY } from './sites/site-key';
import type { SiteKey } from './sites/site-registry';
import { provideTheme } from './theme/theme';

// What every app's app.config needs from the shared library, in one call: the app's own key, the site's theme tokens,
// fetch-based HttpClient (for the API client), and global error listeners. Change detection is zoneless (Angular
// 22's default: no zone.js is installed).
//
// A public app is prerendered, so it also gets hydration (with event replay: a click before hydration is replayed
// afterwards; incremental hydration is on by default in Angular 22) and the per-route SEO tags. The admin app is
// client-rendered, so it gets neither: it sets its own title and is marked noindex in its index.html.
export function provideSite(key: SiteKey): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SITE_KEY, useValue: key },
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideTheme(),
    ...(key === 'admin' ? [] : [provideClientHydration(withEventReplay()), provideSeo()]),
  ]);
}
