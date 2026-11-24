import { describe, expect, it } from 'vitest';
import {
  maxAttachmentBytes,
  maxCurriculumExcerpt,
  type CurriculumGuideId,
  type User,
} from '@thp/domain';
import { FakeDocumentTextExtractor } from '@thp/testing';
import {
  CurriculumReadHandler,
  ListCurriculumGuides,
  RemoveCurriculumGuide,
  UploadCurriculumGuide,
  curriculumReadJobKind,
  type CurriculumSource,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const forbidden = { ok: false, error: { code: 'forbidden' } };
const guideText =
  'Unit 1 (weeks 1-4): Place value to one million. Unit 2 (weeks 5-8): Multiplying.';
const pdfBytes = new Uint8Array([37, 80, 68, 70, 1]);
const wordBytes = new Uint8Array([80, 75, 3, 4, 9]);
const pdfText = `${guideText} From the PDF.`;
const wordText = `${guideText} From the Word file.`;

async function school() {
  const world = makeWorld();
  const { user: owner } = await signedUp(world);
  return {
    world,
    owner,
    admin: colleagueOf(owner, 'school_admin'),
    teacher: colleagueOf(owner),
  };
}

const pasted = (text = guideText): CurriculumSource => ({ kind: 'text', text });
const file = (fileName: string, bytes = pdfBytes): CurriculumSource => ({
  kind: 'file',
  fileName,
  bytes,
});

const upload = (
  world: World,
  actor: User,
  source: CurriculumSource,
  fields: Partial<{ subject: string; grade: string; title: string }> = {},
) =>
  new UploadCurriculumGuide(world).execute({
    actor,
    subject: 'math',
    grade: '4',
    title: 'Grade 4 math pacing guide',
    source,
    ...fields,
  });

const list = (world: World, actor: User) => new ListCurriculumGuides(world).execute({ actor });

function handler(world: World) {
  return new CurriculumReadHandler({
    ...world,
    readers: {
      pdf: new FakeDocumentTextExtractor([{ bytes: pdfBytes, text: pdfText }]),
      docx: new FakeDocumentTextExtractor([{ bytes: wordBytes, text: wordText }]),
    },
  });
}

/** Runs every queued curriculum job, as the worker would. */
async function readFiles(world: World): Promise<void> {
  for (let job = await world.jobs.claimNext([curriculumReadJobKind]); job !== null;) {
    const done = await handler(world).handle(job);
    if (done.ok) await world.jobs.complete(job.id, done.value);
    job = await world.jobs.claimNext([curriculumReadJobKind]);
  }
}

describe('UploadCurriculumGuide', () => {
  it('saves pasted text as a ready guide, for the school owner or an admin', async () => {
    const { world, owner, admin } = await school();

    const guide = valueOf(await upload(world, owner, pasted()));
    valueOf(await upload(world, admin, pasted(), { subject: 'science', grade: 'K' }));

    expect(guide).toMatchObject({
      schoolId: owner.schoolId,
      subject: 'math',
      grade: '4',
      title: 'Grade 4 math pacing guide',
      status: 'ready',
      text: guideText,
      sourceName: null,
    });
    expect((await list(world, owner)).guides.map((g) => `${g.subject} ${g.grade}`)).toEqual([
      'math 4',
      'science K',
    ]);
  });

  it('reads an uploaded PDF or Word file in the background, then deletes the file', async () => {
    const { world, owner } = await school();

    const pdf = valueOf(await upload(world, owner, file('Pacing guide.pdf')));
    const word = valueOf(
      await upload(world, owner, file('Scope and sequence.docx', wordBytes), { grade: '5' }),
    );

    expect([pdf.status, word.status]).toEqual(['reading', 'reading']);
    if (pdf.jobId === null) throw new Error('no reading job');
    const job = await world.jobs.findForOwner(owner.schoolId, owner.id, pdf.jobId);
    if (job === null) throw new Error('no job');
    expect(job.kind).toBe(curriculumReadJobKind);
    expect(job.payload).not.toHaveProperty('bytes');

    await readFiles(world);

    const guides = (await list(world, owner)).guides;
    expect(guides.map((g) => [g.sourceName, g.status, g.text])).toEqual([
      ['Pacing guide.pdf', 'ready', pdfText],
      ['Scope and sequence.docx', 'ready', wordText],
    ]);
    const payload = job.payload as { fileKey: string };
    expect(payload.fileKey.startsWith(`curriculum/${owner.schoolId}/`)).toBe(true);
    expect((await world.files.get(payload.fileKey)).ok).toBe(false);
  });

  it('marks a guide whose file cannot be read, or has no text, as failed', async () => {
    const { world, owner } = await school();
    valueOf(await upload(world, owner, file('Broken.pdf', new Uint8Array([1, 2, 3]))));
    const reader = new FakeDocumentTextExtractor([{ bytes: pdfBytes, text: '  ' }]);
    valueOf(await upload(world, owner, file('Scan.pdf'), { grade: '5' }));

    for (let job = await world.jobs.claimNext([curriculumReadJobKind]); job !== null;) {
      await new CurriculumReadHandler({
        ...world,
        readers: { pdf: reader, docx: reader },
      }).handle(job);
      job = await world.jobs.claimNext([curriculumReadJobKind]);
    }

    expect((await list(world, owner)).guides.map((g) => [g.status, g.failure])).toEqual([
      ['failed', 'unreadable'],
      ['failed', 'no_text'],
    ]);
  });

  it('accepts only PDF and Word (.docx) files up to the attachment size', async () => {
    const { world, owner } = await school();

    expect(await upload(world, owner, file('notes.txt'))).toEqual({
      ok: false,
      error: { field: 'file', code: 'not_allowed' },
    });
    expect(await upload(world, owner, file('old.doc'))).toEqual({
      ok: false,
      error: { field: 'file', code: 'not_allowed' },
    });
    expect(
      await upload(world, owner, file('big.pdf', new Uint8Array(maxAttachmentBytes + 1))),
    ).toEqual({ ok: false, error: { field: 'file', code: 'too_large' } });
    expect(await upload(world, owner, file('empty.pdf', new Uint8Array()))).toEqual({
      ok: false,
      error: { field: 'file', code: 'required' },
    });
    expect((await list(world, owner)).guides).toEqual([]);
  });

  it('checks the fields before keeping any file or starting a job', async () => {
    const { world, owner } = await school();

    expect(await upload(world, owner, file('Guide.pdf'), { title: ' ' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(await upload(world, owner, pasted('short'))).toEqual({
      ok: false,
      error: { field: 'text', code: 'too_short' },
    });
    expect(await world.jobs.claimNext([curriculumReadJobKind])).toBeNull();
  });

  it('replaces the guide for the same subject and grade, and ignores the old file’s job', async () => {
    const { world, owner } = await school();
    const first = valueOf(await upload(world, owner, file('Old guide.pdf')));

    const second = valueOf(
      await upload(world, owner, file('New guide.docx', wordBytes), { title: 'New guide' }),
    );
    await readFiles(world);

    expect(second.id).toBe(first.id);
    const guides = (await list(world, owner)).guides;
    expect(guides.map((g) => [g.title, g.sourceName, g.text])).toEqual([
      ['New guide', 'New guide.docx', wordText],
    ]);
  });

  it('is not open to teachers who do not own the school', async () => {
    const { world, teacher } = await school();

    expect(await upload(world, teacher, pasted())).toEqual(forbidden);
  });

  it('writes each upload in the activity log, without the guide’s text', async () => {
    const { world, owner } = await school();

    const guide = valueOf(await upload(world, owner, pasted()));

    const [event] = await world.auditLog.listForSchool(owner.schoolId, 10);
    expect(event).toMatchObject({
      actorId: owner.id,
      action: 'curriculum_uploaded',
      targetId: guide.id,
    });
  });
});

describe('ListCurriculumGuides', () => {
  it("shows every teacher the school's guides, and says who may change them", async () => {
    const { world, owner, teacher } = await school();
    valueOf(await upload(world, owner, pasted()));

    const forTeacher = await list(world, teacher);
    const forOwner = await list(world, owner);

    expect(forTeacher.guides).toHaveLength(1);
    expect(forTeacher.canManage).toBe(false);
    expect(forOwner.canManage).toBe(true);
  });

  it("never shows another school's guides", async () => {
    const { world, owner } = await school();
    valueOf(await upload(world, owner, pasted()));
    const { user: stranger } = await signedUp(world, 'other@school.edu');

    expect((await list(world, stranger)).guides).toEqual([]);
  });

  it('says how much of a long guide the AI reads', async () => {
    const { world, owner } = await school();
    valueOf(await upload(world, owner, pasted('fractions '.repeat(4000))));

    const [entry] = (await list(world, owner)).guides;

    expect(entry?.usage.total).toBe('fractions '.repeat(4000).trim().length);
    expect(entry?.usage.used).toBeLessThanOrEqual(maxCurriculumExcerpt);
  });
});

describe('RemoveCurriculumGuide', () => {
  const remove = (world: World, actor: User, guideId: CurriculumGuideId) =>
    new RemoveCurriculumGuide(world).execute({ actor, guideId });

  it('removes a guide and logs it', async () => {
    const { world, owner, admin } = await school();
    const guide = valueOf(await upload(world, owner, pasted()));

    expect(await remove(world, admin, guide.id)).toEqual({ ok: true, value: true });

    expect((await list(world, owner)).guides).toEqual([]);
    const events = await world.auditLog.listForSchool(owner.schoolId, 10);
    expect(events.find((e) => e.action === 'curriculum_removed')).toMatchObject({
      actorId: admin.id,
      targetId: guide.id,
    });
  });

  it("is not open to teachers, and cannot reach another school's guide", async () => {
    const { world, owner, teacher } = await school();
    const guide = valueOf(await upload(world, owner, pasted()));
    const { user: stranger } = await signedUp(world, 'other@school.edu');

    expect(await remove(world, teacher, guide.id)).toEqual(forbidden);
    expect(await remove(world, stranger, guide.id)).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect((await list(world, owner)).guides).toHaveLength(1);
  });

  it('leaves a removed guide removed when its file is read afterwards', async () => {
    const { world, owner } = await school();
    const guide = valueOf(await upload(world, owner, file('Guide.pdf')));

    valueOf(await remove(world, owner, guide.id));
    await readFiles(world);

    expect((await list(world, owner)).guides).toEqual([]);
  });
});
