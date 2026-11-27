import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { useJsonLd } from '@aj/shared';
import { SERVICE_LINKS } from '../data/service-links';
import { PROCESS_STEPS, SERVICES, type Service } from '../data/services';
import { breadcrumbList, faqPage } from '../data/structured-data';
import { CtaBand } from '../ui/cta-band';
import { Icon } from '../ui/icon';
import { ServiceVisual } from '../ui/service-visual';

// One template for the four service pages (networking, smart home, cameras, wiring), driven by a typed constant each
// (data/services.ts), in the original's order: hero, the problem, the process, what is included, the specifications,
// the FAQ, the price and the call to action. The accent colour comes from the service. Which service it shows comes
// from the route's data (serviceId), so every page is its own prerendered route.
@Component({
  selector: 'aj-service-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CtaBand, Icon, RouterLink, ServiceVisual],
  host: { '[class]': "'acc-' + service.accent" },
  template: `
    <section class="service-hero">
      <div class="service-hero-inner">
        <div>
          <span class="badge rise">{{ service.badge }}</span>
          <h1 class="rise d1">
            @for (part of titleParts; track $index) {
              @if (part === '.') {
                <span class="dot">.</span>
              } @else {
                <span>{{ part }}</span>
              }
            }
          </h1>
          <p class="lead rise d2">{{ service.heroSubtitle }}</p>
          <div class="actions rise d3">
            <a class="btn btn-primary btn-lg" routerLink="/get-started">Get Started</a>
            <a class="btn btn-outline btn-lg gradient-border" routerLink="/" fragment="packages">View Packages</a>
          </div>
        </div>
        <div class="visual rise d2">
          <aj-service-visual [service]="service.id" />
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <p class="eyebrow ac">The Problem</p>
        <h2 class="section-title">{{ service.painHeading }}</h2>
        <p class="lede">{{ service.painSubheading }}</p>
        <ol class="problem-list" role="list">
          @for (item of service.painPoints; track item.title) {
            <li class="problem-row">
              <div class="problem-num">
                <span class="icon-box lg ac"><aj-icon [name]="item.icon" /></span>
              </div>
              <div class="problem-body">
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
            </li>
          }
        </ol>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <p class="eyebrow ac">Our Process</p>
        <h2 class="section-title">From consultation to handoff.</h2>
        <ol class="process-steps" role="list">
          @for (step of steps; track step.title) {
            <li>
              <h3>{{ step.title }}</h3>
              <p>{{ step.description }}</p>
            </li>
          }
        </ol>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <p class="eyebrow ac">Included</p>
        <h2 class="section-title">What's included.</h2>
        <ul class="feature-grid" role="list">
          @for (feature of service.features; track feature.title) {
            <li>
              <details class="feature">
                <summary>
                  <span class="icon-box ac"><aj-icon [name]="feature.icon" /></span>
                  <span class="feature-main">
                    <span class="feature-head">
                      <h3>{{ feature.title }}</h3>
                      @if (feature.badge) {
                        <span class="badge small">{{ feature.badge }}</span>
                      }
                    </span>
                    <span class="feature-sum">{{ feature.summary }}</span>
                  </span>
                  <span class="plus" aria-hidden="true"><aj-icon name="plus" /></span>
                </summary>
                <p class="feature-detail">{{ feature.detail }}</p>
              </details>
            </li>
          }
        </ul>
      </div>
    </section>

    <section class="section alt">
      <div class="wrap">
        <p class="eyebrow ac">{{ service.specs.label }}</p>
        <h2 class="section-title">Technical specifications.</h2>
        <div class="spec-wrap">
          @switch (service.specs.kind) {
            @case ('tiers') {
              <div class="spec-grid tiers">
                @for (tier of tiers; track tier.tier) {
                  <article class="spec-card tier">
                    <h3>{{ tier.tier }}</h3>
                    <p class="tagline">{{ tier.tagline }}</p>
                    <dl class="spec-rows">
                      @for (row of tier.specs; track row.label) {
                        <div>
                          <dt>{{ row.label }}</dt>
                          <dd>{{ row.value }}</dd>
                        </div>
                      }
                    </dl>
                  </article>
                }
              </div>
            }
            @case ('cards') {
              <ul class="spec-grid cards" role="list">
                @for (card of cards; track card.title) {
                  <li class="spec-card">
                    <div class="spec-head">
                      <span class="icon-box ac"><aj-icon [name]="card.icon" /></span>
                      <div>
                        <h3>{{ card.title }}</h3>
                        <p class="spec-value">{{ card.value }}</p>
                      </div>
                    </div>
                    <p class="spec-detail">{{ card.detail }}</p>
                  </li>
                }
              </ul>
            }
            @case ('table') {
              <div class="table-scroll" role="region" [attr.aria-label]="service.specs.label" tabindex="0">
                <table>
                  <thead>
                    <tr>
                      @for (column of columns; track column) {
                        <th scope="col">{{ column }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rows; track row[0]) {
                      <tr>
                        <th scope="row">{{ row[0] }}</th>
                        @for (cell of row.slice(1); track $index) {
                          <td [class.mono-col]="$index + 1 === monoColumn">{{ cell }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap w-3xl">
        <p class="eyebrow ac">FAQ</p>
        <h2 class="section-title">Common questions.</h2>
        <div class="faq-list">
          @for (faq of service.faqs; track faq.question) {
            <details class="faq-item" name="faq">
              <summary>
                <span class="q">{{ faq.question }}</span>
                <span class="plus" aria-hidden="true"><aj-icon name="plus" /></span>
              </summary>
              <p>{{ faq.answer }}</p>
            </details>
          }
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap w-xl">
        <div class="pricing">
          <p class="pricing-label">{{ service.pricing.label }}</p>
          <p class="pricing-price">
            <span class="amount">{{ service.pricing.price }}</span>
            @if (service.pricing.unit) {
              <span class="unit"> {{ service.pricing.unit }}</span>
            }
          </p>
          <p class="pricing-desc">{{ service.pricing.description }}</p>
          <ul class="inclusions" role="list">
            @for (item of service.pricing.inclusions; track item) {
              <li><aj-icon name="check" /><span>{{ item }}</span></li>
            }
          </ul>
          @if (service.pricing.note) {
            <p class="pricing-note">{{ service.pricing.note }}</p>
          }
          <a class="btn btn-primary btn-lg" routerLink="/get-started">Get Started</a>
        </div>
      </div>
    </section>

    <aj-cta-band [headline]="service.ctaHeadline" [subtext]="service.ctaSubtext" />
  `,
})
export class ServicePage {
  readonly service: Service = serviceFor(inject(ActivatedRoute).snapshot.data['serviceId']);
  protected readonly steps = PROCESS_STEPS;

