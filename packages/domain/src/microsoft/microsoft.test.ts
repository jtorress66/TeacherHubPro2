import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import { connectMicrosoft, oneDriveFileName } from './microsoft.ts';

describe('Microsoft', () => {
  it('keeps one connection per teacher, identified by the teacher, with or without Teams', () => {
    const connectedAt = new Date('2026-11-11T12:00:00Z');
    expect(
      connectMicrosoft({
        schoolId: 'school-1' as SchoolId,
        teacherId: 'teacher-1' as UserId,
        encryptedRefreshToken: 'sealed',
        teams: false,
        connectedAt,
      }),
    ).toEqual({
      id: 'teacher-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      encryptedRefreshToken: 'sealed',
      teams: false,
      connectedAt,
    });
  });

  it('names the file after the material, trimmed, with its extension', () => {
    expect(oneDriveFileName('  Fractions week  ', 'pptx')).toBe('Fractions week.pptx');
    expect(oneDriveFileName('Fracciones 🍎', 'docx')).toBe('Fracciones 🍎.docx');
  });

  it('leaves out the characters OneDrive does not allow in a file name', () => {
    expect(oneDriveFileName('Unit 3: "Fractions" <1/2> * ? \\ |', 'docx')).toBe(
      'Unit 3 Fractions 12.docx',
    );
    expect(oneDriveFileName('Tab\there\u0000\u001f', 'docx')).toBe('Tabhere.docx');
  });

  it('never starts or ends the name with a dot or a space', () => {
    expect(oneDriveFileName('..hidden. . ', 'pptx')).toBe('hidden.pptx');
    expect(oneDriveFileName(' . ', 'pptx')).toBe('TeacherHubPro.pptx');
  });

  it('avoids the names Windows reserves for devices', () => {
    for (const reserved of ['CON', 'prn', 'Aux', 'NUL', 'COM1', 'com9', 'LPT1', 'lpt9']) {
      expect(oneDriveFileName(reserved, 'docx')).toBe(`${reserved} (TeacherHubPro).docx`);
    }
    expect(oneDriveFileName('CONTENT', 'docx')).toBe('CONTENT.docx');
    expect(oneDriveFileName('COM10', 'docx')).toBe('COM10.docx');
  });

  it('shortens a long name to 100 characters, without cutting a letter in half', () => {
    expect(oneDriveFileName('a'.repeat(120), 'docx')).toBe(`${'a'.repeat(100)}.docx`);
    expect(oneDriveFileName('🍎'.repeat(60), 'docx')).toBe(`${'🍎'.repeat(50)}.docx`);
    expect(oneDriveFileName(`${'a'.repeat(99)}🍎`, 'docx')).toBe(`${'a'.repeat(99)}.docx`);
    expect(oneDriveFileName(`${'a'.repeat(99)} b`, 'docx')).toBe(`${'a'.repeat(99)}.docx`);
  });

  it('gives an unnamed file a name', () => {
    expect(oneDriveFileName('   ', 'docx')).toBe('TeacherHubPro.docx');
    expect(oneDriveFileName('???', 'pptx')).toBe('TeacherHubPro.pptx');
  });
});
