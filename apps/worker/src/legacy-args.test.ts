import { describe, expect, it } from 'vitest';
import { parseLegacyArgs } from './legacy-args.ts';

const repo = 'C:\\work\\TeacherHubPro2';

describe('parseLegacyArgs', () => {
  it('reads the export folder, and runs a dry run unless --apply is given', () => {
    expect(parseLegacyArgs(['--from', 'C:\\thp-export'], repo)).toEqual({
      ok: true,
      value: { folder: 'C:\\thp-export', apply: false },
    });
    expect(parseLegacyArgs(['--apply', '--from', 'D:\\exports\\old'], repo)).toEqual({
      ok: true,
      value: { folder: 'D:\\exports\\old', apply: true },
    });
    expect(parseLegacyArgs(['--from', '/home/me/export'], '/home/me/TeacherHubPro2').ok).toBe(true);
  });

  it('needs the export folder', () => {
    expect(parseLegacyArgs(['--apply'], repo)).toEqual({
      ok: false,
      error: 'Usage: pnpm migrate:legacy --from <export folder> [--apply]',
    });
    expect(parseLegacyArgs(['--from', '--apply'], repo).ok).toBe(false);
  });

  it('refuses a folder inside the repository, which holds student data that must never be committed', () => {
    expect(parseLegacyArgs(['--from', 'C:\\work\\TeacherHubPro2\\export'], repo)).toEqual({
      ok: false,
      error: 'Keep the export outside the repository (it holds student data), e.g. C:\\thp-export.',
    });
    expect(parseLegacyArgs(['--from', repo], repo).ok).toBe(false);
    expect(parseLegacyArgs(['--from', '/home/me/repo/x'], '/home/me/repo').ok).toBe(false);
  });
});
