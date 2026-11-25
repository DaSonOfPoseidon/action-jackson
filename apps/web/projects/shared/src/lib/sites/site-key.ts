import { InjectionToken, inject } from '@angular/core';
import { type Site, type SiteKey, siteByKey } from './site-registry';

// Each app sets its own key in its app.config (provideSite). Everything in the shared library that depends on "which
// site am I" reads it from here.
export const SITE_KEY = new InjectionToken<SiteKey>('aj.siteKey');

export function injectSite(): Site {
  return siteByKey(inject(SITE_KEY));
}
