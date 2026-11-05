import { describe, expect, it } from 'vitest';
import type { InsightRequest } from '@thp/ports';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { InsightWriter, insightSystemPrompt, inventedPercentages } from './insight-writer.ts';

const request: InsightRequest = {
  language: 'es',
  stats: {
    average: 58.5,
    attendanceRate: 80,
    absences: 2,
    tardies: 1,
    excused: 0,
    sessions: 15,
    missing: 2,
  },
  recentGrades: [
    { title: 'Fractions quiz', date: '2026-11-02', status: 'graded', percentage: 40 },
    { title: 'Decimals test', date: '2026-10-20', status: 'graded', percentage: 75 },
  ],
  recentAttendance: [{ date: '2026-11-03', status: 'absent' }],
};

const reply = (bullets: string[]) => JSON.stringify({ bullets });
const good = [
  'El promedio es 58.5%, bajó de 75% a 40% en las últimas evaluaciones.',
  'Faltan 2 tareas por entregar.',
  'Hablar con la familia y ofrecer tutoría esta semana.',
];

describe('InsightWriter', () => {
  it('sends only numbers and assignment titles, in the teacher’s language', async () => {
    const llm = new FakeLlmClient().replyWith(reply(good));
    await new InsightWriter(llm).write(request);

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(insightSystemPrompt);
    expect(sent?.system).toMatch(/never invent/i);
    expect(prompt).toContain('Spanish (español)');
    expect(prompt).toContain('Fractions quiz');
    expect(prompt).toContain('"average":58.5');
  });

  it('returns three to five bullets', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply(good)}\n\`\`\``);
    expect(unwrap(await new InsightWriter(llm).write(request))).toEqual(good);
  });

  it('asks again when a percentage is not in the data, or the count is wrong', async () => {
    const invented = [...good.slice(0, 2), 'La asistencia es de 95%.'];
    const llm = new FakeLlmClient()
      .replyWith(reply(invented))
      .replyWith(reply(['Solo una']))
      .replyWith(reply(good));
    expect(await new InsightWriter(llm).write(request)).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toMatch(/95%/);
  });

  it('asks again after a cut-off or non-JSON reply, and reports an unavailable model', async () => {
    const cut = new FakeLlmClient().replyWith(reply(good), 'max_tokens').replyWith(reply(good));
    expect(unwrap(await new InsightWriter(cut).write(request))).toEqual(good);
    expect(cut.requests[1]?.messages[2]?.content).toMatch(/cut off/);

    const prose = new FakeLlmClient().replyWith('Here you go.').replyWith(reply(good));
    expect(unwrap(await new InsightWriter(prose).write(request))).toEqual(good);

    const down = new FakeLlmClient().failWith('unavailable');
    expect(await new InsightWriter(down).write(request)).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });
});

describe('inventedPercentages', () => {
  it('finds percentages that are not in the data, allowing for rounding', () => {
    expect(inventedPercentages(['Average 59%, rate 80 %, quiz 40%.'], request)).toEqual([]);
    expect(inventedPercentages(['Attendance is 95%.', 'Quiz at 12.5%'], request)).toEqual([
      '95%',
      '12.5%',
    ]);
  });
});
