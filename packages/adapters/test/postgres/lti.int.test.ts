import { createLocalJWKSet, jwtVerify } from 'jose';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { LtiPlatformId } from '@thp/domain';
import {
  anLtiPlatform,
  FakeSecretCipher,
  FixedClock,
  SequentialTokenGenerator,
} from '@thp/testing';
import { createPostgresRepositories, PostgresToolKeyStore } from '../../src/postgres/index.ts';
import { connect, parentsFor, resetWith, schoolA, schoolB } from './test-db.ts';

const db = connect();
const repos = createPostgresRepositories(db);
afterAll(() => db.destroy());
beforeEach(() => resetWith(db, parentsFor.accounts));

describe('LTI tables', () => {
  it('registers an issuer and client ID pair once, across schools', async () => {
    await repos.ltiPlatforms.save(anLtiPlatform({ schoolId: schoolA }));

    await expect(
      repos.ltiPlatforms.save(
        anLtiPlatform({ id: 'lti-platform-2' as LtiPlatformId, schoolId: schoolB }),
      ),
    ).rejects.toThrow(/lti_platforms_issuer_client_id_key/u);
  });

  it('never moves a platform to another school by saving it there', async () => {
    const platform = anLtiPlatform({ schoolId: schoolA });
    await repos.ltiPlatforms.save(platform);

    await repos.ltiPlatforms.save({ ...platform, schoolId: schoolB, name: 'Taken over' });

    expect(await repos.ltiPlatforms.findById(schoolA, platform.id)).toEqual(platform);
    expect(await repos.ltiPlatforms.findById(schoolB, platform.id)).toBeNull();
  });

  it('keeps the tool’s private key only encrypted', async () => {
    const cipher = new FakeSecretCipher();
    const store = new PostgresToolKeyStore(db, {
      cipher,
      tokens: new SequentialTokenGenerator(),
      clock: new FixedClock(new Date('2026-11-12T12:00:00Z')),
    });
    const [published] = (await store.publicKeySet()).keys;

    const row = await db.selectFrom('tool_keys').selectAll().executeTakeFirstOrThrow();
    expect(row.kid).toBe(published?.kid);
    expect(row.private_key_encrypted).not.toContain('"d"');
    const opened = await cipher.decrypt(row.private_key_encrypted);
    expect(opened.ok && JSON.parse(opened.value)).toMatchObject({ kty: 'RSA', n: published?.n });
    expect(opened.ok && JSON.parse(opened.value)).toHaveProperty('d');
  });

  it('signs with its private key, so its published key set verifies the signature', async () => {
    const store = new PostgresToolKeyStore(db, {
      cipher: new FakeSecretCipher(),
      tokens: new SequentialTokenGenerator(),
      clock: new FixedClock(new Date('2026-11-12T12:00:00Z')),
    });
    const token = await store.sign({ iss: 'client-1', aud: 'https://lms.example.edu/token' });

    const keys = createLocalJWKSet({ keys: [...(await store.publicKeySet()).keys] });
    const { payload } = await jwtVerify(token, keys, { algorithms: ['RS256'] });
    expect(payload).toEqual({ iss: 'client-1', aud: 'https://lms.example.edu/token' });
    expect(await db.selectFrom('tool_keys').select('kid').execute()).toHaveLength(1);
  });

  it('clears used nonces once they have expired', async () => {
    await repos.ltiNonces.claim('old', new Date('2020-01-01T00:00:00Z'));
    await repos.ltiNonces.claim('fresh', new Date('2099-01-01T00:00:00Z'));

    const left = await db.selectFrom('lti_nonces').select('nonce').execute();
    expect(left.map((row) => row.nonce)).toEqual(['fresh']);
  });
});
