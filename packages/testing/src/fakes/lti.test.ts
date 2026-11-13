import type { SchoolId, StudentId } from '@thp/domain';
import {
  ltiMembershipsClientContract,
  ltiRepositoryContract,
  ltiRosterRepositoryContract,
  ltiTokenVerifierContract,
  toolJwtSignerContract,
  toolKeyStoreContract,
} from '../contracts/lti.contract.ts';
import { anLtiPlatform, aStudent } from '../fixtures.ts';
import {
  FakeLtiMemberships,
  FakeLtiTokens,
  FakeLtiTokenVerifier,
  FakeToolKeyStore,
  InMemoryLtiCourseRepository,
  InMemoryLtiNonceRepository,
  InMemoryLtiPlatformRepository,
  InMemoryLtiStudentLinkRepository,
  InMemoryLtiUserLinkRepository,
} from './lti.ts';
import { InMemoryStudentRepository } from './repositories.ts';

ltiRepositoryContract('In-memory', () => {
  const platforms = new InMemoryLtiPlatformRepository();
  return {
    platforms,
    nonces: new InMemoryLtiNonceRepository(),
    userLinks: new InMemoryLtiUserLinkRepository(platforms),
  };
});

ltiTokenVerifierContract('FakeLtiTokenVerifier', () => {
  const issuer = new FakeLtiTokens();
  return { verifier: new FakeLtiTokenVerifier([issuer]), issuer };
});

toolKeyStoreContract('FakeToolKeyStore', () => new FakeToolKeyStore());

toolJwtSignerContract('FakeToolKeyStore', () => new FakeToolKeyStore());

ltiRosterRepositoryContract('In-memory', () => {
  const platforms = new InMemoryLtiPlatformRepository();
  const students = new InMemoryStudentRepository();
  for (const id of ['student-1', 'student-two']) {
    void students.save(aStudent({ id: id as StudentId, schoolId: 'school-a' as SchoolId }));
  }
  return {
    platforms,
    students,
    courses: new InMemoryLtiCourseRepository(platforms),
    studentLinks: new InMemoryLtiStudentLinkRepository(platforms, students),
  };
});

ltiMembershipsClientContract('FakeLtiMemberships', (setup) => {
  const client = new FakeLtiMemberships();
  const membershipsUrl = 'https://lms.example.edu/courses/1/names_and_roles';
  client.setMembers(membershipsUrl, setup.members);
  client.failWith(setup.refusal ?? null);
  return { client, platform: anLtiPlatform(), membershipsUrl };
});
