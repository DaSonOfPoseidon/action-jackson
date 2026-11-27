import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ServiceId } from '../data/service-links';

// The picture beside a service page's heading: one inline SVG per service, ported from the original's animated visuals
// (components/icons/*Visual.tsx). Decorative, so hidden from assistive technology. The motion is CSS (.pulse, .ring,
// .scan in styles.css), off under prefers-reduced-motion. The original's wiring picture had a "PATCH" label in 8px text;
// it is left out, since small text on a decoration would have to meet the contrast ratio and says nothing the page does not.
@Component({
  selector: 'aj-service-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (service()) {
      @case ('networking') {
        <svg viewBox="0 0 260 260" fill="none" aria-hidden="true" focusable="false">
          @for (n of networkNodes; track $index) {
            <line [attr.x1]="130" [attr.y1]="125" [attr.x2]="n.x" [attr.y2]="n.y" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5" />
          }
          @for (n of networkNodes; track $index) {
            <circle [attr.cx]="n.x" [attr.cy]="n.y" r="8" fill="#12121c" stroke="#16a34a" stroke-width="1.5" />
            <circle class="pulse" [attr.cx]="n.x" [attr.cy]="n.y" r="3" fill="#22c55e" />
          }
          <circle class="ring" cx="130" cy="125" r="22" fill="none" stroke="#22c55e" stroke-width="1" />
          <circle cx="130" cy="125" r="22" fill="#14532d" stroke="#16a34a" stroke-width="2" />
          <circle class="pulse slow" cx="130" cy="125" r="10" fill="#22c55e" />
        </svg>
      }
      @case ('smart-home') {
        <svg viewBox="0 0 260 260" fill="none" aria-hidden="true" focusable="false">
          <path d="M130 30 L230 100 L230 210 L30 210 L30 100 Z" stroke="#9333ea" stroke-width="2" stroke-linejoin="round" opacity="0.7" />
          <rect x="110" y="155" width="40" height="55" rx="2" stroke="#9333ea" stroke-width="1.5" fill="#581c87" fill-opacity="0.3" />
          @for (n of homeNodes; track $index) {
            <line x1="130" y1="140" [attr.x2]="n.x" [attr.y2]="n.y" stroke="#9333ea" stroke-width="1" stroke-dasharray="4 3" opacity="0.4" />
          }
          @for (n of homeNodes; track $index) {
            <circle [attr.cx]="n.x" [attr.cy]="n.y" r="10" fill="#12121c" stroke="#9333ea" stroke-width="1.5" />
            <circle class="pulse" [attr.cx]="n.x" [attr.cy]="n.y" r="4" fill="#a855f7" />
          }
          <circle class="ring" cx="130" cy="120" r="16" fill="none" stroke="#a855f7" stroke-width="1" />
          <circle cx="130" cy="120" r="16" fill="#581c87" stroke="#9333ea" stroke-width="2" />
          <circle class="pulse slow" cx="130" cy="120" r="7" fill="#a855f7" />
        </svg>
      }
      @case ('cameras') {
        <svg viewBox="0 0 260 260" fill="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="scan-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#ea580c" stop-opacity="0" />
              <stop offset="50%" stop-color="#ea580c" stop-opacity="0.6" />
              <stop offset="100%" stop-color="#ea580c" stop-opacity="0" />
            </linearGradient>
          </defs>
          <circle cx="130" cy="130" r="100" stroke="#ea580c" stroke-width="2" />
          <circle cx="130" cy="130" r="80" stroke="#ea580c" stroke-width="1" opacity="0.3" />
          <circle cx="130" cy="130" r="60" stroke="#ea580c" stroke-width="1" opacity="0.4" />
          <circle cx="130" cy="130" r="40" stroke="#ea580c" stroke-width="1" opacity="0.5" />
          <circle cx="130" cy="130" r="18" fill="#9a3412" stroke="#ea580c" stroke-width="2" />
          <circle class="pulse slow" cx="130" cy="130" r="8" fill="#ea580c" />
          <path d="M50 70 L50 50 L70 50" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
          <path d="M190 50 L210 50 L210 70" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
          <path d="M210 190 L210 210 L190 210" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
          <path d="M70 210 L50 210 L50 190" stroke="#ea580c" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
          <rect class="scan" x="50" y="126" width="160" height="8" rx="4" fill="url(#scan-gradient)" opacity="0.3" />
          <circle class="pulse" cx="200" cy="55" r="5" fill="#ef4444" />
        </svg>
      }
      @case ('wiring') {
        <svg viewBox="0 0 260 260" fill="none" aria-hidden="true" focusable="false">
          <rect x="15" y="35" width="40" height="210" rx="4" stroke="#06b6d4" stroke-width="1.5" fill="#164e63" fill-opacity="0.3" />
          @for (cable of cables; track $index) {
            <path [attr.d]="cable.path" [attr.stroke]="cable.colour" stroke-width="1.5" opacity="0.6" />
          }
          @for (cable of cables; track $index) {
            <rect [attr.x]="24" [attr.y]="cable.fromY - 6" width="12" height="12" rx="2" fill="#12121c" stroke="#06b6d4" stroke-width="1" />
            <circle class="pulse" cx="30" [attr.cy]="cable.fromY" r="3" fill="#22d3ee" />
          }
          @for (cable of cables; track $index) {
            @if ($index < 7) {
              <rect [attr.x]="222" [attr.y]="cable.toY - 8" width="16" height="16" rx="3" fill="#12121c" [attr.stroke]="cable.colour" stroke-width="1.5" />
              <circle class="pulse slow" cx="230" [attr.cy]="cable.toY" r="3" [attr.fill]="cable.colour" />
            }
          }
        </svg>
      }
    }
  `,
})
export class ServiceVisual {
  readonly service = input.required<ServiceId>();

  protected readonly networkNodes = [
    { x: 80, y: 30 },
    { x: 160, y: 20 },
    { x: 220, y: 60 },
    { x: 240, y: 140 },
    { x: 200, y: 210 },
    { x: 120, y: 230 },
    { x: 40, y: 190 },
    { x: 20, y: 100 },
  ];

  protected readonly homeNodes = [
    { x: 50, y: 80 },
    { x: 210, y: 80 },
    { x: 40, y: 180 },
    { x: 220, y: 180 },
    { x: 130, y: 240 },
  ];

  // Eight cables from the patch panel's ports (left) to the wall plates (right), as in the original.
  protected readonly cables = (() => {
    const toY = [50, 86, 122, 158, 194, 218, 242, 242];
    const colours = ['#06b6d4', '#06b6d4', '#0891b2', '#0891b2', '#22d3ee', '#22d3ee', '#67e8f9', '#67e8f9'];
    return toY.map((to, i) => {
      const fromY = 50 + i * 24;
      const midX = 80 + (i % 3) * 30;
      return { fromY, toY: to, colour: colours[i], path: `M50 ${fromY} C${midX} ${fromY}, ${midX} ${to}, 215 ${to}` };
    });
  })();
}