  // The heading, split at its periods: the period is set in the accent colour, as in the original.
  protected readonly titleParts = this.service.heroTitle.split(/(\.)/).filter((part) => part !== '');

  // The specifications, narrowed per kind for the template.
  protected readonly tiers = this.service.specs.kind === 'tiers' ? this.service.specs.tiers : [];
  protected readonly cards = this.service.specs.kind === 'cards' ? this.service.specs.cards : [];
  protected readonly columns = this.service.specs.kind === 'table' ? this.service.specs.columns : [];
  protected readonly rows = this.service.specs.kind === 'table' ? this.service.specs.rows : [];
  protected readonly monoColumn = this.service.specs.kind === 'table' ? (this.service.specs.monoColumn ?? -1) : -1;

  constructor() {
    const link = SERVICE_LINKS.find((l) => l.id === this.service.id)!;
    // Each page's blocks have keys of their own (its id), so one created before the last is destroyed cannot be removed by it.
    useJsonLd(`breadcrumb:${this.service.id}`, breadcrumbList(link));
    useJsonLd(`faq:${this.service.id}`, faqPage(this.service));
  }
}

function serviceFor(id: unknown): Service {
  const service = SERVICES.find((s) => s.id === id);
  if (!service) {
    throw new Error(`the route has no service id (${String(id)})`);
  }
  return service;
}
