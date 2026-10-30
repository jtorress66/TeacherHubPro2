import { describe, expect, it } from 'vitest';
import { type SchoolId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createSchool, setSchoolLogo, updateSchoolDetails } from './school.ts';

const id = 'school-1' as SchoolId;

describe('createSchool', () => {
  it('creates a school with a trimmed name and empty optional fields as null', () => {
    expect(valueOf(createSchool({ id, name: ' My School ', phone: ' ' }))).toEqual({
      id,
      name: 'My School',
      address: null,
      phone: null,
      email: null,
      logoKey: null,
    });
  });

  it('keeps contact details and normalises the email', () => {
    const school = valueOf(
      createSchool({
        id,
        name: 'Escuela Luz',
        address: 'Calle 1',
        phone: '555-0100',
        email: 'Office@Luz.edu',
        logoKey: 'schools/school-1/logo',
      }),
    );

    expect(school.email).toBe('office@luz.edu');
    expect(school.logoKey).toBe('schools/school-1/logo');
  });

  it('rejects a blank name and a bad email', () => {
    expect(errorOf(createSchool({ id, name: '  ' }))).toEqual({ field: 'name', code: 'required' });
    expect(errorOf(createSchool({ id, name: 'A', email: 'nope' }))).toEqual({
      field: 'email',
      code: 'invalid_format',
    });
  });

  it('rejects an over-long address or phone', () => {
    expect(errorOf(createSchool({ id, name: 'A', address: 'x'.repeat(201) }))).toEqual({
      field: 'address',
      code: 'too_long',
    });
    expect(errorOf(createSchool({ id, name: 'A', phone: '1'.repeat(41) }))).toEqual({
      field: 'phone',
      code: 'too_long',
    });
  });
});

describe('updateSchoolDetails', () => {
  it('replaces the details with validated values and keeps the id', () => {
    const school = valueOf(createSchool({ id, name: 'My School' }));
    expect(
      valueOf(
        updateSchoolDetails(school, { name: 'Escuela Luz', phone: '555', email: 'A@Luz.edu' }),
      ),
    ).toEqual({
      id,
      name: 'Escuela Luz',
      address: null,
      phone: '555',
      email: 'a@luz.edu',
      logoKey: null,
    });
  });

  it('keeps the logo when none is given and rejects a blank name', () => {
    const school = valueOf(createSchool({ id, name: 'A', logoKey: 'schools/school-1/logo' }));
    expect(valueOf(updateSchoolDetails(school, { name: 'B' })).logoKey).toBe(
      'schools/school-1/logo',
    );
    expect(errorOf(updateSchoolDetails(school, { name: ' ' }))).toEqual({
      field: 'name',
      code: 'required',
    });
  });
});

describe('setSchoolLogo', () => {
  it('sets and clears the stored logo', () => {
    const school = valueOf(createSchool({ id, name: 'A' }));
    const withLogo = setSchoolLogo(school, 'schools/school-1/logo');

    expect(withLogo.logoKey).toBe('schools/school-1/logo');
    expect(setSchoolLogo(withLogo, null)).toEqual(school);
  });
});
