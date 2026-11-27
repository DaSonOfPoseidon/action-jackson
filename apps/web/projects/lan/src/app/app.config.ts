import { type ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideSite } from '@aj/shared';
import { routes } from './app.routes';

// anchorScrolling: a link to /#packages scrolls to it; scrollPositionRestoration: a new page starts at the top.
export const appConfig: ApplicationConfig = {
  providers: [provideSite('lan'), provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }))],
};
