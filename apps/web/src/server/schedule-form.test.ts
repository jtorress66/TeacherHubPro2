import { describe, expect, it } from 'vitest';
import { scheduledAtOf } from './schedule-form.ts';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
};

describe('scheduledAtOf', () => {
  it('posts now unless the teacher chose to schedule', () => {
    expect(scheduledAtOf(form({}), 'America/Puerto_Rico')).toEqual({ ok: true, value: null });
    expect(scheduledAtOf(form({ when: 'now' }), 'America/Puerto_Rico')).toEqual({
      ok: true,
      value: null,
    });
  });

  it('reads the date and time in the teacher’s time zone', () => {
    const at = scheduledAtOf(
      form({ when: 'later', scheduleDate: '2026-11-10', scheduleTime: '08:30' }),
      'America/Puerto_Rico',
    );
    expect(at).toEqual({ ok: true, value: new Date('2026-11-10T12:30:00Z') });
    expect(
      scheduledAtOf(
        form({ when: 'later', scheduleDate: '2026-07-01', scheduleTime: '08:30' }),
        'America/New_York',
      ),
    ).toEqual({ ok: true, value: new Date('2026-07-01T12:30:00Z') });
  });

  it('asks for a date and time when scheduling without them', () => {
    expect(scheduledAtOf(form({ when: 'later', scheduleDate: '2026-11-10' }), 'UTC')).toEqual({
      ok: false,
      error: { field: 'scheduledAt', code: 'required' },
    });
  });
});
