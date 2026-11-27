import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// The call to action that ends every page: a headline, one line and a button to /get-started. It promises no reply
// time (the original's "custom proposal within 24 hours" is gone, as the owner decided).
@Component({
  selector: 'aj-cta-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="cta-band">
      <div class="cta-bg" aria-hidden="true"></div>
      <div class="cta-dots dot-grid" aria-hidden="true"></div>
      <div class="cta-orb a" aria-hidden="true"></div>
      <div class="cta-orb b" aria-hidden="true"></div>
      <div class="wrap w-3xl cta-inner">
        <h2 class="rise">{{ headline() }}</h2>
        <p class="rise d1">{{ subtext() }}</p>
        <a class="btn btn-primary btn-lg pulse-glow rise d2" routerLink="/get-started">{{ label() }}</a>
      </div>
    </section>
  `,
})
export class CtaBand {
  readonly headline = input('Ready to upgrade your network?');
  readonly subtext = input('Schedule a consultation and get a custom proposal.');
  readonly label = input('Schedule Consultation');
}
