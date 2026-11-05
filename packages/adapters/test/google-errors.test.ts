import { describe, expect, it } from 'vitest';
import { googleFailure } from '../src/google/google-errors.ts';

const reply = (status: number, error: unknown) => Response.json({ error }, { status });

describe('googleFailure', () => {
  it('names a Google API that is turned off in the Cloud project', async () => {
    expect(
      await googleFailure(
        reply(403, {
          code: 403,
          status: 'PERMISSION_DENIED',
          details: [{ reason: 'SERVICE_DISABLED' }],
        }),
      ),
    ).toEqual({ code: 'api_disabled', reason: 'SERVICE_DISABLED' });
    expect(
      await googleFailure(reply(403, { code: 403, errors: [{ reason: 'accessNotConfigured' }] })),
    ).toEqual({ code: 'api_disabled', reason: 'accessNotConfigured' });
  });

  it('asks for a reconnect when the grant lacks a scope', async () => {
    expect(
      await googleFailure(reply(403, { details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] })),
    ).toEqual({ code: 'insufficient_scope', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' });
    expect(
      await googleFailure(reply(403, { errors: [{ reason: 'insufficientPermissions' }] })),
    ).toEqual({ code: 'insufficient_scope', reason: 'insufficientPermissions' });
  });

  it('keeps Google’s status as the reason for other refusals', async () => {
    expect(await googleFailure(reply(403, { status: 'PERMISSION_DENIED' }))).toEqual({
      code: 'unauthorized',
      reason: 'PERMISSION_DENIED',
    });
    expect(await googleFailure(reply(400, { status: 'FAILED_PRECONDITION' }))).toEqual({
      code: 'unavailable',
      reason: 'FAILED_PRECONDITION',
    });
  });

  it('maps a bare status when the body says nothing', async () => {
    expect(await googleFailure(new Response('oops', { status: 401 }))).toEqual({
      code: 'unauthorized',
    });
    expect(await googleFailure(new Response('', { status: 404 }))).toEqual({ code: 'not_found' });
    expect(await googleFailure(new Response('', { status: 503 }))).toEqual({
      code: 'unavailable',
    });
  });
});
