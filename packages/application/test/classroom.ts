import type { AssignmentId, Student, StudentId, User, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  AddStandardCategories,
  AddStudent,
  CreateAssignment,
  CreateClass,
  SaveGrades,
} from '../src/index.ts';
import { signedUp, type World } from './world.ts';

export const colleagueOf = (user: User, role: User['role'] = 'teacher') =>
  aUser({
    id: `colleague-${role}` as UserId,
    schoolId: user.schoolId,
    email: `${role}@x.edu`,
    role,
  });

export const standardNames = {
  homework: 'Tareas',
  quiz: 'Pruebas cortas',
  test: 'Exámenes',
  project: 'Proyectos',
};

export const valueOf = <T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

/** A teacher with a class of three students (Zayas, Acosta, Morales) and the standard categories. */
export async function gradedClass(world: World) {
  const account = await signedUp(world);
  const actor = account.user;
  const cls = valueOf(
    await new CreateClass(world).execute({ actor, details: { name: 'Ciencias 5' } }),
  );
  const add = async (firstName: string, lastName: string): Promise<Student> =>
    valueOf(
      await new AddStudent(world).execute({
        actor,
        classId: cls.id,
        details: { firstName, lastName },
      }),
    );
  const ana = await add('Ana', 'Zayas');
  const ben = await add('Ben', 'Acosta');
  const cara = await add('Cara', 'Morales');
  const categories = valueOf(
    await new AddStandardCategories(world).execute({
      actor,
      classId: cls.id,
      names: standardNames,
    }),
  );
  const category = (name: string) => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(name);
    return found.id;
  };
  const assign = async (title: string, categoryName: string, points: number, dueDate?: string) =>
    valueOf(
      await new CreateAssignment(world).execute({
        actor,
        classId: cls.id,
        details: { title, categoryId: category(categoryName), points, dueDate: dueDate ?? null },
      }),
    );
  const grade = async (
    assignmentId: AssignmentId,
    rows: {
      studentId: StudentId;
      status: 'graded' | 'late' | 'missing' | 'excused' | 'pending';
      score?: number;
    }[],
  ) => valueOf(await new SaveGrades(world).execute({ actor, classId: cls.id, assignmentId, rows }));
  return { ...account, actor, cls, ana, ben, cara, categories, category, assign, grade };
}
