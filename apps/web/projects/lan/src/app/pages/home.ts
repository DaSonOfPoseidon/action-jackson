import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PACKAGES, PROBLEMS, WHY_US } from '../data/home';
import { CtaBand } from '../ui/cta-band';
import { Hero } from '../ui/hero';
import { Icon } from '../ui/icon';
import { NetworkDiagram } from '../ui/network-diagram';

// The home page, ported from frontend/app/(business)/page.tsx, in the original's order: hero, the problem, the solution
// (a diagram), the four packages, why us, and the call to action. Nothing here calls the API.
@Component({
  selector: 'aj-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CtaBand, Hero, Icon, NetworkDiagram, RouterLink],
  template: `
    <aj-hero
      [full]="true"
      title="Upgrade Your Home Network."
      subtitle="Smart networking and automation for builder-grade homes."
      [primary]="{ label: 'Schedule Consultation', path: '/get-started' }"
      [secondary]="{ label: 'View Packages', path: '/', fragment: 'packages' }"
    />

    <section class="section">
      <div class="wrap">
        <p class="eyebrow">The Problem</p>
        <h2 class="section-title">Sound familiar?</h2>
        <p class="lede">Most builder-grade homes ship with the bare minimum. Here's what that looks like.</p>

        <div class="problem-grid">
          <div class="card card-hover gradient-border problem featured">
            <span class="icon-box lg"><aj-icon [name]="featured.icon" /></span>
            <div>
              <h3 class="problem-title">{{ featured.title }}</h3>
              <p class="card-text relaxed">{{ featured.long }}</p>
            </div>
          </div>
          <ul class="stack" role="list">
            @for (problem of others; track problem.title) {
              <li class="card card-hover gradient-border problem small">
                <span class="icon-box"><aj-icon [name]="problem.icon" /></span>
                <div>
                  <h3 class="problem-title">{{ problem.title }}</h3>
                  <p class="card-text">{{ problem.description }}</p>
                </div>
              </li>
            }
          </ul>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap w-5xl">
        <p class="eyebrow">The Solution</p>
        <h2 class="section-title center">The engineered alternative.</h2>
        <p class="lede center">A properly designed network with segmented traffic, hardwired backbone, and local control.</p>
        <aj-network-diagram />
      </div>
    </section>

    <section id="packages" class="section">
      <div class="wrap">
        <div class="center">
          <p class="eyebrow">Packages</p>
          <h2 class="section-title">Service Packages</h2>
          <p class="lede">Hardware billed separately or bundled. Every install includes clean mounting and configuration.</p>
        </div>
        <ul class="package-grid" role="list">
          @for (pkg of packages; track pkg.name) {
            <li>
              <article class="card card-hover gradient-border package" [class.featured]="pkg.featured" [class]="'acc-' + pkg.accent">
                <div class="package-bar" aria-hidden="true"></div>
                @if (pkg.featured) {
                  <span class="badge glow">Most Popular</span>
                }
                <h3 class="package-name">{{ pkg.name }}</h3>
                <p class="price">{{ pkg.priceRange }}</p>
                <p class="ideal">{{ pkg.idealFor }}</p>
                <ul class="checks" role="list">
                  @for (item of pkg.includes; track item) {
                    <li><aj-icon name="check" />{{ item }}</li>
                  }
                </ul>
                <a class="btn btn-lg btn-block" [class.btn-primary]="pkg.featured" [class.btn-outline]="!pkg.featured" [class.gradient-border]="!pkg.featured" routerLink="/get-started">
                  Schedule Consultation
                </a>
              </article>
            </li>
          }
        </ul>
        <p class="more-note">
          Just need a few cable drops or a single service? We do standalone work too — no package required.
          <a class="accent-link" routerLink="/get-started">Get a quote</a>.
        </p>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap w-4xl">
        <p class="eyebrow">Why Us</p>
        <h2 class="section-title">Why Action Jackson?</h2>
        <ol class="numbered" role="list">
          @for (item of whyUs; track item.title) {
            <li>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
            </li>
          }
        </ol>
      </div>
    </section>

    <aj-cta-band />
  `,
})
export class Home {
  protected readonly featured = PROBLEMS[0];
  protected readonly others = PROBLEMS.slice(1);
  protected readonly packages = PACKAGES;
  protected readonly whyUs = WHY_US;
}
