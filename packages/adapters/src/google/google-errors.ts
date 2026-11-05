import type { ClassroomError } from '@thp/ports';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const disabled = new Set(['SERVICE_DISABLED', 'accessNotConfigured']);
const missingScope = new Set(['ACCESS_TOKEN_SCOPE_INSUFFICIENT', 'insufficientPermissions']);

/** The first machine-readable reason in a Google API error body, if any. */
function reasonOf(body: unknown): string | undefined {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  const listed = [error.details, error.errors]
    .flatMap((list): unknown[] => (Array.isArray(list) ? (list as unknown[]) : []))
    .map((item) => (isRecord(item) ? item.reason : undefined))
    .find((reason): reason is string => typeof reason === 'string');
  return listed ?? (typeof error.status === 'string' ? error.status : undefined);
}

function codeOf(status: number, reason: string | undefined): ClassroomError['code'] {
  if (reason !== undefined && disabled.has(reason)) return 'api_disabled';
  if (reason !== undefined && missingScope.has(reason)) return 'insufficient_scope';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  return 'unavailable';
}

/**
 * Why Google refused a call: an API turned off in the Cloud project, a grant missing a scope, or
 * the plain HTTP meaning. Google's reason token (never a message or personal data) is kept so the
 * app can log it.
 */
export async function googleFailure(response: Response): Promise<ClassroomError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: the status alone decides.
  }
  const reason = reasonOf(body);
  const code = codeOf(response.status, reason);
  return reason === undefined ? { code } : { code, reason };
}
