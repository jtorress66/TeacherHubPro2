import { sql, type Kysely } from 'kysely';
import { generationSummary, presentationSummary } from '@thp/domain';
import type {
  AiGeneration,
  ClassId,
  GenerationId,
  GenerationSummary,
  Presentation,
  PresentationId,
  PresentationSummary,
  SchoolId,
  SubPacket,
  UserId,
} from '@thp/domain';
import type {
  AiGenerationRepository,
  PresentationRepository,
  SubPacketRepository,
} from '@thp/ports';
import {
  generationMapper,
  presentationMapper,
  subPacketMapper,
} from '../mappers/assistant-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresAiGenerationRepository implements AiGenerationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: GenerationId): Promise<AiGeneration | null> {
    const row = await this.db
      .selectFrom('ai_generations')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : generationMapper.fromRow(row);
  }

  save(entity: AiGeneration): Promise<void> {
    return upsert(this.db, 'ai_generations', generationMapper.toRow(entity));
  }

  async delete(schoolId: SchoolId, id: GenerationId): Promise<void> {
    await this.db
      .deleteFrom('ai_generations')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  /** Newest first, without the content (which can be long). */
  async listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
  ): Promise<readonly GenerationSummary[]> {
    const rows = await this.db
      .selectFrom('ai_generations')
      .select([
        'id',
        'school_id',
        'teacher_id',
        'type',
        'subject',
        'grade',
        'topic',
        'language',
        'created_at',
      ])
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('created_at', 'desc')
      .orderBy('id')
      .execute();
    return rows.map((row) => generationSummary(generationMapper.fromRow({ ...row, content: '' })));
  }
}

export class PostgresPresentationRepository implements PresentationRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: PresentationId): Promise<Presentation | null> {
    const row = await this.db
      .selectFrom('presentations')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : presentationMapper.fromRow(row);
  }

  save(entity: Presentation): Promise<void> {
    return upsert(this.db, 'presentations', presentationMapper.toRow(entity));
  }

  async delete(schoolId: SchoolId, id: PresentationId): Promise<void> {
    await this.db
      .deleteFrom('presentations')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  /** Most recently updated first, with a slide count instead of the slides. */
  async listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
  ): Promise<readonly PresentationSummary[]> {
    const rows = await this.db
      .selectFrom('presentations')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('updated_at', 'desc')
      .orderBy('id')
      .execute();
    return rows.map((row) => presentationSummary(presentationMapper.fromRow(row)));
  }
}

export class PostgresSubPacketRepository implements SubPacketRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByClass(schoolId: SchoolId, classId: ClassId): Promise<SubPacket | null> {
    const row = await this.db
      .selectFrom('sub_packets')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .executeTakeFirst();
    return row === undefined ? null : subPacketMapper.fromRow(row);
  }

  async save(packet: SubPacket): Promise<void> {
    const row = subPacketMapper.toRow(packet);
    await this.db
      .insertInto('sub_packets')
      .values(row)
      .onConflict((conflict) =>
        conflict.column('class_id').doUpdateSet({ ...row, updated_at: sql`now()` }),
      )
      .execute();
  }
}
