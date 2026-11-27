import { ChangeDetectionStrategy, Component } from '@angular/core';

// The "Skip to main content" link, the first tab stop of every framed page. With <base href="/">, a bare "#main" would
// mean "/#main" and leave the page, so the click is cancelled and <main> is focused in place instead. The page's frame
// (the shared SiteFrame, or a site's own) puts this first and has a <main id="main" tabindex="-1">.
@Component({
  selector: 'aj-skip-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './skip-link.css',
  template: `<a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to main content</a>`,
})
export class SkipLink {
  protected skipToMain(event: Event): void {
    event.preventDefault();
    const main = (event.currentTarget as HTMLElement).ownerDocument.getElementById('main');
    main?.focus();
    main?.scrollIntoView?.();
  }
}
