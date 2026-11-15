import { z } from 'zod';
import { err, ok, type LtiPlatform } from '@thp/domain';
import type { LtiMembershipsClient } from '@thp/ports';
import {
  nextPage,
  parsed,
  serviceToken,
  type LtiServiceDeps,
  type ServiceRead,
} from './lti-service-http.ts';

const membershipsScope =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';
const membershipsType = 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json';
/** At most this many pages of a class list are read (a course rarely needs more than one). */
const maxPages = 50;

const container = z.object({ members: z.array(z.unknown()) });

/**
 * Reads a course's class list over LTI Names and Role Provisioning Services: an access token from
 * the course system's token address (client credentials, with a client assertion signed by the
 * tool's key), then each page of the list. Tokens and the people on the list are never logged.
 */
export class HttpLtiMembershipsClient implements LtiMembershipsClient {
  constructor(private readonly deps: LtiServiceDeps) {}

  async listMembers(
    platform: LtiPlatform,
    membershipsUrl: string,
  ): ServiceRead<readonly unknown[]> {
    try {
      const token = await serviceToken(this.deps, platform, [membershipsScope]);
      return token.ok ? await this.allPages(membershipsUrl, token.value) : token;
    } catch {
      // The network failed or the address could not be reached.
      return err('unavailable');
    }
  }

  private async allPages(membershipsUrl: string, token: string): ServiceRead<readonly unknown[]> {
    const members: unknown[] = [];
    let url: string | null = membershipsUrl;
    for (let page = 0; url !== null && page < maxPages; page += 1) {
      const response = await (this.deps.fetch ?? fetch)(url, {
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
