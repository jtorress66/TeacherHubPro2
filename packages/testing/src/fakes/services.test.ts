import { describe, expect, it } from 'vitest';
import type { Email } from '@thp/domain';
import { fileStoreContract, pdfTextExtractorContract } from '../contracts/files.contract.ts';
import {
  classroomAuthorizationContract,
  classroomContract,
  googleIdentityContract,
} from '../contracts/google.contract.ts';
import { jobQueueContract } from '../contracts/job-queue.contract.ts';
import { reportCardRendererContract } from '../contracts/gradebook.contract.ts';
import { FakeReportCardRenderer } from './documents.ts';
import {
  passwordHasherContract,
  randomTokenGeneratorContract,
  tokenHasherContract,
  secretCipherContract,
} from '../contracts/security.contract.ts';
import {
  billingEventsContract,
  checkoutSessionsContract,
  llmClientContract,
  mailerContract,
  textToSpeechContract,
} from '../contracts/services.contract.ts';
import { FixedClock } from '../fixed-clock.ts';
import { SequentialIdGenerator } from '../sequential-id-generator.ts';
import { FakeBillingEvents, FakeCheckoutSessions } from './billing.ts';
import { InMemoryFileStore, FakePdfTextExtractor } from './files.ts';
import { FakeClassroom, FakeClassroomAuthorization, FakeGoogleIdentity } from './google.ts';
import { InMemoryJobQueue } from './job-queue.ts';
import { FakeLlmClient, FakeTextToSpeech } from './ai.ts';
import { FakeMailer } from './mailer.ts';
import {
  FakePasswordHasher,
  FakeSecretCipher,
  FakeTokenHasher,
  SequentialTokenGenerator,
} from './security.ts';

llmClientContract('FakeLlmClient', {
  replying: (text) => new FakeLlmClient().replyWith(text),
  failing: (code) => new FakeLlmClient().failWith(code),
});

describe('FakeLlmClient', () => {
  it('records requests so tests can check what was sent to the model', async () => {
    const llm = new FakeLlmClient().replyWith('ok');
    await llm.complete({
      system: 's',
      messages: [{ role: 'user', content: 'student 7' }],
      maxTokens: 10,
    });

    expect(llm.requests.map((r) => r.messages[0]?.content)).toEqual(['student 7']);
  });

  it('replies in order and fails loudly when it runs out of scripted replies', async () => {
    const llm = new FakeLlmClient().replyWith('one').replyWith('two', 'max_tokens');
    const request = { system: 's', messages: [], maxTokens: 10 };

    expect(await llm.complete(request)).toEqual({
      ok: true,
      value: { text: 'one', stopReason: 'end' },
    });
    expect(await llm.complete(request)).toEqual({
      ok: true,
      value: { text: 'two', stopReason: 'max_tokens' },
    });
    await expect(llm.complete(request)).rejects.toThrow('no scripted reply');
  });
});

textToSpeechContract('FakeTextToSpeech', {
  working: () => new FakeTextToSpeech(),
  failing: (code) => new FakeTextToSpeech(code),
});

fileStoreContract('InMemoryFileStore', () => new InMemoryFileStore());

const pdf = { pdf: new Uint8Array([37, 80, 68, 70, 1]), text: 'Q1. 2 + 2 = __', pageCount: 2 };
pdfTextExtractorContract('FakePdfTextExtractor', (known) => new FakePdfTextExtractor([known]), pdf);

mailerContract('FakeMailer', {
  accepting: () => new FakeMailer(),
  rejecting: () => new FakeMailer({ reject: true }),
});

describe('FakeMailer', () => {
  it('keeps sent messages in an outbox', async () => {
    const mailer = new FakeMailer();
    await mailer.send({ to: 'p@mail.com' as Email, subject: 'Portal', html: '', text: '' });

    expect(mailer.outbox.map((m) => m.subject)).toEqual(['Portal']);
  });
});

