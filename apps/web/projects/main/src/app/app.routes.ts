import { type Routes } from '@angular/router';
import { NotFound, ROUTE_DESCRIPTION, ROUTE_NOT_FOUND, SITE_META } from '@aj/shared';
import { Hub } from './hub/hub';

// The home page and the not-found page. "404" is a real route only so the build can prerender the not-found page
// (scripts/seo.mjs moves it to 404.html, which the edge serves with a 404); "**" shows it for any other path.
const notFound = { component: NotFound, title: 'Page not found', data: { [ROUTE_NOT_FOUND]: true } };

export const routes: Routes = [
  { path: '', component: Hub, title: 'Home', data: { [ROUTE_DESCRIPTION]: SITE_META['main'].description } },
  { path: '404', ...notFound },
  { path: '**', ...notFound },
];
