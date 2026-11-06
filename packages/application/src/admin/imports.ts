import {
  err,
  ok,
  type ClassId,
  type Result,
  type Role,
  type SchoolId,
  type User,
} from '@thp/domain';
import type { ClassRepository, IdGenerator, StudentRepository } from '@thp/ports';
import { fail } from '../errors.ts';
import { readCsvTable } from '../shared/csv-table.ts';
import { RosterImporter, type ImportError, type RowError } from '../students/import-students.ts';
import { requireSuperAdmin } from './admin-access.ts';
import { newSchoolUser, welcomeSchoolUsers, type SchoolStaffDeps } from './super-admin.ts';

export const maxTeacherRows = 500;

type TeacherColumn = 'name' | 'email' | 'role';

/** Header names admins use, in English and Spanish (compared without case or accents). */
const teacherHeaders: Readonly<Record<TeacherColumn, readonly string[]>> = {
  name: ['name', 'full name', 'teacher', 'nombre', 'nombre completo', 'maestro', 'maestra'],
  email: ['email', 'e-mail', 'email address', 'correo', 'correo electronico', 'e mail'],
  role: ['role', 'rol'],
};

/** Role words in the file; blank means teacher. */
const roleWords: Readonly<Record<string, Exclude<Role, 'super_admin'>>> = {
  '': 'teacher',
  teacher: 'teacher',
  maestro: 'teacher',
  maestra: 'teacher',
  school_admin: 'school_admin',
  'school admin': 'school_admin',
  admin: 'school_admin',
  administrador: 'school_admin',
  administradora: 'school_admin',
};

/**
 * A super admin adds a school's teachers from a CSV file, all or nothing: every bad row (a
 * missing name, a bad or taken email, an email twice in the file) is reported with its line.
 * Each new account then gets an email to choose its password.
 */
export class ImportTeachers {
  constructor(private readonly deps: SchoolStaffDeps) {}

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    csv: string;
  }): Promise<Result<{ imported: number }, ImportError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    if ((await this.deps.schools.findById(input.schoolId)) === null) return fail('not_found');
    const table = readCsvTable<TeacherColumn>(input.csv, {
      aliases: teacherHeaders,
      required: ['name', 'email'],
      maxRows: maxTeacherRows,
    });
    if (!table.ok) return table;

    const users: User[] = [];
    const errors: RowError[] = [];
    const seen = new Set<string>();
    for (const { line, values } of table.value) {
      const role = roleWords[values.role.trim().toLowerCase().replace(/\s+/g, ' ')];
      if (role === undefined) {
        errors.push({ line, field: 'role', code: 'not_allowed' });
        continue;
      }
      const user = await newSchoolUser(this.deps, input.schoolId, {
        name: values.name,
        email: values.email,
        role,
        language: input.actor.language,
      });
      if (!user.ok) {
        errors.push(
          'field' in user.error
            ? { line, ...user.error }
            : { line, field: 'email', code: 'duplicate' },
        );
        continue;
      }
      if (seen.has(user.value.email)) {
        errors.push({ line, field: 'email', code: 'duplicate' });
        continue;
      }
      seen.add(user.value.email);
      users.push(user.value);
    }
    if (errors.length > 0) return err({ code: 'invalid_rows', rows: errors });
    await welcomeSchoolUsers(this.deps, users);
    return ok({ imported: users.length });
  }
}

/** A super admin imports a roster into any school's class, with the teachers' roster rules. */
export class ImportSchoolStudents {
  private readonly roster: RosterImporter;

  constructor(
    private readonly deps: {
      readonly classes: ClassRepository;
      readonly students: StudentRepository;
      readonly ids: IdGenerator;
    },
  ) {
    this.roster = new RosterImporter(deps);
  }

  async execute(input: {
    actor: User;
    schoolId: SchoolId;
    classId: ClassId;
    csv: string;
  }): Promise<Result<{ imported: number }, ImportError>> {
    const allowed = requireSuperAdmin(input.actor);
    if (!allowed.ok) return allowed;
    const cls = await this.deps.classes.findById(input.schoolId, input.classId);
    if (cls === null) return fail('not_found');
    return this.roster.importInto(cls, input.csv);
  }
}
