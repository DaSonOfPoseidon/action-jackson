import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingForm } from '../forms/booking-form';

// The booking page: an appointment for a quote the visitor already has. It is prerendered with the form in it (disabled until
// the app runs, see BookingForm), and makes no API call to render: the open times are asked for in the browser.
@Component({
  selector: 'aj-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BookingForm, RouterLink],
  template: `
    <section class="form-hero">
      <div class="wrap w-3xl">
        <p class="eyebrow">Appointment</p>
        <h1>Book an Appointment.</h1>
        <p class="form-lede">Pick a day and a time for a site survey or an install. You need the number of your quote.</p>
        <p class="form-aside">Don't have a quote yet? <a class="accent-link" routerLink="/quote">Get a quote</a>.</p>
      </div>
    </section>

    <section class="form-section">
      <div class="wrap w-2xl">
        <div class="card form-card">
          <aj-booking-form />
        </div>
      </div>
    </section>
  `,
})
export class Book {}
