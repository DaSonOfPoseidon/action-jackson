import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HeroLink {
  readonly label: string;
  readonly path: string;
  readonly fragment?: string;
}

// The big opening of the home and about pages: the original's gradient mesh, orb and dot grid behind a centred h1, a
// line under it and one or two buttons. The corner brackets show only on wide screens, where there is room beside the text.
@Component({
  selector: 'aj-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { '[class.full]': 'full()' },
  template: `
    <section class="hero" [class.full]="full()">
      <div class="hero-bg" aria-hidden="true">
        <div class="hero-wash"></div>
        <div class="hero-mesh"></div>
        <div class="hero-orb"></div>
        <div class="hero-dots dot-grid"></div>
      </div>
      <div class="corner tl" aria-hidden="true"></div>
      <div class="corner br" aria-hidden="true"></div>
      <div class="hero-inner">
        <h1 class="rise">{{ title() }}</h1>
        <p class="hero-sub rise d1">{{ subtitle() }}</p>
        <div class="hero-cta rise d2">
          <a class="btn btn-primary btn-lg" [routerLink]="primary().path" [fragment]="primary().fragment">{{ primary().label }}</a>
          @if (secondary(); as link) {
            <a class="btn btn-outline btn-lg gradient-border" [routerLink]="link.path" [fragment]="link.fragment">{{ link.label }}</a>
          }
        </div>
      </div>
    </section>
  `,
})
export class Hero {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly primary = input.required<HeroLink>();
  readonly secondary = input<HeroLink>();
  readonly full = input(false);
}
