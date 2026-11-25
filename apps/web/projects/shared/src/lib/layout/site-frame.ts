import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SITE_KEY } from '../sites/site-key';
import { SITE_META } from '../sites/site-meta';
import { OfflineBanner } from './offline-banner';
import { SiteSwitcher } from './site-switcher';
import { SkipLink } from './skip-link';

// The minimal page frame the sites without their own use: a skip link, a header with the cross-site switcher, the
// offline banner, <main id="main"> and a footer. Nothing more: a site that wants its own header and footer (lan) builds
// its frame from the same pieces (SkipLink, SiteSwitcher, OfflineBanner).
@Component({
  selector: 'aj-site-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OfflineBanner, SiteSwitcher, SkipLink],
  styleUrl: './site-frame.css',
  template: `
    <aj-skip-link />
    <header>
      <aj-site-switcher />
    </header>
    <aj-offline-banner />
    <main id="main" tabindex="-1">
      <ng-content />
    </main>
    <footer>
      <p>&copy; {{ year }} {{ name }}</p>
    </footer>
  `,
})
export class SiteFrame {
  protected readonly name = SITE_META[inject(SITE_KEY)].name;
  protected readonly year = new Date().getFullYear();
}
