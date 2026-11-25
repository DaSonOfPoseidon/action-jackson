import { type ApplicationConfig } from '@angular/core';
import { provideSite } from '@aj/shared';

export const appConfig: ApplicationConfig = {
  providers: [provideSite('admin')],
};
