import { z } from 'zod';
import { err, ok, type LtiPlatform, type Result } from '@thp/domain';
import type { Clock, RandomTokenGenerator, ToolJwtSigner } from '@thp/ports';

// What the LTI Advantage service clients share: the OAuth 2 client credentials grant with a
// client assertion signed by the tool's key, reading answers, and following pages on the same site.

export type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** A refused request means a missing permission; anything else, try again later. */
export type LtiServiceError = 'not_allowed' | 'unavailable';

export type ServiceRead<T> = Promise<Result<T, LtiServiceError>>;

export interface LtiServiceDeps {
  readonly signer: ToolJwtSigner;
  readonly clock: Clock;
  readonly tokens: RandomTokenGenerator;
  readonly fetch?: Fetch;
}

const assertionType = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
/** The client assertion is good for five minutes. */
const assertionLifetimeSeconds = 300;

const accessTokenShape = z.object({ access_token: z.string().min(1) });

export const failureOf = (status: number): LtiServiceError =>
  status === 401 || status === 403 ? 'not_allowed' : 'unavailable';

/** The body as JSON in the expected shape; anything else means the course system misbehaved. */
export async function parsed<T extends z.ZodType>(
  response: Response,
  shape: T,
): ServiceRead<z.infer<T>> {
  if (!response.ok) return err(failureOf(response.status));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return err('unavailable');
  }
  const checked = shape.safeParse(body);
  return checked.success ? ok(checked.data) : err('unavailable');
}

/** The next page, from a `Link: <…>; rel="next"` header, only on the list's own site. */
export function nextPage(link: string | null, current: string): string | null {
  for (const part of link?.split(',') ?? []) {
    const match = /^<([^>]+)>(.*)$/u.exec(part.trim());
    if (match?.[1] === undefined || !/;\s*rel="?next"?/u.test(match[2] ?? '')) continue;
    if (!URL.canParse(match[1], current)) return null;
    const next = new URL(match[1], current);
    return next.origin === new URL(current).origin ? next.toString() : null;
  }
  return null;
}

/**
 * An access token for the course system's services, for these scopes: client credentials, with a
 * client assertion signed by the tool's key. The token is never logged.
 */
export async function serviceToken(
  deps: LtiServiceDeps,
  platform: LtiPlatform,
  scopes: readonly string[],
  init: RequestInit = {},
): ServiceRead<string> {
  const seconds = Math.floor(deps.clock.now().getTime() / 1000);
  const assertion = await deps.signer.sign({
    iss: platform.clientId,
    sub: platform.clientId,
    aud: platform.authTokenUrl,
    iat: seconds,
    exp: seconds + assertionLifetimeSeconds,
    jti: deps.tokens.generate(),
  });
  const response = await (deps.fetch ?? fetch)(platform.authTokenUrl, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: assertionType,
      client_assertion: assertion,
      scope: scopes.join(' '),
    }).toString(),
  });
  const body = await parsed(response, accessTokenShape);
  return body.ok ? ok(body.value.access_token) : body;
}
