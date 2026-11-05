import { describe, expect, it } from 'vitest';
import { err, ok } from '@thp/domain';
import type { ClassroomCoursework, GoogleDriveFiles, GoogleSlidesFiles } from '@thp/ports';
import { loggedCoursework, loggedDrive, loggedSlides } from './google-failure-log.ts';

const docx = { name: 'test.docx', bytes: new Uint8Array([0x50, 0x4b]) };
const request = {
  title: 'Unit 3',
  description: '',
  material: { kind: 'driveFile' as const, driveFileId: 'd1', shareMode: 'copy' as const },
  dueDate: null,
};

describe('Google failure log', () => {
  it('writes the failing step, code and Google reason, and passes the result through', async () => {
    const lines: string[] = [];
    const drive: GoogleDriveFiles = {
      uploadWordDocument: () =>
        Promise.resolve(err({ code: 'api_disabled', reason: 'SERVICE_DISABLED' })),
    };

    const result = await loggedDrive(drive, (line) => lines.push(line)).uploadWordDocument(
      't',
      docx,
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'api_disabled', reason: 'SERVICE_DISABLED' },
    });
    expect(lines).toEqual(['Google Drive upload failed: api_disabled (SERVICE_DISABLED)\n']);
  });

  it('logs a refused Slides deck the same way, without its title or text', async () => {
    const lines: string[] = [];
    const slides: GoogleSlidesFiles = {
      createPresentation: (token) =>
        Promise.resolve(
          token === 'ok'
            ? ok({ id: 'deck', url: 'https://d' })
            : err({ code: 'api_disabled', reason: 'SERVICE_DISABLED' }),
        ),
    };
    const logged = loggedSlides(slides, (line) => lines.push(line));
    const deck = {
      name: 'Volcanoes',
      colours: { background: '#000000', text: '#ffffff' },
      slides: [],
    };

    expect((await logged.createPresentation('ok', deck)).ok).toBe(true);
    expect(await logged.createPresentation('secret-token', deck)).toEqual({
      ok: false,
      error: { code: 'api_disabled', reason: 'SERVICE_DISABLED' },
    });
    expect(lines).toEqual(['Google Slides deck failed: api_disabled (SERVICE_DISABLED)\n']);
    expect(lines.join('')).not.toMatch(/secret-token|Volcanoes/);
  });

  it('logs nothing on success, and never the token, title or file', async () => {
    const lines: string[] = [];
    const coursework: ClassroomCoursework = {
      createCoursework: (_token, courseId) =>
        Promise.resolve(
          courseId === 'c1' ? ok({ id: 'cw', url: 'https://c' }) : err({ code: 'not_found' }),
        ),
    };
    const logged = loggedCoursework(coursework, (line) => lines.push(line));

    expect((await logged.createCoursework('secret-token', 'c1', request)).ok).toBe(true);
    await logged.createCoursework('secret-token', 'c2', request);

    expect(lines).toEqual(['Google Classroom coursework failed: not_found\n']);
    expect(lines.join('')).not.toMatch(/secret-token|Unit 3|test\.docx/);
  });
});
