import { describe, expect, it } from 'vitest';
import { type ClassId, type SchoolId, type StudentId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createStudent, updateStudent } from './student.ts';

const base = {
  id: 'student-1' as StudentId,
  schoolId: 'school-1' as SchoolId,
  classId: 'class-1' as ClassId,
  firstName: ' Ana ',
  lastName: ' de la Cruz ',
};

describe('createStudent', () => {
  it('stores only the minimum: names, and optional number, parent email and accommodations', () => {
    expect(valueOf(createStudent(base))).toEqual({
      ...base,
      firstName: 'Ana',
      lastName: 'de la Cruz',
      studentNumber: null,
      parentEmail: null,
      accommodations: null,
    });
  });

  it('keeps optional details and normalises the parent email', () => {
    const student = valueOf(
      createStudent({
        ...base,
        studentNumber: 'S-104',
        parentEmail: ' Mom@Mail.com ',
        accommodations: 'Extra time',
      }),
    );

    expect([student.studentNumber, student.parentEmail, student.accommodations]).toEqual([
      'S-104',
      'mom@mail.com',
      'Extra time',
    ]);
  });

  it('treats a blank parent email as none', () => {
    expect(valueOf(createStudent({ ...base, parentEmail: '  ' })).parentEmail).toBeNull();
  });

  it('rejects missing names and a bad parent email', () => {
    expect(errorOf(createStudent({ ...base, firstName: '' }))).toEqual({
      field: 'firstName',
      code: 'required',
    });
    expect(errorOf(createStudent({ ...base, lastName: ' ' }))).toEqual({
      field: 'lastName',
      code: 'required',
    });
    expect(errorOf(createStudent({ ...base, parentEmail: 'mom' }))).toEqual({
      field: 'parentEmail',
      code: 'invalid_format',
    });
  });

  it('rejects an over-long student number', () => {
    expect(errorOf(createStudent({ ...base, studentNumber: '9'.repeat(51) }))).toEqual({
      field: 'studentNumber',
      code: 'too_long',
    });
  });

  it('rejects over-long accommodations', () => {
    expect(errorOf(createStudent({ ...base, accommodations: 'x'.repeat(2001) }))).toEqual({
      field: 'accommodations',
      code: 'too_long',
    });
  });
});

describe('updateStudent', () => {
  it('changes the details with the same rules, keeping id, school and class', () => {
    const student = valueOf(createStudent(base));
    const updated = valueOf(
      updateStudent(student, { firstName: 'Ana María', lastName: 'Cruz', parentEmail: 'P@x.com' }),
    );

    expect(updated).toMatchObject({
      id: base.id,
      classId: base.classId,
      firstName: 'Ana María',
      lastName: 'Cruz',
      parentEmail: 'p@x.com',
    });
    expect(errorOf(updateStudent(student, { firstName: 'A', lastName: '' }))).toEqual({
      field: 'lastName',
      code: 'required',
    });
  });
});
