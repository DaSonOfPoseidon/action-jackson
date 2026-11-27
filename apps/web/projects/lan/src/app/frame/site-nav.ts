import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SERVICE_LINKS } from '../data/service-links';
import { Icon } from '../ui/icon';

// The header bar: the wordmark, the navigation (Home, a Services menu, About and the Get Started button) and, on a
// narrow screen, a menu button.
//
// Both menus are <details>, so they open and close with a click, Enter or Space with no script at all, and their links
// are in the prerendered HTML. The script adds only what <details> lacks: Escape closes an open menu and returns the
// focus to its button, a click outside it closes it, and following a link in it closes it (the next page is a route
// change, not a reload, so the menu would otherwise stay open).
@Component({
  selector: 'aj-site-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  host: { '(document:keydown.escape)': 'onEscape()', '(document:click)': 'onClick($event)' },
  template: `
    <div class="site-bar">
      <div class="site-bar-inner">
        <a class="wordmark" routerLink="/">
          <aj-icon name="network" />
          <span>Action Jackson<span class="tint"> Installs</span></span>
        </a>

        <nav class="nav-desktop" aria-label="Primary">
          <a routerLink="/" routerLinkActive ariaCurrentWhenActive="page" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <details class="services-menu">
            <summary class="services-toggle">
              Services
              <aj-icon name="chevron-down" />
            </summary>
            <ul class="menu-panel">
              @for (service of services; track service.id) {
                <li>
                  <a [routerLink]="service.path" routerLinkActive ariaCurrentWhenActive="page">{{ service.navLabel }}</a>
                </li>
              }
            </ul>
          </details>
          <a routerLink="/about" routerLinkActive ariaCurrentWhenActive="page">About</a>
          <a class="btn btn-primary btn-md pulse-glow" routerLink="/get-started">Get Started</a>
        </nav>

        <nav class="nav-mobile" aria-label="Primary">
          <details class="mobile-menu">
            <summary class="menu-toggle">
              <span class="sr-only">Menu</span>
              <aj-icon class="when-closed" name="menu" />
              <aj-icon class="when-open" name="close" />
            </summary>
            <div class="mobile-panel">
              <a routerLink="/" routerLinkActive ariaCurrentWhenActive="page" [routerLinkActiveOptions]="{ exact: true }">Home</a>
              @for (service of services; track service.id) {
                <a class="indent" [routerLink]="service.path" routerLinkActive ariaCurrentWhenActive="page">{{ service.navLabel }}</a>
              }
              <a routerLink="/about" routerLinkActive ariaCurrentWhenActive="page">About</a>
              <a class="btn btn-primary btn-md" routerLink="/get-started">Get Started</a>
            </div>
          </details>
        </nav>
      </div>
    </div>
  `,
})
export class SiteNav {
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly services = SERVICE_LINKS;

  private openMenus(): HTMLDetailsElement[] {
    return [...this.root.querySelectorAll<HTMLDetailsElement>('details[open]')];
  }

  // Escape closes every open menu and puts the focus back on the button of the first one, where the keyboard user was.
  protected onEscape(): void {
    const open = this.openMenus();
    if (open.length === 0) {
      return;
    }
    const focused = this.root.ownerDocument.activeElement;
    const owner = open.find((menu) => focused && menu.contains(focused)) ?? open[0];
    open.forEach((menu) => (menu.open = false));
    owner.querySelector<HTMLElement>('summary')?.focus();
  }

  // A click outside a menu closes it; a click on a link inside it closes it too.
  protected onClick(event: Event): void {
    const target = event.target as Element | null;
    if (!target?.closest) {
      return;
    }
    const link = target.closest('a');
    for (const menu of this.openMenus()) {
      if (!menu.contains(target) || (link && menu.contains(link))) {
        menu.open = false;
      }
    }
  }
}
