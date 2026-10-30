import {
  createPlanFolder,
  ok,
  updatePlanFolder,
  type PlanFolder,
  type PlanFolderDetails,
  type PlanFolderId,
  type Result,
  type User,
} from '@thp/domain';
import type { IdGenerator, LessonPlanRepository, PlanFolderRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

export interface FolderDeps {
  readonly planFolders: PlanFolderRepository;
  readonly lessonPlans: LessonPlanRepository;
}

export interface FolderWithCount {
  readonly folder: PlanFolder;
  readonly planCount: number;
}

interface FolderInput {
  readonly actor: User;
  readonly folderId: PlanFolderId;
}

/** Folders are each teacher's own; anyone else's folder is not found. */
async function findOwnFolder(
  folders: PlanFolderRepository,
  input: FolderInput,
): Promise<Result<PlanFolder, UseCaseError>> {
  const folder = await folders.findById(input.actor.schoolId, input.folderId);
  return folder?.teacherId === input.actor.id ? ok(folder) : fail('not_found');
}

/** The actor's folders by name, with how many of their plans each holds. */
export class ListFolders {
  constructor(private readonly deps: FolderDeps) {}

  async execute(input: { actor: User }): Promise<readonly FolderWithCount[]> {
    const { schoolId, id } = input.actor;
    const folders = await this.deps.planFolders.listByTeacher(schoolId, id);
    const plans = await this.deps.lessonPlans.listByTeacher(schoolId, id);
    return [...folders]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({
        folder,
        planCount: plans.filter((plan) => plan.folderId === folder.id).length,
      }));
  }
}

export class CreateFolder {
  constructor(
    private readonly deps: Pick<FolderDeps, 'planFolders'> & { readonly ids: IdGenerator },
  ) {}

  async execute(
    input: { actor: User } & PlanFolderDetails,
  ): Promise<Result<PlanFolder, UseCaseError>> {
    const folder = createPlanFolder({
      id: this.deps.ids.next() as PlanFolderId,
      schoolId: input.actor.schoolId,
      teacherId: input.actor.id,
      name: input.name,
      ...(input.color === undefined ? {} : { color: input.color }),
    });
    if (folder.ok) await this.deps.planFolders.save(folder.value);
    return folder;
  }
}

/** Renames and recolours a folder. */
export class UpdateFolder {
  constructor(private readonly deps: Pick<FolderDeps, 'planFolders'>) {}

  async execute(input: FolderInput & PlanFolderDetails): Promise<Result<PlanFolder, UseCaseError>> {
    const found = await findOwnFolder(this.deps.planFolders, input);
    if (!found.ok) return found;
    const updated = updatePlanFolder(found.value, input);
    if (updated.ok) await this.deps.planFolders.save(updated.value);
    return updated;
  }
}

/** Deletes a folder; its plans move to Unfiled. */
export class DeleteFolder {
  constructor(private readonly deps: FolderDeps) {}

  async execute(input: FolderInput): Promise<Result<true, UseCaseError>> {
    const found = await findOwnFolder(this.deps.planFolders, input);
    if (!found.ok) return found;
    await this.deps.lessonPlans.unfileFolder(found.value.schoolId, found.value.id);
    await this.deps.planFolders.delete(found.value.schoolId, found.value.id);
    return ok(true);
  }
}
