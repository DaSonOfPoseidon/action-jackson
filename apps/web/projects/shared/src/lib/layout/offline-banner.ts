import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ApiClient } from '../api/api-client';

export const OFFLINE_COPY =
  "We can't reach our booking system right now. You can still browse; please try again later.";

// Shown while the API is unreachable (a 503 from the edge, or no answer). The live region is always in the page and
// only its text comes and goes, because a screen reader announces a change inside an existing region, not a region
// that appears with its text already in it. Forms put it next to their submit button; the page frame has one too.
@Component({
  selector: 'aj-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './offline-banner.css',
  template: `
    <div class="region" role="status" aria-live="polite">
      @if (!api.online()) {
        <p class="notice">{{ copy }}</p>
      }
    </div>
  `,
})
export class OfflineBanner {
  protected readonly api = inject(ApiClient);
  protected readonly copy = OFFLINE_COPY;
}
