import { curriculumGuideRepositoryContract } from '../contracts/curriculum.contract.ts';
import { InMemoryCurriculumGuideRepository } from './curriculum.ts';

curriculumGuideRepositoryContract(
  'InMemoryCurriculumGuideRepository',
  () => new InMemoryCurriculumGuideRepository(),
);
