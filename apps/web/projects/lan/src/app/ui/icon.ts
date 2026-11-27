import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from './icons';

// A decorative icon: it draws in the colour of the text around it, at the size of the font (1em). Never the only
// carrier of a meaning, so it is hidden from assistive technology.
@Component({
  selector: 'aj-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      @for (d of paths(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly paths = computed<readonly string[]>(() => ICONS[this.name()]);
}
