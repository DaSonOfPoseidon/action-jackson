import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteFrame } from '@aj/shared';

@Component({
  selector: 'aj-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SiteFrame],
  template: `
    <aj-site-frame>
      <router-outlet />
    </aj-site-frame>
  `,
})
export class App {}
