import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// No frame here: the hub is its own whole screen, and the pages that want the frame (the not-found page) get it from
// the route table (app.routes.ts).
@Component({
  selector: 'aj-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
