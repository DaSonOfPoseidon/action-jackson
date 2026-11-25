import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SITE_KEY } from '../sites/site-key';
import { SITE_META } from '../sites/site-meta';
import { productionHost, publicSites } from '../sites/site-registry';

// The cross-site navigation: the public sites (main, lan, car, dev; never admin) as absolute links to their
// production hosts. The site you are on is plain text marked aria-current="page", not a link. The links are absolute
// because each site is its own origin.
@Component({
  selector: 'aj-site-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './site-switcher.css',
  template: `
    <nav aria-label="Action Jackson sites">
      <ul>
        @for (site of sites; track site.key) {
          <li>
            @if (site.key === current) {
              <span class="current" aria-current="page">{{ site.label }}</span>
            } @else {
              <a [href]="site.href">{{ site.label }}</a>
            }
          </li>
        }
      </ul>
    </nav>
  `,
})
export class SiteSwitcher {
  protected readonly current = inject(SITE_KEY);
  protected readonly sites = publicSites().map((site) => ({
    key: site.key,
    label: SITE_META[site.key].label,
    href: `https://${productionHost(site)}/`,
  }));
}
