import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MongoExportSource } from '../src/migration/mongo-export-source.ts';

describe('MongoExportSource', () => {
  let folder = '';

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'thp-export-'));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('reads a mongoexport file of one record per line, turning Extended JSON into plain values', async () => {
    await writeFile(
      join(folder, 'users.json'),
      [
        '{"_id":{"$oid":"64f0c1"},"user_id":"user_1","created":{"$date":"2025-09-01T10:00:00Z"},"count":{"$numberLong":"42"}}',
        '',
        '{"_id":{"$oid":"64f0c2"},"user_id":"user_2","score":{"$numberDouble":"9.5"},"tags":[{"$numberInt":"3"}],"when":{"$date":{"$numberLong":"0"}}}',
      ].join('\n'),
    );

    expect(await new MongoExportSource(folder).read('users')).toEqual([
      { _id: '64f0c1', user_id: 'user_1', created: '2025-09-01T10:00:00.000Z', count: 42 },
      {
        _id: '64f0c2',
        user_id: 'user_2',
        score: 9.5,
        tags: [3],
        when: '1970-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('reads a file exported with --jsonArray', async () => {
    await writeFile(
      join(folder, 'schools.json'),
      '[{"school_id":"school_1","name":"Lincoln","nested":{"a":{"$numberDecimal":"1.25"}}}]',
    );

    expect(await new MongoExportSource(folder).read('schools')).toEqual([
      { school_id: 'school_1', name: 'Lincoln', nested: { a: 1.25 } },
    ]);
  });

  it('reads a file holding one pretty-printed record', async () => {
    await writeFile(
      join(folder, 'semesters.json'),
      '{\n  "semester_id": "sem_1",\n  "name": "Fall"\n}\n',
    );

    expect(await new MongoExportSource(folder).read('semesters')).toEqual([
      { semester_id: 'sem_1', name: 'Fall' },
    ]);
  });

  it('gives no records for a collection that was not exported', async () => {
    expect(await new MongoExportSource(folder).read('leads')).toEqual([]);
  });

  it('refuses a collection name that is not a plain name', async () => {
    await expect(new MongoExportSource(folder).read('../secrets')).rejects.toThrow(
      'collection name',
    );
  });
});
