import { ok, parseLocalDate, type Class, type Result, type User } from '@thp/domain';
import type { AttendanceSessionRepository, ClassRepository } from '@thp/ports';
import { ListClasses } from '../classes/class-use-cases.ts';
import type { UseCaseError } from '../errors.ts';

export type DayStatus = 'not_taken' | 'open' | 'submitted';

export interface ClassDay {
  readonly cls: Class;
  readonly status: DayStatus;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** The actor's active classes (all of the school's for an admin) with whether a day was taken. */
export class GetAttendanceOverview {
  private readonly listClasses: ListClasses;

  constructor(
    private readonly deps: {
      readonly classes: ClassRepository;
      readonly attendanceSessions: AttendanceSessionRepository;
    },
  ) {
    this.listClasses = new ListClasses(deps);
  }

  async execute(input: { actor: User; date: string }): Promise<Result<ClassDay[], UseCaseError>> {
    const date = parseLocalDate('date', input.date);
    if (!date.ok) return date;
    const classes = await this.listClasses.execute({ actor: input.actor });
    const days = await Promise.all(
      classes.map(async (cls) => {
        const session = await this.deps.attendanceSessions.findByClassAndDate(
          cls.schoolId,
          cls.id,
          date.value,
        );
        return { cls, status: session?.status ?? ('not_taken' as const) };
      }),
    );
    return ok(days.sort((a, b) => collator.compare(a.cls.name, b.cls.name)));
  }
}
