import { HttpErrorResponse } from '@angular/common/http';

// A failed API call, as the forms see it: the fields of an RFC 9457 problem+json answer the API (or the edge) sends,
// or a generic stand-in when the answer is something else.
export interface ApiProblem {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  // Validation errors by field: { Email: ["Required"] }.
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  // Seconds, from the Retry-After header of a 503.
  readonly retryAfter?: number;
}

export const NETWORK_ERROR_TITLE = 'Network error';
export const GENERIC_ERROR_TITLE = 'Something went wrong';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Anything in the errors map that is not a string, or a list of strings, is dropped: the body is untrusted input.
function parseErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const errors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    const list = (Array.isArray(messages) ? messages : [messages]).filter((m): m is string => typeof m === 'string');
    if (list.length > 0) {
      errors[field] = list;
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}

function parseRetryAfter(value: string | null): number | undefined {
  return value !== null && /^\d{1,6}$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

export function toApiProblem(error: unknown): ApiProblem {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, title: GENERIC_ERROR_TITLE };
  }
  if (error.status === 0) {
    return { status: 0, title: NETWORK_ERROR_TITLE, detail: 'The server could not be reached.' };
  }
  const retryAfter = parseRetryAfter(error.headers?.get('retry-after') ?? null);
  const body = error.error;
  if (isRecord(body) && typeof body['title'] === 'string' && body['title'].length > 0) {
    return {
      status: error.status,
      title: body['title'],
      detail: typeof body['detail'] === 'string' ? body['detail'] : undefined,
      errors: parseErrors(body['errors']),
      retryAfter,
    };
  }
  return { status: error.status, title: GENERIC_ERROR_TITLE, retryAfter };
}

// The API is "offline" for the offline banner when the edge says 503 or nothing answers at all.
export function isOffline(problem: ApiProblem): boolean {
  return problem.status === 0 || problem.status === 503;
}
