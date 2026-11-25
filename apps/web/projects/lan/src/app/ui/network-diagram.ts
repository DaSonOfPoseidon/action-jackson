import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DIAGRAM_STEPS } from '../data/home';
import { Icon } from './icon';

// The solution diagram of the home page, ported from components/sections/NetworkDiagram.tsx: the path from the
// internet to the devices as an ordered list (a row on a wide screen, a column on a narrow one; the one list does both,
// where the original drew two). The dashed arrows are decoration.
@Component({
  selector: 'aj-network-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <ol class="diagram glass" aria-label="From the internet to your devices">
      @for (step of steps; track step.label; let last = $last) {
        <li class="step">
          <div class="step-body">
            <span class="step-icon glass"><aj-icon [name]="step.icon" /></span>
            <span>
              <span class="step-label">{{ step.label }}</span>
              <span class="step-desc">{{ step.description }}</span>
            </span>
          </div>
          @if (!last) {
            <svg class="arrow" viewBox="0 0 16 32" fill="none" aria-hidden="true" focusable="false">
              <line x1="8" y1="0" x2="8" y2="28" stroke="currentColor" stroke-width="1.5" />
              <path d="M4 24l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          }
        </li>
      }
    </ol>
  `,
})
export class NetworkDiagram {
  protected readonly steps = DIAGRAM_STEPS;
}
