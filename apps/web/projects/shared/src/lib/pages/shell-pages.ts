import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE_KEY } from '../sites/site-key';
import { SITE_META } from '../sites/site-meta';

// The one page each public site has until its design unit: the site's name and a short promise-free line. The page
// makes no API call (invariant 6).
@Component({
  selector: 'aj-shell-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ name }}</h1>
    <p>This site is being rebuilt.</p>
  `,
})
export class ShellHome {
  protected readonly name = SITE_META[inject(SITE_KEY)].name;
}

// The not-found page. It is prerendered as /404.html, which the edge serves with a 404 for any missing path.
@Component({
  selector: 'aj-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>Page not found</h1>
    <p><a routerLink="/">Go to the home page</a></p>
  `,
})
export class NotFound {}
