import { describe, expect, it } from 'vitest';
import type { LessonPlanId, PlanFolderId, PlanTemplateId, SchoolId } from '@thp/domain';
import type {
  LessonPlanRepository,
  PlanFolderRepository,
  PlanTemplateRepository,
} from '@thp/ports';
import { aLessonPlan, aPlanFolder, aPlanTemplate } from '../fixtures.ts';
import { deletableContract, scopedRepositoryContract } from './scoped-repository.contract.ts';

export interface PlannerRepositories {
  readonly plans: LessonPlanRepository;
  readonly folders: PlanFolderRepository;
  readonly templates: PlanTemplateRepository;
}

const schoolA = 'school-a' as SchoolId;

/** Shared suites for the lesson plan, folder and template repositories. */
export function plannerRepositoryContract(name: string, make: () => PlannerRepositories): void {
  const plans = {
    make: () => make().plans,
    sample: (schoolId: SchoolId, id: string) => aLessonPlan({ schoolId, id: id as LessonPlanId }),
  };
  scopedRepositoryContract(`${name} plans`, {
    ...plans,
    change: (plan) => ({ ...plan, title: 'Changed' }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, plan) => repo.listByTeacher(schoolId, plan.teacherId),
      },
    ],
  });
  deletableContract(`${name} plans`, plans);

  const folders = {
    make: () => make().folders,
    sample: (schoolId: SchoolId, id: string) => aPlanFolder({ schoolId, id: id as PlanFolderId }),
  };
  scopedRepositoryContract(`${name} folders`, {
    ...folders,
    change: (folder) => ({ ...folder, name: 'Changed', color: 'rose' as const }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, folder) => repo.listByTeacher(schoolId, folder.teacherId),
      },
    ],
  });
  deletableContract(`${name} folders`, folders);

  const templates = {
    make: () => make().templates,
    sample: (schoolId: SchoolId, id: string) =>
      aPlanTemplate({ schoolId, id: id as PlanTemplateId }),
  };
  scopedRepositoryContract(`${name} templates`, {
    ...templates,
    change: (template) => ({ ...template, name: 'Changed' }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, template) => repo.listByTeacher(schoolId, template.teacherId),
      },
    ],
  });
  deletableContract(`${name} templates`, templates);

  describe(`${name} (LessonPlanRepository.unfileFolder)`, () => {
    it('moves only that folder’s plans to Unfiled', async () => {
      const repos = make();
      const folder = aPlanFolder({ schoolId: schoolA });
      const other = aPlanFolder({ schoolId: schoolA, id: 'folder-2' as PlanFolderId });
      await repos.folders.save(folder);
      await repos.folders.save(other);
      const inFolder = aLessonPlan({
        schoolId: schoolA,
        id: 'plan-1' as LessonPlanId,
        folderId: folder.id,
      });
      const elsewhere = aLessonPlan({
        schoolId: schoolA,
        id: 'plan-2' as LessonPlanId,
        folderId: other.id,
      });
      await repos.plans.save(inFolder);
      await repos.plans.save(elsewhere);

      await repos.plans.unfileFolder(folder.schoolId, folder.id);

      expect((await repos.plans.findById(inFolder.schoolId, inFolder.id))?.folderId).toBeNull();
      expect((await repos.plans.findById(elsewhere.schoolId, elsewhere.id))?.folderId).toBe(
        other.id,
      );
    });

    it('leaves another school’s plans alone', async () => {
      const repos = make();
      const folder = aPlanFolder({ schoolId: schoolA });
      await repos.folders.save(folder);
      const plan = aLessonPlan({ schoolId: schoolA, folderId: folder.id });
      await repos.plans.save(plan);

      await repos.plans.unfileFolder('school-b' as SchoolId, folder.id);

      expect((await repos.plans.findById(plan.schoolId, plan.id))?.folderId).toBe(folder.id);
    });
  });
}
