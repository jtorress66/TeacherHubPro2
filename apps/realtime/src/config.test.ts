import { describe, expect, it } from 'vitest';
import { parseRealtimeConfig } from './config.ts';

const env = {
  DATABASE_URL: 'postgres://u:p@localhost:5433/db',
  REALTIME_TICKET_SECRET: 's'.repeat(32),
  APP_URL: 'https://teacherhubpro-web.onrender.com/',
};

describe('parseRealtimeConfig', () => {
  it('reads the database, the shared ticket secret, the web app’s origin and the port', () => {
    expect(parseRealtimeConfig({ ...env, PORT: '4100' })).toEqual({
      ok: true,
      value: {
        databaseUrl: env.DATABASE_URL,
        ticketSecret: env.REALTIME_TICKET_SECRET,
        allowedOrigin: 'https://teacherhubpro-web.onrender.com',
        port: 4100,
      },
    });
    const defaults = parseRealtimeConfig(env);
    expect(defaults.ok && defaults.value.port).toBe(3200);
  });

  it('explains what is missing or wrong', () => {
    const problem = (changes: Record<string, string | undefined>) => {
      const result = parseRealtimeConfig({ ...env, ...changes });
      return result.ok ? null : result.error;
    };
    expect(problem({ DATABASE_URL: undefined })).toMatch(/DATABASE_URL/);
    expect(problem({ REALTIME_TICKET_SECRET: 'short' })).toMatch(/at least 32/);
    expect(problem({ APP_URL: 'not a url' })).toMatch(/APP_URL/);
    expect(problem({ PORT: 'eighty' })).toMatch(/PORT/);
  });
});
