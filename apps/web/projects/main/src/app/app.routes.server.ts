import { RenderMode, type ServerRoute } from '@angular/ssr';

// Every route is prerendered at build time. Nothing renders on a request.
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Prerender }];
