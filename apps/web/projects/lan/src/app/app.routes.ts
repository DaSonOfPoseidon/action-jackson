import { type Routes } from '@angular/router';
import { NotFound, ROUTE_DESCRIPTION, ROUTE_NOT_FOUND } from '@aj/shared';
import { ABOUT_META } from './data/about';
import { HOME_META } from './data/home';
import { SERVICE_LINKS } from './data/service-links';
import { About } from './pages/about';
import { Home } from './pages/home';

// The business pages, at the same paths as the original site (the edge redirects the apex host's /services/* and
// /get-started here with the path kept). "404" is a real route only so the build can prerender the not-found page
// (scripts/seo.mjs moves it to 404.html, which the edge serves with a 404); "**" shows it for any other path. Every
// route is prerendered (app.routes.server.ts), so they are all in the sitemap.
const notFound = { component: NotFound, title: 'Page not found', data: { [ROUTE_NOT_FOUND]: true } };

export const routes: Routes = [
  { path: '', component: Home, title: 'Home', data: { [ROUTE_DESCRIPTION]: HOME_META.description } },
  { path: 'about', component: About, title: ABOUT_META.title, data: { [ROUTE_DESCRIPTION]: ABOUT_META.description } },
  // The service pages share one component and carry their content, so they are loaded only when one is opened (the
  // prerendered page has it already; the other pages do not carry it).
  ...SERVICE_LINKS.map((service) => ({
    path: service.path.slice(1),
    loadComponent: () => import('./pages/service-page').then((m) => m.ServicePage),
    title: service.seoTitle,
    data: { [ROUTE_DESCRIPTION]: service.seoDescription, serviceId: service.id },
  })),
  {
    // Loaded when opened, like the service pages: the form brings Angular's forms package, which no other page needs.
    path: 'get-started',
    loadComponent: () => import('./pages/get-started').then((m) => m.GetStarted),
    title: 'Get started',
    data: { [ROUTE_DESCRIPTION]: 'Schedule a consultation with Action Jackson Installs for home networking, smart home, cameras and structured wiring in Columbia, MO.' },
  },
  { path: '404', ...notFound },
  { path: '**', ...notFound },
];
