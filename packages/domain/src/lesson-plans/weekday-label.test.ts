import { describe, expect, it } from 'vitest';
import { stripWeekdayLabel } from './weekday-label.ts';

describe('stripWeekdayLabel', () => {
  it('drops a weekday the title starts with, in every language', () => {
    expect(stripWeekdayLabel('Monday: Introduction - The Language of Fractions')).toBe(
      'Introduction - The Language of Fractions',
    );
    expect(stripWeekdayLabel('Martes - Práctica guiada')).toBe('Práctica guiada');
    expect(stripWeekdayLabel('mercredi : Pratique autonome')).toBe('Pratique autonome');
    expect(stripWeekdayLabel('Quinta-feira: Aplicação')).toBe('Aplicação');
    expect(stripWeekdayLabel('Freitag – Bewertung')).toBe('Bewertung');
    expect(stripWeekdayLabel('Lunedì: Introduzione')).toBe('Introduzione');
    expect(stripWeekdayLabel('星期一：认识分数')).toBe('认识分数');
    expect(stripWeekdayLabel('周五: 复习')).toBe('复习');
  });

  it('keeps a title that only mentions a weekday, or is nothing but one', () => {
    expect(stripWeekdayLabel('Mondays in the garden')).toBe('Mondays in the garden');
    expect(stripWeekdayLabel('Review of Monday: fractions')).toBe('Review of Monday: fractions');
    expect(stripWeekdayLabel('Monday')).toBe('Monday');
    expect(stripWeekdayLabel('Monday:')).toBe('Monday:');
  });
});
