import type { ApiProblem } from '../api/api-problem';

// The server's validation errors, sorted for a form: the messages of each field the form has, and the rest.
export interface FieldErrors {
  // Messages by field path, only for the paths the form has.
  readonly byField: Readonly<Record<string, readonly string[]>>;
  // Generic messages for errors that belong to no field (an unreadable body, a trap field, a path the form doesn't know).
  // The raw key and the server's text for it never reach the page: a visitor can do nothing with them.
  readonly other: readonly string[];
}

// One or more list indexes at the end of a path: "property.currentIssues[2]".
const INDEXES = /(?:\[\d+\])+$/;

// Sorts the `errors` of an ApiProblem (JSON paths, as ASP.NET writes them) onto the form's fields. `fieldPaths` are the
// JSON paths the form has a place for. An indexed path ("property.currentIssues[2]") goes to its list field. Anything
// else goes to `other` as one generic message, said once. The path is matched exactly: nothing else is guessed.
export function mapFieldErrors(
  errors: ApiProblem['errors'] | undefined,
  fieldPaths: readonly string[],
  otherMessage: string,
): FieldErrors {
  const byField = new Map<string, string[]>();
  let hasOther = false;
  for (const [path, messages] of Object.entries(errors ?? {})) {
    const field = path.replace(INDEXES, '');
    if (!fieldPaths.includes(field)) {
      hasOther = true;
      continue;
    }
    const list = byField.get(field) ?? [];
    for (const message of messages) {
      if (!list.includes(message)) {
        list.push(message);
      }
    }
    byField.set(field, list);
  }
  return { byField: Object.fromEntries(byField), other: hasOther ? [otherMessage] : [] };
}
