import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SITE_KEY } from '../sites/site-key';
import { ApiClient } from './api-client';
import type { ApiProblem } from './api-problem';

function setup(platform: 'browser' | 'server' = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withFetch()),
      provideHttpClientTesting(),
      { provide: SITE_KEY, useValue: 'lan' },
      { provide: PLATFORM_ID, useValue: platform },
    ],
  });
  return { api: TestBed.inject(ApiClient), http: TestBed.inject(HttpTestingController) };
}

const problem = (status: number, extra: object = {}) => ({
  type: 'about:blank',
  title: 'Something',
  status,
  ...extra,
});

async function failure(promise: Promise<unknown>): Promise<ApiProblem> {
  try {
    await promise;
  } catch (error) {
    return error as ApiProblem;
  }
  throw new Error('expected the request to fail');
}

describe('ApiClient', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('calls the same-origin /api/<site>/ path', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.get<{ ok: boolean }>('quotes/pricing'));
    const req = http.expectOne('/api/lan/quotes/pricing');
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('sends a post body as json', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.post<{ id: number }>('consultations', { name: 'A' }));
    const req = http.expectOne('/api/lan/consultations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'A' });
    req.flush({ id: 7 });
    expect(await result).toEqual({ id: 7 });
  });

  it('always sends Content-Type: application/json with a body', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.post('consultations', { name: 'A' }));
    const req = http.expectOne('/api/lan/consultations');
    expect(req.request.headers.get('Content-Type')).toBe('application/json');
    req.flush({});
    await result;
  });

  it('sends the extra headers of a post along with Content-Type', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.post('appointments', { a: 1 }, { headers: { 'Idempotency-Key': 'abc' } }));
    const req = http.expectOne('/api/lan/appointments');
    expect(req.request.headers.get('Idempotency-Key')).toBe('abc');
    expect(req.request.headers.get('Content-Type')).toBe('application/json');
    req.flush({});
    await result;
  });

  it('does not let a caller replace Content-Type, in any letter case', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.post('x', {}, { headers: { 'content-TYPE': 'text/plain' } }));
    const req = http.expectOne('/api/lan/x');
    expect(req.request.headers.getAll('Content-Type')).toEqual(['application/json']);
    req.flush({});
    await result;
  });

  it('sends no Content-Type on a get', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.get('quotes/pricing'));
    const req = http.expectOne('/api/lan/quotes/pricing');
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});
    await result;
  });

  it('refuses a path that could leave /api/<site>/', () => {
    const { api } = setup();
    for (const bad of ['/etc/passwd', '../car/x', 'a/../b', 'https://evil.example/x', '//evil.example', 'a?b=1', '']) {
      expect(() => api.get(bad), bad).toThrow(/path/);
    }
  });

  it('starts online', () => {
    expect(setup().api.online()).toBe(true);
  });

  it('maps a problem+json answer to an ApiProblem with its errors map', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.post('consultations', {})));
    http
      .expectOne('/api/lan/consultations')
      .flush(
        problem(400, { title: 'One or more validation errors occurred.', detail: 'Fix them.', errors: { Email: ['Required'], Phone: ['Bad', 'Shorter'] } }),
        { status: 400, statusText: 'Bad Request', headers: { 'content-type': 'application/problem+json' } },
      );
    const error = await result;
    expect(error.status).toBe(400);
    expect(error.title).toBe('One or more validation errors occurred.');
    expect(error.detail).toBe('Fix them.');
    expect(error.errors).toEqual({ Email: ['Required'], Phone: ['Bad', 'Shorter'] });
  });

  it('sets online to false on a 503 problem, with its Retry-After', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.get('quotes/pricing')));
    http
      .expectOne('/api/lan/quotes/pricing')
      .flush(problem(503, { title: 'Service unavailable' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/problem+json', 'retry-after': '30' },
      });
    const error = await result;
    expect(error.status).toBe(503);
    expect(error.title).toBe('Service unavailable');
    expect(error.retryAfter).toBe(30);
    expect(api.online()).toBe(false);
  });

  it('does not change online on a 409 problem, and surfaces it as an ApiProblem', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.post('appointments', {})));
    http
      .expectOne('/api/lan/appointments')
      .flush(problem(409, { title: 'That time is taken' }), { status: 409, statusText: 'Conflict' });
    expect((await result).status).toBe(409);
    expect(api.online()).toBe(true);
  });

  it('leaves online false after a 409 that follows a 503', async () => {
    const { api, http } = setup();
    const down = failure(firstValueFrom(api.get('a')));
    http.expectOne('/api/lan/a').flush(problem(503), { status: 503, statusText: 'x' });
    await down;
    const conflict = failure(firstValueFrom(api.get('b')));
    http.expectOne('/api/lan/b').flush(problem(409), { status: 409, statusText: 'x' });
    await conflict;
    expect(api.online()).toBe(false);
  });

  it('sets online to false on a network error', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.get('quotes/pricing')));
    http.expectOne('/api/lan/quotes/pricing').error(new ProgressEvent('error'));
    const error = await result;
    expect(error.status).toBe(0);
    expect(error.title).toBe('Network error');
    expect(api.online()).toBe(false);
  });

  it('sets online back to true after a later success', async () => {
    const { api, http } = setup();
    const down = failure(firstValueFrom(api.get('x')));
    http.expectOne('/api/lan/x').error(new ProgressEvent('error'));
    await down;
    expect(api.online()).toBe(false);
    const up = firstValueFrom(api.get('x'));
    http.expectOne('/api/lan/x').flush({});
    await up;
    expect(api.online()).toBe(true);
  });

  it('still gives an ApiProblem, with a generic title, for a non-json 500', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.get('x')));
    http.expectOne('/api/lan/x').flush('<html>boom</html>', { status: 500, statusText: 'Server Error' });
    const error = await result;
    expect(error.status).toBe(500);
    expect(error.title).toBe('Something went wrong');
    expect(error.detail).toBeUndefined();
    expect(error.errors).toBeUndefined();
    expect(api.online()).toBe(true);
  });

  it('treats a 503 that is not json as offline too', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.get('x')));
    http.expectOne('/api/lan/x').flush('<html>down</html>', { status: 503, statusText: 'Service Unavailable' });
    expect((await result).status).toBe(503);
    expect(api.online()).toBe(false);
  });

  it('ignores an errors map that is not a map of string lists', async () => {
    const { api, http } = setup();
    const result = failure(firstValueFrom(api.get('x')));
    http.expectOne('/api/lan/x').flush(problem(400, { errors: { A: 'x', B: [1, 'ok'] } }), { status: 400, statusText: 'x' });
    expect((await result).errors).toEqual({ A: ['x'], B: ['ok'] });
  });

  it('makes no request on the server (prerender) and does not touch online', async () => {
    const { api, http } = setup('server');
    const error = await failure(firstValueFrom(api.get('quotes/pricing')));
    expect(error.status).toBe(0);
    expect(error.title).toBe('Not available while the page is prerendered');
    http.expectNone('/api/lan/quotes/pricing');
    expect(api.online()).toBe(true);
  });
});
