import { describe, expect, it } from 'vitest';
import { learnersFrom } from './lti-membership.ts';

const lis = 'http://purl.imsglobal.org/vocab/lis/v2';
const learner = `${lis}/membership#Learner`;
const instructor = `${lis}/membership#Instructor`;

const member = (overrides: Record<string, unknown> = {}) => ({
  user_id: 'lms-1',
  status: 'Active',
  given_name: 'Ana',
  family_name: 'Rivera',
  name: 'Ana Rivera',
  email: 'ana@student.lincoln.edu',
  picture: 'https://lms.lincoln.edu/ana.png',
  roles: [learner],
  ...overrides,
});

describe('learnersFrom', () => {
  it('keeps an active learner’s id and first and last name, and nothing else', () => {
    expect(learnersFrom([member()])).toEqual({
      learners: [{ subject: 'lms-1', firstName: 'Ana', lastName: 'Rivera' }],
      noName: 0,
    });
  });

  it('reads learner roles written in full, short, sub-role, institution or LTI 1.1 form', () => {
    const roles = [
      ['Learner'],
      [`${lis}/membership/Learner#Learner`],
      [`${lis}/institution/person#Student`],
      ['urn:lti:role:ims/lis/Learner'],
    ];
    const members = roles.map((list, index) => member({ user_id: `lms-${String(index)}`, roles: list }));

    expect(learnersFrom(members).learners.map((found) => found.subject)).toEqual([
      'lms-0',
      'lms-1',
      'lms-2',
      'lms-3',
    ]);
  });

  it('leaves out teachers, assistants, admins, observers and anyone without a learner role', () => {
    const roles = [
      [instructor],
      ['Instructor'],
      [`${lis}/membership/Instructor#TeachingAssistant`],
      [`${lis}/membership#Administrator`],
      [`${lis}/institution/person#Faculty`],
      ['urn:lti:role:ims/lis/Instructor'],
      [`${lis}/membership#Mentor`],
      [learner, instructor],
      [],
      'Learner',
      [42],
    ];
    const members = roles.map((list, index) => member({ user_id: `lms-${String(index)}`, roles: list }));

    expect(learnersFrom(members)).toEqual({ learners: [], noName: 0 });
  });

  it('leaves out members the course system marks inactive or deleted', () => {
    const members = [
      member({ user_id: 'gone', status: 'Inactive' }),
      member({ user_id: 'deleted', status: 'Deleted' }),
      member({ user_id: 'odd', status: 7 }),
      member({ user_id: 'unsaid', status: undefined }),
    ];

    expect(learnersFrom(members).learners.map((found) => found.subject)).toEqual(['unsaid']);
  });

  it('splits the full name when the course system gives no first and last name', () => {
    const found = learnersFrom([
      member({ given_name: undefined, family_name: undefined, name: '  Ben  de la Cruz ' }),
      member({ user_id: 'lms-2', given_name: 'Cara', family_name: ' ', name: 'Cara Ortiz' }),
    ]);

    expect(found.learners).toEqual([
      { subject: 'lms-1', firstName: 'Ben', lastName: 'de la Cruz' },
      { subject: 'lms-2', firstName: 'Cara', lastName: 'Ortiz' },
    ]);
  });

  it('counts learners without a full name instead of adding them', () => {
    const found = learnersFrom([
      member({ given_name: undefined, family_name: undefined, name: undefined }),
      member({ user_id: 'lms-2', given_name: undefined, family_name: undefined, name: 'Dani' }),
      member({ user_id: 'lms-3', given_name: 7, family_name: [], name: '   ' }),
      member({ user_id: 'lms-4' }),
    ]);

    expect(found).toEqual({
      learners: [{ subject: 'lms-4', firstName: 'Ana', lastName: 'Rivera' }],
      noName: 3,
    });
  });

  it('takes each person once, and skips members without an id', () => {
    const found = learnersFrom([
      member(),
      member({ given_name: 'Other' }),
      member({ user_id: '  ' }),
      member({ user_id: 9 }),
      'not a member',
      null,
    ]);

    expect(found).toEqual({
      learners: [{ subject: 'lms-1', firstName: 'Ana', lastName: 'Rivera' }],
      noName: 0,
    });
  });

  it('shortens names longer than a roster allows', () => {
    const long = 'x'.repeat(150);
    const [found] = learnersFrom([member({ given_name: long, family_name: long })]).learners;

    expect(found?.firstName).toHaveLength(100);
    expect(found?.lastName).toHaveLength(100);
  });

  it('reads nothing from something that is not a list', () => {
    expect(learnersFrom({ members: [member()] })).toEqual({ learners: [], noName: 0 });
    expect(learnersFrom(null)).toEqual({ learners: [], noName: 0 });
  });
});
