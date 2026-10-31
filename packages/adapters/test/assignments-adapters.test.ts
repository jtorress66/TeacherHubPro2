import { randomBytes } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  classroomAuthorizationContract,
  classroomContract,
  pdfTextExtractorContract,
  secretCipherContract,
} from '@thp/testing';
import { AesGcmCipher } from '../src/crypto/aes-gcm-cipher.ts';
import { GoogleClassroom } from '../src/google/google-classroom.ts';
import { GoogleClassroomAuthorization } from '../src/google/google-classroom-authorization.ts';
import {
  LocalClassroom,
  LocalClassroomAuthorization,
  localClassroomFixture,
} from '../src/google/local-classroom.ts';
import { UnpdfTextExtractor } from '../src/pdf/unpdf-text-extractor.ts';

async function makePdf(pages: readonly string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = doc.addPage([400, 200]);
    if (text !== '') page.drawText(text, { x: 20, y: 150, size: 14, font });
  }
  return doc.save();
}

const quiz = await makePdf(['Quiz text', '']);

pdfTextExtractorContract('UnpdfTextExtractor', () => new UnpdfTextExtractor(), {
  pdf: quiz,
  text: 'Quiz text',
  pageCount: 2,
});

describe('UnpdfTextExtractor', () => {
  it('reads every page in order', async () => {
    const pdf = await makePdf(['First page', 'Second page']);
    const result = await new UnpdfTextExtractor().extract(pdf);
    expect(result.ok && result.value.text).toBe('First page\nSecond page');
  });

  it('gives empty text for a PDF without text, such as a scan', async () => {
    const result = await new UnpdfTextExtractor().extract(await makePdf(['']));
    expect(result).toEqual({ ok: true, value: { text: '', pageCount: 1 } });
  });

  it('refuses a PDF over the size limit before opening it', async () => {
    const result = await new UnpdfTextExtractor({ maxBytes: 10 }).extract(quiz);
    expect(result).toEqual({ ok: false, error: { code: 'too_large' } });
  });
});

const key = randomBytes(32).toString('base64');
secretCipherContract('AesGcmCipher', () => new AesGcmCipher(key));

describe('AesGcmCipher', () => {
  it('needs a 32-byte key and cannot open another key’s secrets', async () => {
    expect(() => new AesGcmCipher('short')).toThrow('TOKEN_ENCRYPTION_KEY');
    const sealed = await new AesGcmCipher(key).encrypt('secret');
    const other = new AesGcmCipher(randomBytes(32).toString('base64'));
    expect(await other.decrypt(sealed)).toEqual({ ok: false, error: { code: 'invalid' } });
  });
});

/** Google Classroom's REST API, answering like the recorded real responses. */
function classroomApi(accessToken: string) {
  const posted: unknown[] = [];
  const answer = (input: string | URL | Request, init?: RequestInit): Response => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const auth = new Headers(init?.headers).get('authorization');
    if (auth !== `Bearer ${accessToken}`) {
      return Response.json({ error: { code: 401, status: 'UNAUTHENTICATED' } }, { status: 401 });
    }
    if (url.pathname === '/v1/courses') {
      return Response.json({
        courses: [{ id: 'c-1', name: 'Science 5', section: 'A', courseState: 'ACTIVE' }],
      });
    }
    if (url.pathname === '/v1/courses/c-1/students') {
      return Response.json({
        students: [
          {
            userId: 'u1',
            profile: { name: { givenName: 'Ana', familyName: 'Zayas', fullName: 'Ana Zayas' } },
          },
          {
            userId: 'u2',
            profile: { name: { givenName: 'Ben', familyName: 'Acosta', fullName: 'Ben Acosta' } },
          },
        ],
      });
    }
    if (url.pathname === '/v1/courses/c-1/courseWork' && init?.method === 'POST') {
      posted.push(JSON.parse(typeof init.body === 'string' ? init.body : '{}'));
      return Response.json({
        id: 'cw-1',
        alternateLink: 'https://classroom.google.com/c/c-1/a/cw-1',
      });
    }
    return Response.json({ error: { code: 404, status: 'NOT_FOUND' } }, { status: 404 });
  };
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
    Promise.resolve(answer(input, init));
  return { fetchFn, posted };
}

