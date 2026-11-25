import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// The placeholder every "Get Started" and "Schedule Consultation" button points to, so none of them 404s. The consultation
// request form replaces it in unit 13. No form, no API call, and no promise about what happens after a request.
@Component({
  selector: 'aj-get-started',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="plain-page">
      <h1>Get started</h1>
      <p>The consultation request form is coming in the next update.</p>
      <a class="btn btn-outline btn-lg gradient-border" routerLink="/">Back to Home</a>
    </div>
  `,
})
export class GetStarted {}
