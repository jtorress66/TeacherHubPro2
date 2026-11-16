import { describe, expect, it } from 'vitest';
import { createTranslator } from '@thp/i18n';
import {
  onRequest,
  ltiTools,
  toolFrom,
  toolGroupFrom,
  toolGroups,
  tools,
  toolsIn,
} from './connected-tools.ts';

describe('connected tools', () => {
  it('lists every tool once, each in a known group', () => {
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tool of tools) expect(toolGroups).toContain(tool.group);
  });

  it('shows every tool when no group, or an unknown one, is chosen', () => {
    expect(toolsIn(null)).toEqual(tools);
    expect(toolGroupFrom('printers')).toBeNull();
    expect(toolGroupFrom(undefined)).toBeNull();
  });

  it('filters to one group', () => {
    expect(toolGroupFrom('google')).toBe('google');
    expect(toolsIn('google').map((tool) => tool.id)).toEqual([
      'googleSignIn',
      'classroom',
      'forms',
      'slides',
    ]);
    expect(toolsIn('schoolSystems').map((tool) => tool.id)).toEqual([
      'canvas',
      'schoology',
      'moodle',
      'brightspace',
      'clever',
    ]);
  });

  it('offers Teams, Clever and the LTI school systems on request, never as self-serve', () => {
    expect([...onRequest].sort()).toEqual([
      'brightspace',
      'canvas',
      'clever',
      'moodle',
      'schoology',
      'teams',
    ]);
    expect([...ltiTools].sort()).toEqual(['brightspace', 'canvas', 'moodle', 'schoology']);
    expect([...ltiTools].every((id) => toolsIn('schoolSystems').some((t) => t.id === id))).toBe(
      true,
    );
  });

  it('accepts only known tools from a link', () => {
    expect(toolFrom('clever')).toBe('clever');
    expect(toolFrom('<script>')).toBeNull();
    expect(toolFrom(['clever'])).toBeNull();
  });

  it('names and describes every tool and group', () => {
    const t = createTranslator('en');
    for (const tool of tools) {
      for (const key of [
        `connectedTools.tool.${tool.id}.name`,
        `connectedTools.tool.${tool.id}.text`,
      ] as const) {
        expect(t(key)).not.toBe(key);
      }
    }
    for (const group of toolGroups) {
      expect(t(`connectedTools.group.${group}`)).not.toBe(`connectedTools.group.${group}`);
    }
  });
});