const fixture = {
  accessToken: 'ya29.recorded',
  course: { id: 'c-1', name: 'Science 5', section: 'A' },
  roster: [
    { firstName: 'Ana', lastName: 'Zayas' },
    { firstName: 'Ben', lastName: 'Acosta' },
  ],
};

classroomContract(
  'GoogleClassroom',
  (f) => new GoogleClassroom(classroomApi(f.accessToken).fetchFn),
  fixture,
);
classroomContract('LocalClassroom', () => new LocalClassroom(), localClassroomFixture);

describe('GoogleClassroom', () => {
  it('posts coursework with the link and due date, as published', async () => {
    const api = classroomApi(fixture.accessToken);
    await new GoogleClassroom(api.fetchFn).createCoursework(fixture.accessToken, 'c-1', {
      title: 'Quiz',
      description: 'Use your personal link.',
      link: 'https://app.test',
      dueDate: '2026-09-30' as never,
    });
    expect(api.posted[0]).toEqual({
      title: 'Quiz',
      description: 'Use your personal link.',
      materials: [{ link: { url: 'https://app.test' } }],
      workType: 'ASSIGNMENT',
      state: 'PUBLISHED',
      dueDate: { year: 2026, month: 9, day: 30 },
      dueTime: { hours: 23, minutes: 59 },
    });
  });

  it('reports a server error as unavailable', async () => {
    const failing = () => Promise.resolve(new Response('{}', { status: 503 }));
    expect(await new GoogleClassroom(failing).listCourses('t')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });
});

/** Google's OAuth token endpoint, answering like the recorded real responses. */
function tokenEndpoint(knownCode: string) {
  return (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const form = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    if (form.get('grant_type') === 'authorization_code' && form.get('code') === knownCode) {
      return Promise.resolve(
        Response.json({ access_token: 'ya29.a', refresh_token: '1//refresh', expires_in: 3599 }),
      );
    }
    if (form.get('grant_type') === 'refresh_token' && form.get('refresh_token') === '1//refresh') {
      return Promise.resolve(Response.json({ access_token: 'ya29.b', expires_in: 3599 }));
    }
    return Promise.resolve(Response.json({ error: 'invalid_grant' }, { status: 400 }));
  };
}

const credentials = { clientId: 'client-1', clientSecret: 'secret-1' };

classroomAuthorizationContract('GoogleClassroomAuthorization', () => ({
  authorization: new GoogleClassroomAuthorization(credentials, tokenEndpoint('good-code')),
  code: 'good-code',
}));
classroomAuthorizationContract('LocalClassroomAuthorization', () => ({
  authorization: new LocalClassroomAuthorization(),
  code: 'local-classroom-code',
}));

describe('GoogleClassroomAuthorization', () => {
  it('asks for offline access with only the Classroom scopes it needs', () => {
    const url = new URL(
      new GoogleClassroomAuthorization(credentials, tokenEndpoint('x')).authorizationUrl(
        's',
        'https://app.test/cb',
      ),
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students',
    ]);
  });

  it('treats a code exchange without a refresh token, or an unreachable Google, as a failure', async () => {
    const noRefresh = () => Promise.resolve(Response.json({ access_token: 'only' }));
    expect(
      await new GoogleClassroomAuthorization(credentials, noRefresh).exchangeCode(
        'c',
        'https://app.test/cb',
      ),
    ).toEqual({ ok: false, error: { code: 'unauthorized' } });
    const down = () => Promise.reject(new Error('network'));
    expect(await new GoogleClassroomAuthorization(credentials, down).accessToken('r')).toEqual({
      ok: false,
      error: { code: 'unavailable' },
    });
  });

  it('sends the local stand-in straight back to the app with its code', () => {
    const url = new URL(
      new LocalClassroomAuthorization().authorizationUrl('s-1', 'https://app.test/cb'),
    );
    expect(url.origin + url.pathname).toBe('https://app.test/cb');
    expect(url.searchParams.get('code')).toBe('local-classroom-code');
  });
});
