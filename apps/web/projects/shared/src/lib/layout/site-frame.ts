import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SITE_KEY } from '../sites/site-key';
import { SITE_META } from '../sites/site-meta';
import { OfflineBanner } from './offline-banner';
import { SiteSwitcher } from './site-switcher';

// The minimal page frame every public app uses: a skip link, a header with the cross-site switcher, the offline
// banner, <main id="main"> and a footer. Nothing more: each site's look comes in its own design unit.
@Component({
  selector: 'aj-site-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OfflineBanner, SiteSwitcher],
  styleUrl: './site-frame.css',
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to main content</a>
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

  // With <base href="/">, a bare "#main" would mean "/#main" and leave the page. Focus main in place instead.
  protected skipToMain(event: Event): void {
    event.preventDefault();
    const main = (event.currentTarget as HTMLElement).ownerDocument.getElementById('main');
    main?.focus();
    main?.scrollIntoView?.();
  }
}
