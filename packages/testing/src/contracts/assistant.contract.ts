import { describe, expect, it } from 'vitest';
import type { ClassId, GenerationId, PresentationId, SchoolId, UserId } from '@thp/domain';
import type {
  AiGenerationRepository,
  PresentationRepository,
  SubPacketRepository,
} from '@thp/ports';
import { aGeneration, aPresentation, aSubPacket } from '../fixtures.ts';
import { deletableContract, scopedRepositoryContract } from './scoped-repository.contract.ts';

export interface AssistantRepositories {
  readonly generations: AiGenerationRepository;
  readonly presentations: PresentationRepository;
  readonly subPackets: SubPacketRepository;
}

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher = 'teacher-1' as UserId;

/** Shared suites for the AI generation, presentation and substitute packet repositories. */
export function assistantRepositoryContract(name: string, make: () => AssistantRepositories): void {
  const generations = {
    make: () => make().generations,
    sample: (schoolId: SchoolId, id: string) => aGeneration({ schoolId, id: id as GenerationId }),
  };
  scopedRepositoryContract(`${name} generations`, {
    ...generations,
    change: (generation) => ({ ...generation, content: '# Changed' }),
  });
  deletableContract(`${name} generations`, generations);

  describe(`${name} (AiGenerationRepository.listByTeacher)`, () => {
    it('lists the teacher’s generations newest first, without their content', async () => {
      const repo = make().generations;
      const older = aGeneration({
        schoolId: schoolA,
        id: 'gen-old' as GenerationId,
        createdAt: new Date('2026-10-01T10:00:00Z'),
      });
      const newer = aGeneration({
        schoolId: schoolA,
        id: 'gen-new' as GenerationId,
        createdAt: new Date('2026-10-02T10:00:00Z'),
      });
      const someoneElse = aGeneration({
        schoolId: schoolA,
        id: 'gen-other' as GenerationId,
        teacherId: 'teacher-2' as UserId,
      });
      for (const generation of [older, newer, someoneElse]) await repo.save(generation);

      const list = await repo.listByTeacher(schoolA, teacher);

      expect(list.map((row) => row.id)).toEqual(['gen-new', 'gen-old']);
      expect(list[0]).not.toHaveProperty('content');
      expect(list[0]).toMatchObject({ type: newer.type, topic: newer.topic });
    });

    it('never lists another school’s generations', async () => {
      const repo = make().generations;
      await repo.save(aGeneration({ schoolId: schoolA }));
      expect(await repo.listByTeacher(schoolB, teacher)).toEqual([]);
    });
  });

  const presentations = {
    make: () => make().presentations,
    sample: (schoolId: SchoolId, id: string) =>
      aPresentation({ schoolId, id: id as PresentationId }),
  };
  scopedRepositoryContract(`${name} presentations`, {
    ...presentations,
    change: (presentation) => ({ ...presentation, name: 'Changed', theme: 'galaxy' as const }),
  });
  deletableContract(`${name} presentations`, presentations);

  describe(`${name} (PresentationRepository.listByTeacher)`, () => {
    it('lists the teacher’s presentations by last update, with a slide count', async () => {
      const repo = make().presentations;
      const older = aPresentation({
        schoolId: schoolA,
        id: 'pres-old' as PresentationId,
        updatedAt: new Date('2026-10-01T10:00:00Z'),
      });
      const newer = aPresentation({
        schoolId: schoolA,
        id: 'pres-new' as PresentationId,
        updatedAt: new Date('2026-10-05T10:00:00Z'),
      });
      await repo.save(older);
      await repo.save(newer);
      await repo.save(aPresentation({ schoolId: schoolB, id: 'pres-b' as PresentationId }));

      const list = await repo.listByTeacher(schoolA, teacher);

      expect(list.map((row) => row.id)).toEqual(['pres-new', 'pres-old']);
      expect(list[0]).not.toHaveProperty('slides');
      expect(list[0]?.slideCount).toBe(newer.slides.length);
    });
  });

  describe(`${name} (SubPacketRepository)`, () => {
    it('saves one packet per class and replaces it on save', async () => {
      const repo = make().subPackets;
      const packet = aSubPacket({ schoolId: schoolA });
      await repo.save(packet);
      await repo.save({ ...packet, dailyRoutines: 'Changed' });

      expect(await repo.findByClass(schoolA, packet.classId)).toEqual({
        ...packet,
        dailyRoutines: 'Changed',
      });
    });

    it('returns null for a class without a packet, and for another school', async () => {
      const repo = make().subPackets;
      const packet = aSubPacket({ schoolId: schoolA });
      await repo.save(packet);

      expect(await repo.findByClass(schoolA, 'class-none' as ClassId)).toBeNull();
      expect(await repo.findByClass(schoolB, packet.classId)).toBeNull();
    });
  });
}
