import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { type Observable, catchError, tap, throwError } from 'rxjs';
import { SITE_KEY } from '../sites/site-key';
import { type ApiProblem, isOffline, toApiProblem } from './api-problem';

// Each segment is a plain name. No empty segment (so no "//"), no "." or ".." segment, no query, no scheme: a call can
// only ever reach /api/<site>/<path> on this origin.
const PATH = /^(?!\.{1,2}(?:\/|$))[A-Za-z0-9_~-][A-Za-z0-9._~-]*(?:\/(?!\.{1,2}(?:\/|$))[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*$/;

// Extra options of a call. Headers are added to the ones the client sets itself: Content-Type is never replaced.
export interface ApiRequestOptions {
  readonly headers?: Readonly<Record<string, string>>;
}

// A thin client for the same-origin API: /api/<site>/<path>. The edge proxies it to the PC, and answers a 503 problem
// when the PC is off. Failures are ApiProblems. `online` is the offline banner's input: a 503 or a network failure
// makes it false, and the next success makes it true again. Other failures (a 409, a validation error) leave it as it
// was, because the API did answer.
//
// It never calls the API while a page is prerendered (invariant 6): on the server every call fails at once, with no
// request. Pages call the API only from a user action in the browser.
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly site = inject(SITE_KEY);
  private readonly server = isPlatformServer(inject(PLATFORM_ID));
  private readonly onlineState = signal(true);

  readonly online = this.onlineState.asReadonly();

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('POST', path, body, undefined, options);
  }

  put<T>(path: string, body: unknown, options?: ApiRequestOptions): Observable<T> {
    return this.request<T>('PUT', path, body, undefined, options);
  }

  delete<T>(path: string): Observable<T> {
    return this.request<T>('DELETE', path);
  }

  private request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    options?: ApiRequestOptions,
  ): Observable<T> {
    if (!PATH.test(path)) {
      throw new Error(`Invalid API path "${path}": use plain segments, such as "quotes/pricing".`);
    }
    if (this.server) {
      const problem: ApiProblem = { status: 0, title: 'Not available while the page is prerendered' };
      return throwError(() => problem);
    }
    return this.http
      .request<T>(method, `/api/${this.site}/${path}`, {
        body,
        params: params ? new HttpParams({ fromObject: params }) : undefined,
        headers: headersOf(body, options),
      })
      .pipe(
        tap(() => this.onlineState.set(true)),
        catchError((error: unknown) => {
          const problem = toApiProblem(error);
          if (isOffline(problem)) {
            this.onlineState.set(false);
          }
          return throwError(() => problem);
        }),
      );
  }
}

// A body is always json. The caller's headers come first, minus any Content-Type of theirs, so it cannot be replaced.
function headersOf(body: unknown, options?: ApiRequestOptions): HttpHeaders | undefined {
  let headers = new HttpHeaders();
  for (const [name, value] of Object.entries(options?.headers ?? {})) {
    if (name.toLowerCase() !== 'content-type') {
      headers = headers.set(name, value);
    }
  }
  if (body !== undefined) {
    headers = headers.set('Content-Type', 'application/json');
  }
  return headers.keys().length > 0 ? headers : undefined;
}
