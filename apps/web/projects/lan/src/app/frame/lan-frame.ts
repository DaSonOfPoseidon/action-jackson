import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OfflineBanner, SiteSwitcher, SkipLink } from '@aj/shared';
import { SiteFooter } from './site-footer';
import { SiteNav } from './site-nav';

// The lan site's page frame. The shared SiteFrame has a plain header and footer; lan needs the original site's, so this
// frame is built from the same shared pieces (the skip link, the cross-site switcher, the offline banner) around its
// own header bar and footer. <main id="main"> is where the router's page goes.
//
// The <header> is only a landmark (display: contents): the switcher strip scrolls away, and the bar below it stays at
// the top of the page.
@Component({
  selector: 'aj-lan-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OfflineBanner, SiteFooter, SiteNav, SiteSwitcher, SkipLink],
  host: { class: 'lan-frame' },
  template: `
    <aj-skip-link />
    <header class="site-header">
      <div class="switcher-strip">
        <aj-site-switcher />
      </div>
      <aj-site-nav />
    </header>
    <aj-offline-banner />
    <main id="main" tabindex="-1">
      <ng-content />
    </main>
    <aj-site-footer />
  `,
})
export class LanFrame {}
