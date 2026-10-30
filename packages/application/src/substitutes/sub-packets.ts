import {
  createSubPacket,
  ok,
  parseLocalDate,
  planOnDate,
  type Class,
  type ClassId,
  type LessonPlan,
  type Result,
  type Semester,
  type Student,
  type SubPacket,
  type SubPacketInput,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  LessonPlanRepository,
  SemesterRepository,
  StudentRepository,
  SubPacketRepository,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import type { UseCaseError } from '../errors.ts';

/** Everything a substitute needs for one class on one day. */
export interface SubPacketView {
  readonly cls: Class;
  readonly semester: Semester | null;
  /** Sorted by name; accommodations are blank when the teacher chose not to share them. */
  readonly students: readonly Student[];
  readonly plan: LessonPlan | null;
  readonly notes: SubPacket;
}

interface Deps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly semesters: SemesterRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly subPackets: SubPacketRepository;
}

const byName = (a: Student, b: Student) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

/** The packet for a class the actor manages (its teacher or a school admin). */
export class GetSubPacket {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
    date: string;
  }): Promise<Result<SubPacketView, UseCaseError>> {
    const { actor } = input;
    const date = parseLocalDate('date', input.date);
    if (!date.ok) return date;
    const found = await findManagedClass(this.deps.classes, actor, input.classId);
    if (!found.ok) return found;
    const cls = found.value;
    const saved = await this.deps.subPackets.findByClass(actor.schoolId, cls.id);
    const notes = saved ?? unwrapDefault(cls);
    const roster = [...(await this.deps.students.listByClass(actor.schoolId, cls.id))].sort(byName);
    const plans = await this.deps.lessonPlans.listByTeacher(actor.schoolId, cls.teacherId);
    const semester =
      cls.semesterId === null
        ? null
        : await this.deps.semesters.findById(actor.schoolId, cls.semesterId);
    return ok({
      cls,
      semester,
      students: notes.includeAccommodations
        ? roster
        : roster.map((student) => ({ ...student, accommodations: null })),
      plan: planOnDate(
        plans.filter((plan) => plan.classId === cls.id),
        date.value,
      ),
      notes,
    });
  }
}

/** A class without saved notes starts from blank notes, sharing accommodations. */
function unwrapDefault(cls: Class): SubPacket {
  const packet = createSubPacket({ classId: cls.id, schoolId: cls.schoolId });
  if (!packet.ok) throw new Error('Blank substitute notes are always valid.');
  return packet.value;
}

/** Saves the notes a teacher writes for substitutes. */
export class SaveSubPacket {
  constructor(private readonly deps: Pick<Deps, 'classes' | 'subPackets'>) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
    details: Omit<SubPacketInput, 'classId' | 'schoolId'>;
  }): Promise<Result<SubPacket, UseCaseError>> {
    const found = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!found.ok) return found;
    const packet = createSubPacket({
      ...input.details,
      classId: found.value.id,
      schoolId: found.value.schoolId,
    });
    if (!packet.ok) return packet;
    await this.deps.subPackets.save(packet.value);
    return packet;
  }
}
