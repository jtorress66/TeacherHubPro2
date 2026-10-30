import type { Insertable, Selectable } from 'kysely';
import {
  assistantSubjects,
  contentTypes,
  gradeLevels,
  languages,
  presentationThemes,
  type AiGeneration,
  type ClassId,
  type GenerationId,
  type Presentation,
  type PresentationId,
  type SchoolId,
  type Slide,
  type SubPacket,
  type UserId,
} from '@thp/domain';
import type { AiGenerationsTable, PresentationsTable, SubPacketsTable } from '../schema.ts';
import { oneOf, readJson, toJson, type Row } from './columns.ts';

/** Like RowMapper, but these rows also carry the timestamps the domain sets. */
interface TimedRowMapper<Entity, Table> {
  readonly toRow: (entity: Entity) => Required<Insertable<Table>>;
  readonly fromRow: (row: Selectable<Table>) => Entity;
}

const nullableOneOf = <T extends string>(allowed: readonly T[], value: unknown, column: string) =>
  value === null ? null : oneOf(allowed, value, column);

export const generationMapper: TimedRowMapper<AiGeneration, AiGenerationsTable> = {
  toRow: (generation) => ({
    id: generation.id,
    school_id: generation.schoolId,
    teacher_id: generation.teacherId,
    type: generation.type,
    subject: generation.subject,
    grade: generation.grade,
    topic: generation.topic,
    language: generation.language,
    content: generation.content,
    created_at: generation.createdAt,
  }),
  fromRow: (row) => ({
    id: row.id as GenerationId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    type: oneOf(contentTypes, row.type, 'ai_generations.type'),
    subject: oneOf(assistantSubjects, row.subject, 'ai_generations.subject'),
    grade: oneOf(gradeLevels, row.grade, 'ai_generations.grade'),
    topic: row.topic,
    language: oneOf(languages, row.language, 'ai_generations.language'),
    content: row.content,
    createdAt: row.created_at,
  }),
};

export const presentationMapper: TimedRowMapper<Presentation, PresentationsTable> = {
  toRow: (presentation) => ({
    id: presentation.id,
    school_id: presentation.schoolId,
    teacher_id: presentation.teacherId,
    name: presentation.name,
    topic: presentation.topic,
    subject: presentation.subject,
    grade: presentation.grade,
    theme: presentation.theme,
    slides: toJson(presentation.slides),
    created_at: presentation.createdAt,
    updated_at: presentation.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id as PresentationId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    name: row.name,
    topic: row.topic,
    subject: nullableOneOf(assistantSubjects, row.subject, 'presentations.subject'),
    grade: nullableOneOf(gradeLevels, row.grade, 'presentations.grade'),
    theme: oneOf(presentationThemes, row.theme, 'presentations.theme'),
    slides: readJson(row.slides) as Slide[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
};

export const subPacketMapper = {
  toRow: (packet: SubPacket): Omit<Row<SubPacketsTable>, 'updated_at'> => ({
    class_id: packet.classId,
    school_id: packet.schoolId,
    main_office_ext: packet.mainOfficeExt,
    nurse_ext: packet.nurseExt,
    daily_routines: packet.dailyRoutines,
    emergency_procedures: packet.emergencyProcedures,
    additional_notes: packet.additionalNotes,
    include_accommodations: packet.includeAccommodations,
  }),
  fromRow: (row: Selectable<SubPacketsTable>): SubPacket => ({
    classId: row.class_id as ClassId,
    schoolId: row.school_id as SchoolId,
    mainOfficeExt: row.main_office_ext,
    nurseExt: row.nurse_ext,
    dailyRoutines: row.daily_routines,
    emergencyProcedures: row.emergency_procedures,
    additionalNotes: row.additional_notes,
    includeAccommodations: row.include_accommodations,
  }),
};
