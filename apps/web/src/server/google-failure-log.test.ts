import { describe, expect, it } from 'vitest';
import { err, ok } from '@thp/domain';
import type { ClassroomCoursework, GoogleDriveFiles } from '@thp/ports';
import { loggedCoursework, loggedDrive } from './google-failure-log.ts';

const pdf = { name: 'test.pdf', bytes: new Uint8Array([1]) };
const request = {
  title: 'Unit 3',
  description: '',
  material: { kind: 'driveFile' as const, driveFileId: 'd1' },
  dueDate: null,
};

describe('Google failure log', () => {
  it('writes the failing step, code and Google reason, and passes the result through', async () => {
    const lines: string[] = [];
    const drive: GoogleDriveFiles = {
      uploadPdf: () => Promise.resolve(err({ code: 'api_disabled', reason: 'SERVICE_DISABLED' })),
      uploadDoc: () => Promise.resolve(err({ code: 'insufficient_scope' })),
    };

    const result = await loggedDrive(drive, (line) => lines.push(line)).uploadPdf('t', pdf);

    expect(result).toEqual({
      ok: false,
      error: { code: 'api_disabled', reason: 'SERVICE_DISABLED' },
    });
    expect(lines).toEqual(['Google Drive upload failed: api_disabled (SERVICE_DISABLED)\n']);
    await loggedDrive(drive, (line) => lines.push(line)).uploadDoc('t', { name: 'x', html: '' });
    expect(lines.at(-1)).toBe('Google Docs upload failed: insufficient_scope\n');
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
    expect(lines.join('')).not.toMatch(/secret-token|Unit 3|test\.pdf/);
  });
});
