import { z } from 'zod';
import { err, ok, type LtiPlatform, type Result } from '@thp/domain';
import type {
  Clock,
  LtiMembershipsClient,
  LtiMembershipsError,
  RandomTokenGenerator,
  ToolJwtSigner,
} from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Read<T> = Promise<Result<T, LtiMembershipsError>>;

const membershipsScope =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';
const membershipsType = 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json';
const assertionType = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
/** The client assertion is good for five minutes. */
const assertionLifetimeSeconds = 300;
/** At most this many pages of a class list are read (a course rarely needs more than one). */
const maxPages = 50;

const accessToken = z.object({ access_token: z.string().min(1) });
const container = z.object({ members: z.array(z.unknown()) });

/** A refused token or list means a missing permission; anything else, try again later. */
const failureOf = (status: number): LtiMembershipsError =>
  status === 401 || status === 403 ? 'not_allowed' : 'unavailable';

/** The body as JSON in the expected shape; anything else means the course system misbehaved. */
async function parsed<T extends z.ZodType>(response: Response, shape: T): Read<z.infer<T>> {
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
function nextPage(link: string | null, current: string): string | null {
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
 * Reads a course's class list over LTI Names and Role Provisioning Services: an access token from
 * the course system's token address (client credentials, with a client assertion signed by the
 * tool's key), then each page of the list. Tokens and the people on the list are never logged.
 */
export class HttpLtiMembershipsClient implements LtiMembershipsClient {
  constructor(
    private readonly deps: {
      readonly signer: ToolJwtSigner;
      readonly clock: Clock;
      readonly tokens: RandomTokenGenerator;
      readonly fetch?: Fetch;
    },
  ) {}

  async listMembers(platform: LtiPlatform, membershipsUrl: string): Read<readonly unknown[]> {
    try {
      const token = await this.accessToken(platform);
      return token.ok ? await this.allPages(membershipsUrl, token.value) : token;
    } catch {
      // The network failed or the address could not be reached.
      return err('unavailable');
    }
  }

  private send(url: string, init: RequestInit): Promise<Response> {
    return (this.deps.fetch ?? fetch)(url, init);
  }

  private async accessToken(platform: LtiPlatform): Read<string> {
    const seconds = Math.floor(this.deps.clock.now().getTime() / 1000);
    const assertion = await this.deps.signer.sign({
      iss: platform.clientId,
      sub: platform.clientId,
      aud: platform.authTokenUrl,
      iat: seconds,
      exp: seconds + assertionLifetimeSeconds,
      jti: this.deps.tokens.generate(),
    });
    const response = await this.send(platform.authTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: assertionType,
        client_assertion: assertion,
        scope: membershipsScope,
      }).toString(),
    });
    const body = await parsed(response, accessToken);
    return body.ok ? ok(body.value.access_token) : body;
  }

  private async allPages(membershipsUrl: string, token: string): Read<readonly unknown[]> {
    const members: unknown[] = [];
    let url: string | null = membershipsUrl;
    for (let page = 0; url !== null && page < maxPages; page += 1) {
      const response = await this.send(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: membershipsType },
      });
      const body = await parsed(response, container);
      if (!body.ok) return body;
      members.push(...body.value.members);
      url = nextPage(response.headers.get('link'), url);
    }
    return ok(members);
  }
}
