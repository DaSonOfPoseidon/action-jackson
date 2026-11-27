import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuoteForm } from '../forms/quote-form';

// The quote builder page. It is prerendered with the form in it (disabled until the app runs, see QuoteForm), and makes no
// API call to render. The price on it comes only from the API, once the visitor has entered something.
@Component({
  selector: 'aj-quote',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QuoteForm, RouterLink],
  template: `
    <section class="form-hero">
      <div class="wrap w-3xl">
        <p class="eyebrow">Quote</p>
        <h1>Get a Quote.</h1>
        <p class="form-lede">Build a quote for cable runs and services and see the price as you go, or ask for a whole-home install.</p>
        <p class="form-aside">Not sure what you need? <a class="accent-link" routerLink="/get-started">Ask for a consultation</a>.</p>
      </div>
    </section>

    <section class="form-section">
      <div class="wrap w-2xl">
        <div class="card form-card">
          <aj-quote-form />
        </div>
      </div>
    </section>
  `,
})
export class Quote {}
