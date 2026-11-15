import { z } from 'zod';
import {
  err,
  isSecureAddress,
  ltiAgsScope,
  matchingLineItem,
  ok,
  type LtiPlatform,
  type LtiScore,
} from '@thp/domain';
import type { LtiGradesClient, LtiGradesRequest, LtiGradesSent } from '@thp/ports';
import {
  nextPage,
  parsed,
  serviceToken,
  type LtiServiceDeps,
  type ServiceRead,
} from './lti-service-http.ts';

const containerType = 'application/vnd.ims.lis.v2.lineitemcontainer+json';
const lineItemType = 'application/vnd.ims.lis.v2.lineitem+json';
const scoreType = 'application/vnd.ims.lis.v1.score+json';
/** At most this many pages of columns are read while looking for the assignment's. */
const maxPages = 20;
/** Each request gets this long before it counts as unavailable. */
const timeoutMs = 15_000;
/** Answers worth one more try: rate limits and a busy or restarting server. */
const transient: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

const columns = z.array(z.unknown());
const created = z.object({ id: z.string() });

/** Where a column's scores go: `/scores` added to its path, its query kept (Moodle has one). */
function scoresUrl(lineItemUrl: string): string {
  const url = new URL(lineItemUrl);
  url.pathname = `${url.pathname.replace(/\/$/u, '')}/scores`;
  return url.toString();
}

const sameOrigin = (url: string, other: string) => new URL(url).origin === new URL(other).origin;

/**
 * Sends scores to a course's gradebook over LTI Assignment and Grade Services: an access token
 * (client credentials, scopes to manage columns and post scores), the assignment's column, found
 * by its `resourceId` or made, then one score per student under the course system's own id for
 * them. Sending again updates the scores. Tokens and scores are never logged.
 */
export class HttpLtiGradesClient implements LtiGradesClient {
  constructor(private readonly deps: LtiServiceDeps) {}

  async sendScores(platform: LtiPlatform, request: LtiGradesRequest): ServiceRead<LtiGradesSent> {
    if (request.scores.length === 0) return ok({ sent: 0, failed: 0 });
    try {
      const token = await serviceToken(
        this.deps,
        platform,
        [ltiAgsScope.lineItem, ltiAgsScope.score],
        { signal: AbortSignal.timeout(timeoutMs) },
      );
      if (!token.ok) return token;
      const column = await this.column(request, token.value);
      if (!column.ok) return column;
      return ok(await this.postScores(column.value, request.scores, token.value));
    } catch {
      // The network failed, timed out, or the address could not be reached.
      return err('unavailable');
    }
  }

  private send(url: string, init: RequestInit): Promise<Response> {
    return (this.deps.fetch ?? fetch)(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }

  /** The assignment's column: the one already there, or a new one. */
  private async column(request: LtiGradesRequest, token: string): ServiceRead<string> {
    const found = await this.findColumn(request, token);
    if (!found.ok) return found;
    if (found.value !== null) return ok(found.value);
    const response = await this.send(request.lineItemsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': lineItemType,
        Accept: lineItemType,
      },
      body: JSON.stringify(request.lineItem),
    });
    const body = await parsed(response, created);
    if (!body.ok) return body;
    const { id } = body.value;
    return isSecureAddress(id) && sameOrigin(id, request.lineItemsUrl)
      ? ok(id)
      : err('unavailable');
  }

  /** Reads the columns named for the assignment, page by page, on the gradebook's own site. */
  private async findColumn(request: LtiGradesRequest, token: string): ServiceRead<string | null> {
    const first = new URL(request.lineItemsUrl);
    first.searchParams.set('resource_id', request.lineItem.resourceId);
    let url: string | null = first.toString();
    for (let page = 0; url !== null && page < maxPages; page += 1) {
      const response = await this.send(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: containerType },
      });
      const body = await parsed(response, columns);
      if (!body.ok) return body;
      const id = matchingLineItem(body.value, request.lineItem.resourceId, request.lineItemsUrl);
      if (id !== null) return ok(id);
      url = nextPage(response.headers.get('link'), url);
    }
    return ok(null);
  }

  private async postScores(
    lineItemUrl: string,
    scores: readonly LtiScore[],
    token: string,
  ): Promise<LtiGradesSent> {
    const target = scoresUrl(lineItemUrl);
    let sent = 0;
    for (const score of scores) {
      if (await this.postScore(target, score, token)) sent += 1;
    }
    return { sent, failed: scores.length - sent };
  }

  /** One score, tried once more after a brief failure; false when it did not go in. */
  private async postScore(url: string, score: LtiScore, token: string): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.send(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': scoreType },
          body: JSON.stringify(score),
        });
        if (response.ok) return true;
        if (!transient.has(response.status)) return false;
      } catch {
        // A dropped connection or a timeout: worth one more try.
      }
    }
    return false;
  }
}
