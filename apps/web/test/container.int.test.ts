import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { createDatabase, signLocalWebhook } from '@thp/adapters';
import type { Email } from '@thp/domain';
import { createAppContainer } from '../src/container.ts';
import type { WebConfig } from '../src/server/config.ts';

/** The real composition root, with the local providers, against a real Postgres. */
const billingSecret = 'billing-secret-for-int-tests';
const config: WebConfig = {
  databaseUrl: inject('databaseUrl'),
  appUrl: 'http://localhost:3999',
  env: 'test',
  billing: { provider: 'local', secret: billingSecret },
  google: { provider: 'local', secret: 'google-secret-for-int-tests' },
  voice: 'nova',
};
const db = createDatabase(config.databaseUrl);
const app = createAppContainer(config, db);
afterAll(() => db.destroy());

const uniqueEmail = () => `teacher+${randomUUID().slice(0, 8)}@school.edu`;
const password = 'correct horse battery';

async function signUp(email = uniqueEmail()) {
  const result = await app.signUp.execute({
    name: 'Ana López',
    email,
    password,
    language: 'es',
    defaultSchoolName: 'Mi escuela',
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe('web container against Postgres', () => {
  it('signs a teacher up into their own school on a trial, and authenticates the session', async () => {
    const { sessionToken, school } = await signUp();

    const session = await app.authenticate.execute(sessionToken);
    expect(session.ok && session.value).toMatchObject({
      school: { id: school.id, name: 'Mi escuela' },
      access: { hasAccess: true, trialDaysLeft: 7 },
    });
  });

  it('buys a plan through the local checkout and its signed webhook', async () => {
    const { user, school, subscription, sessionToken } = await signUp();

    const checkout = await app.startCheckout.execute({
      actor: user,
      planId: 'school',
      quantity: 12,
      locale: 'es',
    });
    expect(checkout.ok && new URL(checkout.value.url).pathname).toBe('/billing/local-checkout');

    const webhook = signLocalWebhook(billingSecret, {
      type: 'checkout_completed',
      clientReference: subscription.id,
      schoolId: school.id,
      externalId: `local_sub_${randomUUID()}`,
      planId: 'school',
      quantity: 12,
      currentPeriodEnd: new Date('2027-09-01T00:00:00Z'),
    });
    expect(await app.handleBillingWebhook.execute(webhook)).toEqual({
      ok: true,
      value: { handled: true },
    });

    const session = await app.authenticate.execute(sessionToken);
    expect(session.ok && session.value.subscription).toMatchObject({
      status: 'active',
      planId: 'school',
      quantity: 12,
    });
  });

  it('logs in with the password, and logging out ends the session', async () => {
    const email = uniqueEmail();
    await signUp(email);

    const login = await app.logIn.execute({ email, password });
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    await app.logOut.execute(login.value.sessionToken);
    expect((await app.authenticate.execute(login.value.sessionToken)).ok).toBe(false);
  });

  it('signs in with the local Google stand-in', async () => {
    const issue = app.issueLocalGoogleCode;
    expect(issue).not.toBeNull();
    const code =
      issue?.({ email: uniqueEmail() as Email, emailVerified: true, name: 'Ben', picture: null }) ??
      '';

    const result = await app.signInWithGoogle.execute({
      code,
      redirectUri: `${config.appUrl}/api/auth/google/callback`,
      language: 'en',
      defaultSchoolName: 'My School',
    });
    expect(result.ok && result.value).toMatchObject({
      created: true,
      school: { name: 'My School' },
    });
  });
});
