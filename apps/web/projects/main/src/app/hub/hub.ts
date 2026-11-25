import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OfflineBanner, siteByKey, siteUrl, type SiteKey } from '@aj/shared';

// The buttons, in order. The words are the hub's own (it is asking a question), not the sites' names for themselves.
const CHOICES: readonly { readonly key: Extract<SiteKey, 'lan' | 'car' | 'dev'>; readonly label: string }[] = [
  { key: 'lan', label: 'Home networking' },
  { key: 'car', label: 'Car audio and remote start' },
  { key: 'dev', label: 'Developer portfolio' },
];

// The landing page of the main site: one question and a big button for each other public site. It is its own whole
// screen (no page frame, see app.routes.ts), and static: it makes no API call (invariant 6). The offline banner is
// kept, positioned over the top edge, because it is empty until the API is down and must not shift the centred content.
@Component({
  selector: 'aj-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OfflineBanner],
  styleUrl: './hub.css',
  template: `
    <main id="main">
      <aj-offline-banner />
      <h1>What are you looking for?</h1>
      <ul>
        @for (choice of choices; track choice.key) {
          <li>
            <a [class]="choice.key" [href]="choice.href">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                @switch (choice.key) {
                  @case ('lan') {
                    <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0" />
                    <circle cx="12" cy="19.5" r="1" />
                  }
                  @case ('car') {
                    <rect x="4" y="2.5" width="16" height="19" rx="2" />
                    <circle cx="12" cy="14" r="4" />
                    <circle cx="12" cy="14" r="1" />
                    <circle cx="12" cy="6.5" r="1" />
                  }
                  @default {
                    <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />
                  }
                }
              </svg>
              {{ choice.label }}
            </a>
          </li>
        }
      </ul>
    </main>
  `,
})
export class Hub {
  // Each button links to the site's production URL (the registry's, never a hand-written one).
  protected readonly choices = CHOICES.map((choice) => ({ ...choice, href: siteUrl(siteByKey(choice.key)) }));
}
