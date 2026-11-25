import { type Routes } from '@angular/router';
import { FramedPage, NotFound, ROUTE_DESCRIPTION, ROUTE_NOT_FOUND, SITE_META } from '@aj/shared';
import { Hub } from './hub/hub';

// The home page and the not-found page. The hub is a whole screen with no header or footer, so it sits outside the
// page frame; every other page of the site is inside it. "404" is a real route only so the build can prerender the
// not-found page (scripts/seo.mjs moves it to 404.html, which the edge serves with a 404); "**" shows it for any other path.
const notFound = { component: NotFound, title: 'Page not found', data: { [ROUTE_NOT_FOUND]: true } };

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: Hub, title: 'Home', data: { [ROUTE_DESCRIPTION]: SITE_META['main'].description } },
  {
    path: '',
    component: FramedPage,
    children: [
      { path: '404', ...notFound },
      { path: '**', ...notFound },
    ],
  },
];
