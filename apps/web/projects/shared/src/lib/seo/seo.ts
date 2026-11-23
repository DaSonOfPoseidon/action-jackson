import { DOCUMENT } from '@angular/common';
import { type EnvironmentProviders, Injectable, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { type ActivatedRouteSnapshot, DefaultUrlSerializer, NavigationEnd, Router, type RouterStateSnapshot, TitleStrategy, type UrlTree, UrlSerializer } from '@angular/router';
import { filter } from 'rxjs';
import { SITE_KEY } from '../sites/site-key';
import { SITE_META } from '../sites/site-meta';
import { canonicalUrl } from './canonical';

// Per-route SEO, set from the router so it is in the prerendered HTML:
//   title        "<page> · Action Jackson <site name>" (the route's `title`), else just the site title
//   description  the route's data.description, else the site's default
//   canonical, og:url   https://<production host><path> (see canonical.ts); a route with data.notFound has neither,
//                and is marked noindex instead
//   og:title, og:description, og:type=website, og:site_name; no og:image yet
// provideSeo() turns it all on in an app's config.

export const ROUTE_NOT_FOUND = 'notFound';
export const ROUTE_DESCRIPTION = 'description';

@Injectable()
export class SiteTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = SITE_META[inject(SITE_KEY)];

  titleFor(snapshot: RouterStateSnapshot): string {
    const page = this.buildTitle(snapshot);
    return page ? `${page} · ${this.meta.titleSuffix}` : this.meta.titleSuffix;
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(this.titleFor(snapshot));
  }
}

// "/about/" is the same page as "/about" (the edge serves both), so the router must match both. Without this a
// trailing slash matches no route and shows the not-found page.
export class TrailingSlashUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    return super.parse(url.replace(/(?<=[^/?#])\/+(?=$|[?#])/, ''));
  }
}

@Injectable()
export class SeoService {
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly titles = inject(SiteTitleStrategy);
  private readonly site = inject(SITE_KEY);
  private readonly siteMeta = SITE_META[this.site];

  start(): void {
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.update(e.urlAfterRedirects, this.leaf(this.router.routerState.snapshot.root));
    });
  }

  private leaf(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = snapshot;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  private update(url: string, route: ActivatedRouteSnapshot): void {
    const description = typeof route.data[ROUTE_DESCRIPTION] === 'string' ? (route.data[ROUTE_DESCRIPTION] as string) : this.siteMeta.description;
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: this.titles.titleFor(this.router.routerState.snapshot) });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteMeta.titleSuffix });

    if (route.data[ROUTE_NOT_FOUND] === true) {
      this.removeCanonical();
      this.meta.removeTag('property="og:url"');
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
      return;
    }
    const canonical = canonicalUrl(this.site, url);
    this.setCanonical(canonical);
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.removeTag('name="robots"');
  }

  private setCanonical(href: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  private removeCanonical(): void {
    this.doc.head.querySelectorAll('link[rel="canonical"]').forEach((link) => link.remove());
  }
}

export function provideSeo(): EnvironmentProviders {
  return makeEnvironmentProviders([
    SeoService,
    SiteTitleStrategy,
    { provide: TitleStrategy, useExisting: SiteTitleStrategy },
    { provide: UrlSerializer, useClass: TrailingSlashUrlSerializer },
    provideEnvironmentInitializer(() => inject(SeoService).start()),
  ]);
}
