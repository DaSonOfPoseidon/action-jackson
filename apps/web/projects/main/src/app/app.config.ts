import { type ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideSite } from '@aj/shared';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideSite('main'), provideRouter(routes)],
};
