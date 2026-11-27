import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SERVICE_LINKS } from '../data/service-links';

// The footer of every page, ported from components/layout/Footer.tsx: the wordmark and tagline, the services, the
// quick links and the copyright. The two link groups are labelled navigation landmarks.
@Component({
  selector: 'aj-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-grid">
          <div>
            <p class="footer-brand">Action Jackson<span class="tint"> Installs</span></p>
            <p class="footer-tagline">Engineered home networking &amp; smart infrastructure.</p>
            <p class="footer-place">Columbia, MO &middot; Precision infrastructure</p>
          </div>

          <nav aria-labelledby="footer-services">
            <p id="footer-services" class="footer-title">Services</p>
            <ul class="footer-links">
              @for (service of services; track service.id) {
                <li>
                  <a [routerLink]="service.path">{{ service.navLabel }}</a>
                </li>
              }
            </ul>
          </nav>

          <nav aria-labelledby="footer-links">
            <p id="footer-links" class="footer-title">Quick Links</p>
            <ul class="footer-links">
              <li><a routerLink="/get-started">Schedule Consultation</a></li>
              <li><a routerLink="/about">About</a></li>
            </ul>
          </nav>
        </div>

        <p class="copyright">&copy; {{ year }} Action Jackson Installs. All rights reserved.</p>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  protected readonly services = SERVICE_LINKS;
  protected readonly year = new Date().getFullYear();
}
