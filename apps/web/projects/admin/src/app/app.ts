import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SiteFrame } from '@aj/shared';

// The admin app is client-rendered: no prerender, no hydration, and noindex in index.html. It is one placeholder
// page. Sign-in is a later unit, and so is routing under /admin.
@Component({
  selector: 'aj-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SiteFrame],
  template: `
    <aj-site-frame>
      <h1>Admin</h1>
      <p>Sign-in arrives in a later unit.</p>
    </aj-site-frame>
  `,
})
export class App {}
