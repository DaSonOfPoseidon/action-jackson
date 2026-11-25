import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SITE_META, SOCIALS, publicSites, productionHost, siteUrl, type SiteKey } from '@aj/shared';

// The words of each card. They live here, not in SITE_META: the label (the heading) is the site's own name for itself,
// and this line is only the hub's way of introducing it. It promises nothing the legacy site did not.
const BLURBS: Readonly<Partial<Record<SiteKey, string>>> = {
  lan: 'Network design and installation: Wi-Fi, cabling and cameras.',
  car: 'Car audio and remote-start installs.',
  dev: 'Projects, skills and resume.',
};

// The landing page of the main site: who Action Jackson is, a card for each of the other public sites, and the
// socials. Static: it makes no API call (invariant 6). A card is one link (the heading's) stretched over the whole
// card, so there is one tab stop and one link name per site and no nested interactive element.
@Component({
  selector: 'aj-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './hub.css',
  template: `
    <div class="faceplate">
      <div class="intro">
        <h1>{{ name }}</h1>
        <p class="lede">Home networking and car audio installs, and the developer behind them.</p>
      </div>
      <ul class="ports" aria-label="Sites">
        @for (card of cards; track card.key) {
          <li class="port">
            <div class="top">
              <p class="host">{{ card.host }}</p>
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                @switch (card.key) {
                  @case ('lan') {
                    <path d="M5 4h14v10h-3v4H8v-4H5z" />
                    <path d="M9 8v3M12 8v3M15 8v3" />
                  }
                  @case ('car') {
                    <path d="M4 9v6h4l5 4V5L8 9z" />
                    <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
                  }
                  @default {
                    <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
                  }
                }
              </svg>
            </div>
            <h2><a [href]="card.href">{{ card.label }}</a></h2>
            <p class="blurb">{{ card.blurb }}</p>
          </li>
        }
      </ul>
    </div>
    <nav class="socials" aria-label="Find Jackson online">
      <ul>
        @for (social of socials; track social.key) {
          <li>
            <a [href]="social.href">
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                @switch (social.key) {
                  @case ('github') {
                    <path fill="currentColor" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                  }
                  @case ('linkedin') {
                    <path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  }
                  @default {
                    <g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3.5 7l8.5 6 8.5-6" />
                    </g>
                  }
                }
              </svg>
              {{ social.label }}
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
})
export class Hub {
  protected readonly name = SITE_META['main'].name;
  protected readonly socials = SOCIALS;
  // The three other public sites, in the registry's order (main is this page, admin is never public).
  protected readonly cards = publicSites()
    .filter((site) => BLURBS[site.key] !== undefined)
    .map((site) => ({
      key: site.key,
      label: SITE_META[site.key].label,
      blurb: BLURBS[site.key],
      host: productionHost(site),
      href: siteUrl(site),
    }));
}