checkoutSessionsContract('FakeCheckoutSessions', {
  working: () => new FakeCheckoutSessions(),
  failing: () => new FakeCheckoutSessions({ fail: true }),
});

describe('FakeCheckoutSessions', () => {
  it('records checkout requests', async () => {
    const checkout = new FakeCheckoutSessions();
    await checkout.createCheckout({
      planId: 'district',
      quantity: 40,
      customerEmail: 'a@d.org' as Email,
      clientReference: 'sub-1' as never,
      schoolId: 'school-1' as never,
      trialEnd: null,
      successUrl: 'https://s',
      cancelUrl: 'https://c',
    });

    expect(checkout.requests.map((r) => [r.planId, r.quantity])).toEqual([['district', 40]]);
  });
});

billingEventsContract('FakeBillingEvents', {
  make: () => new FakeBillingEvents(),
  sign: (event) => FakeBillingEvents.sign(event),
  unsupportedPayload: () => ({
    payload: JSON.stringify({ type: 'invoice.created' }),
    signature: FakeBillingEvents.signature,
  }),
});

describe('FakeBillingEvents', () => {
  it('rejects a payload that is not JSON as unsupported', () => {
    expect(new FakeBillingEvents().parseWebhook('{oops', FakeBillingEvents.signature)).toEqual({
      ok: false,
      error: { code: 'unsupported_event' },
    });
  });
});

passwordHasherContract('FakePasswordHasher', () => new FakePasswordHasher(), {
  password: 'old-pass',
  hash: 'legacy$old-pass',
});

describe('FakePasswordHasher', () => {
  it('rejects a hash it does not recognise', async () => {
    expect(await new FakePasswordHasher().verify('pw', 'garbage')).toBe(false);
  });
});

tokenHasherContract('FakeTokenHasher', () => new FakeTokenHasher());
randomTokenGeneratorContract('SequentialTokenGenerator', () => new SequentialTokenGenerator());

jobQueueContract(
  'InMemoryJobQueue',
  () =>
    new InMemoryJobQueue(
      new FixedClock(new Date('2026-09-01T08:00:00Z')),
      new SequentialIdGenerator('job'),
    ),
);

describe('InMemoryJobQueue', () => {
  it('ignores completing or failing an unknown job', async () => {
    const queue = new InMemoryJobQueue(
      new FixedClock(new Date()),
      new SequentialIdGenerator('job'),
    );

    await expect(queue.complete('nope' as never, null)).resolves.toBeUndefined();
    await expect(queue.fail('nope' as never, 'x')).resolves.toBeUndefined();
  });
});

googleIdentityContract(
  'FakeGoogleIdentity',
  (profile) => ({ identity: new FakeGoogleIdentity({ 'good-code': profile }), code: 'good-code' }),
  {
    email: 'ana@gmail.com' as Email,
    emailVerified: true,
    name: 'Ana',
    picture: null,
  },
);

classroomContract('FakeClassroom', (fixture) => new FakeClassroom(fixture), {
  accessToken: 'token-1',
  course: { id: 'c1', name: 'Math 7', section: 'B' },
  roster: [{ firstName: 'Ben', lastName: 'Ortiz' }],
});

describe('FakeClassroom', () => {
  it('rejects a roster request with a bad token and coursework for an unknown course', async () => {
    const classroom = new FakeClassroom({
      accessToken: 't',
      course: { id: 'c1', name: 'Math', section: null },
      roster: [],
    });

    expect(await classroom.listRoster('bad', 'c1')).toEqual({
      ok: false,
      error: { code: 'unauthorized' },
    });
    expect(
      await classroom.createCoursework('t', 'nope', {
        title: 'x',
        description: '',
        link: 'https://l',
        dueDate: null,
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

reportCardRendererContract('FakeReportCardRenderer', () => new FakeReportCardRenderer());

secretCipherContract('FakeSecretCipher', () => new FakeSecretCipher());

classroomAuthorizationContract('FakeClassroomAuthorization', () => ({
  authorization: new FakeClassroomAuthorization(),
  code: 'classroom-code',
}));
