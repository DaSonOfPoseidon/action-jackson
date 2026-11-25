import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteFrame } from './site-frame';

// A route's component that puts its child routes inside the page frame (skip link, header, offline banner, main,
// footer). A page that is its own whole screen (the main site's hub) sits outside it in the route table instead, so
// the frame is left out of the page's HTML, not hidden by CSS.
@Component({
  selector: 'aj-framed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SiteFrame],
  template: `
    <aj-site-frame>
      <router-outlet />
    </aj-site-frame>
  `,
})
export class FramedPage {}
