import { describe, expect, it } from 'vitest';
import { currentPathFor } from './legacy-paths.ts';

describe('currentPathFor', () => {
  it('sends the old app pages to their new place', () => {
    expect(currentPathFor('/dashboard')).toBe('/app');
    expect(currentPathFor('/planner/new')).toBe('/app/plans');
    expect(currentPathFor('/planner/abc123')).toBe('/app/plans');
    expect(currentPathFor('/ai-assistant')).toBe('/app/assistant');
    expect(currentPathFor('/adaptive-learning')).toBe('/app/learning');
    expect(currentPathFor('/gradebook/reports')).toBe('/app/gradebook');
    expect(currentPathFor('/classes/abc123')).toBe('/app/classes');
    expect(currentPathFor('/student-progress/abc123')).toBe('/app/classes');
    expect(currentPathFor('/teacher/play-to-learn/host/abc')).toBe('/app/live');
    expect(currentPathFor('/leads')).toBe('/app/super-admin');
  });

  it('sends old sign-in and website pages to their new names', () => {
    expect(currentPathFor('/auth')).toBe('/login');
    expect(currentPathFor('/auth/callback')).toBe('/login');
    expect(currentPathFor('/setup-admin')).toBe('/setup');
    expect(currentPathFor('/privacy-policy')).toBe('/privacy');
    expect(currentPathFor('/terms-of-use')).toBe('/terms');
    expect(currentPathFor('/ai-grading')).toBe('/ai');
    expect(currentPathFor('/soc2')).toBe('/trust');
    expect(currentPathFor('/play-to-learn')).toBe('/features');
  });

  it('sends old student and parent links home, and old game links to the game code page', () => {
    expect(currentPathFor('/assignment/old-token')).toBe('/');
    expect(currentPathFor('/portal/old-token')).toBe('/');
    expect(currentPathFor('/homeschool-portal/old-token')).toBe('/');
    expect(currentPathFor('/play-game/abc')).toBe('/play');
    expect(currentPathFor('/play-to-learn/game/abc')).toBe('/play');
  });

  it('leaves pages that kept their address alone, and ignores a trailing slash', () => {
    expect(currentPathFor('/pricing')).toBeNull();
    expect(currentPathFor('/features/gradebook')).toBeNull();
    expect(currentPathFor('/app/plans')).toBeNull();
    expect(currentPathFor('/auth/local-google')).toBeNull();
    expect(currentPathFor('/')).toBeNull();
    expect(currentPathFor('/dashboard/')).toBe('/app');
    expect(currentPathFor('/dashboards')).toBeNull();
  });
});
