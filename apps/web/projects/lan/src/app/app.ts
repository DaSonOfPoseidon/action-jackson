import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { useJsonLd } from '@aj/shared';
import { localBusiness } from './data/structured-data';
import { LanFrame } from './frame/lan-frame';

@Component({
  selector: 'aj-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LanFrame, RouterOutlet],
  template: `
    <aj-lan-frame>
      <router-outlet />
    </aj-lan-frame>
  `,
})
export class App {
  constructor() {
    // The business, on every page (the original put it in its layout).
    useJsonLd('local-business', localBusiness());
  }
}
