import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ConsultationForm } from '../forms/consultation-form';

// The page every "Get Started" and "Schedule Consultation" button points to: the consultation request form. The page is
// prerendered with the form in it (disabled until the app runs, see ConsultationForm), and makes no API call to render.
@Component({
  selector: 'aj-get-started',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConsultationForm],
  template: `
    <section class="form-hero">
      <div class="wrap w-3xl">
        <p class="eyebrow">Consultation</p>
        <h1>Get Started.</h1>
        <p class="form-lede">Tell us about your home and what you're looking for.</p>
      </div>
    </section>

    <section class="form-section">
      <div class="wrap w-2xl">
        <div class="card form-card">
          <aj-consultation-form />
        </div>
      </div>
    </section>
  `,
})
export class GetStarted {}
