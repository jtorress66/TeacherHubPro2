import { describe, expect, it } from 'vitest';
import { calendarHeaders, calendarLabels, calendarToken } from './calendar-feed.ts';

describe('calendarToken', () => {
  const token = 'Ab9_-'.repeat(9);

  it('accepts the token with or without a trailing .ics', () => {
    expect(calendarToken(token)).toBe(token);
    expect(calendarToken(`${token}.ics`)).toBe(token);
  });

  it('refuses anything that cannot be a link token', () => {
    expect(calendarToken('')).toBeNull();
    expect(calendarToken('.ics')).toBeNull();
    expect(calendarToken('short')).toBeNull();
    expect(calendarToken(`${token}/x`)).toBeNull();
    expect(calendarToken(`${token}.txt`)).toBeNull();
    expect(calendarToken('x'.repeat(300))).toBeNull();
  });
});

describe('calendarLabels', () => {
  it('names the calendar and its entries in the teacher’s language', () => {
    const english = calendarLabels('en');
    const spanish = calendarLabels('es');

    expect(english.calendarName).toBe('TeacherHubPro: plans and due dates');
    expect(english.untitledPlan).toBe('Lesson plan');
    expect(english.due('Quiz', 'Science 5')).toBe('Due: Quiz (Science 5)');
    expect(spanish.due('Prueba', 'Ciencias 5')).toBe('Entrega: Prueba (Ciencias 5)');
  });
});

describe('calendarHeaders', () => {
  it('serves iCalendar text privately, briefly cached, and kept out of search engines', () => {
    expect(calendarHeaders).toEqual({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="teacherhubpro.ics"',
      'Cache-Control': 'private, max-age=300',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
  });
});
