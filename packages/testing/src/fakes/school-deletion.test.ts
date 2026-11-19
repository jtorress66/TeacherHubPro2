import type { SchoolId } from '@thp/domain';
import {
  schoolDeletionRepositoryContract,
  schoolEraserContract,
} from '../contracts/school-deletion.contract.ts';
import { FakeSchoolEraser, InMemorySchoolDeletionRepository } from './school-deletion.ts';

schoolDeletionRepositoryContract(
  'InMemorySchoolDeletionRepository',
  () => new InMemorySchoolDeletionRepository(),
);

schoolEraserContract('FakeSchoolEraser', () => {
  const withData = new Set<SchoolId>();
  const deletions = new InMemorySchoolDeletionRepository();
  return Promise.resolve({
    eraser: new FakeSchoolEraser(deletions, (schoolId) => {
      withData.delete(schoolId);
      return Promise.resolve();
    }),
    deletions,
    seed: (schoolId) => {
      withData.add(schoolId);
      return Promise.resolve();
    },
    hasData: (schoolId) => Promise.resolve(withData.has(schoolId)),
  });
});
