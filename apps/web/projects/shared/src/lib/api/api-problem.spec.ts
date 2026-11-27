import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { GENERIC_ERROR_TITLE, NETWORK_ERROR_TITLE, isOffline, toApiProblem } from './api-problem';

function response(status: number, error: unknown, headers: Record<string, string> = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, headers: new HttpHeaders(headers), statusText: 'x' });
}

describe('toApiProblem', () => {
  it('reads the title and the detail of a problem+json body', () => {
    const problem = toApiProblem(response(429, { title: 'Too Many Requests', detail: 'Wait a bit.' }));
    expect(problem).toMatchObject({ status: 429, title: 'Too Many Requests', detail: 'Wait a bit.' });
  });

  it('leaves the detail out when it is not a string', () => {
    expect(toApiProblem(response(400, { title: 'Bad', detail: 5 })).detail).toBeUndefined();
  });

  it('reads the errors map, by JSON path, as lists of messages', () => {
    const problem = toApiProblem(
      response(400, { title: 'Invalid', errors: { 'customer.email': ['Enter a valid email address.'], 'property.currentIssues[2]': ['Nope', 'Again'] } }),
    );
    expect(problem.errors).toEqual({
      'customer.email': ['Enter a valid email address.'],
      'property.currentIssues[2]': ['Nope', 'Again'],
    });
  });

  it('keeps a lone string message as a one-item list and drops what is not a string', () => {
    const problem = toApiProblem(response(400, { title: 'Invalid', errors: { a: 'one', b: [1, null, 'two'], c: [1], d: {} } }));
    expect(problem.errors).toEqual({ a: ['one'], b: ['two'] });
  });

  it('has no errors when the map is empty or is not an object', () => {
    expect(toApiProblem(response(400, { title: 'x', errors: {} })).errors).toBeUndefined();
    expect(toApiProblem(response(400, { title: 'x', errors: ['a'] })).errors).toBeUndefined();
    expect(toApiProblem(response(400, { title: 'x', errors: 'a' })).errors).toBeUndefined();
  });

  it('reads Retry-After in whole seconds', () => {
    expect(toApiProblem(response(429, { title: 'x' }, { 'Retry-After': '45' })).retryAfter).toBe(45);
    expect(toApiProblem(response(503, { title: 'x' }, { 'retry-after': ' 30 ' })).retryAfter).toBe(30);
  });

  it('ignores a Retry-After that is not whole seconds (a date, a fraction, a sign, too long)', () => {
    for (const bad of ['Wed, 21 Oct 2026 07:28:00 GMT', '1.5', '-3', '', '1234567']) {
      expect(toApiProblem(response(429, { title: 'x' }, { 'Retry-After': bad })).retryAfter, bad).toBeUndefined();
    }
  });

  it('keeps Retry-After when the body is not a problem', () => {
    expect(toApiProblem(response(503, '<html>down</html>', { 'Retry-After': '30' }))).toEqual({
      status: 503,
      title: GENERIC_ERROR_TITLE,
      retryAfter: 30,
    });
  });

  it('gives a generic problem for a body that is not json, or has no title', () => {
    for (const body of ['<html>boom</html>', null, 7, [], { detail: 'no title' }, { title: '' }, { title: 3 }]) {
      const problem = toApiProblem(response(500, body));
      expect(problem.status).toBe(500);
      expect(problem.title).toBe(GENERIC_ERROR_TITLE);
      expect(problem.detail).toBeUndefined();
      expect(problem.errors).toBeUndefined();
    }
  });

  it('turns status 0 into a network problem', () => {
    expect(toApiProblem(response(0, new ProgressEvent('error')))).toEqual({
      status: 0,
      title: NETWORK_ERROR_TITLE,
      detail: 'The server could not be reached.',
    });
  });

  it('turns anything that is not an HttpErrorResponse into a status 0 generic problem', () => {
    expect(toApiProblem(new Error('boom'))).toEqual({ status: 0, title: GENERIC_ERROR_TITLE });
    expect(toApiProblem(undefined)).toEqual({ status: 0, title: GENERIC_ERROR_TITLE });
  });
});

describe('isOffline', () => {
  it('counts status 0 and 503 as offline', () => {
    expect(isOffline({ status: 0, title: 'x' })).toBe(true);
    expect(isOffline({ status: 503, title: 'x' })).toBe(true);
  });

  it('does not count an answer from the API', () => {
    for (const status of [200, 400, 404, 409, 429, 500, 502, 504]) {
      expect(isOffline({ status, title: 'x' }), String(status)).toBe(false);
    }
  });
});
