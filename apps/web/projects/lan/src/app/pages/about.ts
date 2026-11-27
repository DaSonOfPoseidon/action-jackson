import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DIFFERENTIATORS, EXPERTISE } from '../data/about';
import { CtaBand } from '../ui/cta-band';
import { Hero } from '../ui/hero';
import { Icon } from '../ui/icon';

// The about page, ported from frontend/app/(business)/about/page.tsx: hero, the four areas of expertise, what sets the
// work apart (a numbered list), where the business is, and the call to action.
@Component({
  selector: 'aj-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CtaBand, Hero, Icon],
  template: `
    <aj-hero
      title="Home Network Performance Specialist."
      subtitle="Engineering reliable, secure infrastructure for modern homes in Columbia, MO."
      [primary]="{ label: 'Schedule Consultation', path: '/get-started' }"
    />

    <section class="section">
      <div class="wrap">
        <p class="eyebrow">Expertise</p>
        <h2 class="section-title">Core Expertise</h2>
        <p class="lede">Focused skill set, applied consistently across every project.</p>
        <ul class="expertise-grid" role="list">
          @for (item of expertise; track item.title) {
            <li class="card card-hover gradient-border expertise">
              <div class="card-bar" aria-hidden="true"></div>
              <span class="icon-box lg green"><aj-icon [name]="item.icon" /></span>
              <div>
                <h3 class="card-title lg">{{ item.title }}</h3>
                <p class="card-text relaxed">{{ item.description }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap w-4xl">
        <p class="eyebrow">What Sets Us Apart</p>
        <h2 class="section-title">The Action Jackson Difference</h2>
        <p class="lede">
          This isn't just cable drops and router reboots. Every install is an engineered solution — designed for the home it lives in,
          documented for the people who use it.
        </p>
        <ol class="numbered" role="list">
          @for (item of differentiators; track item.title) {
            <li>
              <div>
                <h3 class="green">{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
            </li>
          }
        </ol>
        <p class="place">
          <aj-icon name="pin" />
          <span>Based in <strong>Columbia, MO</strong> &middot; Serving mid-Missouri</span>
        </p>
      </div>
    </section>

    <aj-cta-band headline="Let's talk about your home network." subtext="Schedule a consultation to talk through your home network." />
  `,
})
export class About {
  protected readonly expertise = EXPERTISE;
  protected readonly differentiators = DIFFERENTIATORS;
}
