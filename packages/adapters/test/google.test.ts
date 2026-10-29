import { describe, expect, it } from 'vitest';
import type { Email } from '@thp/domain';
import type { GoogleIdentity, GoogleProfile } from '@thp/ports';
import { googleIdentityContract } from '@thp/testing';
import { GoogleOAuthIdentity } from '../src/google/google-oauth-identity.ts';
import { issueLocalGoogleCode, LocalGoogleIdentity } from '../src/google/local-google-identity.ts';

const profile: GoogleProfile = {
  email: 'ana@gmail.com' as Email,
  emailVerified: true,
  name: 'Ana López',
  picture: 'https://lh3.googleusercontent.com/a/ana',
};
const secret = 'local-google-secret-for-tests';
const bodyText = (body: RequestInit['body']): string => (typeof body === 'string' ? body : '');
const credentials = {
  clientId: 'client-123.apps.googleusercontent.com',
  clientSecret: 'secret-xyz',
};

/** Google's token and userinfo endpoints, answering like the recorded real responses. */
function googleEndpoints(knownCode: string, status = 200) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    if (status !== 200) return Promise.resolve(new Response('{}', { status }));
    if (url === 'https://oauth2.googleapis.com/token') {
      const code = new URLSearchParams(bodyText(init?.body)).get('code');
      return Promise.resolve(
        code === knownCode
          ? Response.json({
              access_token: 'ya29.recorded',
              expires_in: 3599,
              token_type: 'Bearer',
              scope: 'openid email profile',
            })
          : Response.json(
              { error: 'invalid_grant', error_description: 'Bad Request' },
              { status: 400 },
            ),
      );
    }
    return Promise.resolve(
      Response.json({
        sub: '1077',
        email: profile.email,
        email_verified: profile.emailVerified,
        name: profile.name,
        picture: profile.picture,
      }),
    );
  };
  return { fetchFn, calls };
}

googleIdentityContract(
  'LocalGoogleIdentity',
  (p) => ({
    identity: new LocalGoogleIdentity('https://app.test', secret),
    code: issueLocalGoogleCode(secret, p),
  }),
  profile,
);

googleIdentityContract(
  'GoogleOAuthIdentity',
  () => ({
    identity: new GoogleOAuthIdentity(credentials, googleEndpoints('4/recorded-code').fetchFn),
    code: '4/recorded-code',
  }),
  profile,
);

describe('GoogleOAuthIdentity', () => {
  it('asks Google for the OpenID email and profile scopes with our client id', () => {
    const url = new URL(
      new GoogleOAuthIdentity(credentials).authorizationUrl('s', 'https://app.test/cb'),
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: credentials.clientId,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });
  });

  it('exchanges the code with the client secret and reads the profile with the access token', async () => {
    const google = googleEndpoints('4/recorded-code');
    await new GoogleOAuthIdentity(credentials, google.fetchFn).exchangeCode(
      '4/recorded-code',
      'https://app.test/cb',
    );

    expect(Object.fromEntries(new URLSearchParams(bodyText(google.calls[0]?.init?.body)))).toEqual({
      code: '4/recorded-code',
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: 'https://app.test/cb',
      grant_type: 'authorization_code',
    });
    expect(new Headers(google.calls[1]?.init?.headers).get('authorization')).toBe(
      'Bearer ya29.recorded',
    );
  });

  it('reports Google being down as unavailable', async () => {
    const identity = new GoogleOAuthIdentity(credentials, googleEndpoints('x', 503).fetchFn);
    expect(await identity.exchangeCode('x', 'https://app.test/cb')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });

  it('reports a network failure as unavailable and a profile without email as invalid', async () => {
    const offline = new GoogleOAuthIdentity(credentials, () =>
      Promise.reject(new Error('offline')),
    );
    expect(await offline.exchangeCode('x', 'https://app.test/cb')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });

    const noEmail = new GoogleOAuthIdentity(credentials, (input) =>
      Promise.resolve(
        (input instanceof Request ? input.url : input.toString()).includes('token')
          ? Response.json({ access_token: 't' })
          : Response.json({ sub: '1' }),
      ),
    );
    expect(await noEmail.exchangeCode('x', 'https://app.test/cb')).toEqual({
      ok: false,
      error: { code: 'invalid_code' },
    });
  });
});

describe('LocalGoogleIdentity', () => {
  it('sends the browser to the in-app test account page', () => {
    const url = new URL(
      new LocalGoogleIdentity('http://localhost:3000', secret).authorizationUrl(
        's',
        'http://localhost:3000/cb',
      ),
    );
    expect(url.origin + url.pathname).toBe('http://localhost:3000/auth/local-google');
  });

  it('rejects a code signed with another secret or tampered with', async () => {
    const identity: GoogleIdentity = new LocalGoogleIdentity('https://app.test', secret);
    const forged = issueLocalGoogleCode('another-secret-entirely', profile);
    const [body] = issueLocalGoogleCode(secret, profile).split('.');

    expect(await identity.exchangeCode(forged, 'x')).toEqual({
      ok: false,
      error: { code: 'invalid_code' },
    });
    expect(await identity.exchangeCode(`${body ?? ''}.`, 'x')).toEqual({
      ok: false,
      error: { code: 'invalid_code' },
    });
  });
});
