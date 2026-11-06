import { describe, expect, it } from 'vitest';
import { draftFailureMessage, planErrors } from './planner-messages.ts';

describe('planErrors', () => {
  it.each([
    [
      { field: 'weeks.0.weekStart', code: 'not_allowed' },
      'w0.weekStart',
      'Choose a Monday.',
      'Elige un lunes.',
    ],
    [
      { field: 'weeks.1.weekStart', code: 'invalid_order' },
      'w1.weekStart',
      'Week 2 must start after week 1.',
      'La semana 2 debe empezar después de la semana 1.',
    ],
    [
      { field: 'weeks.0.standards', code: 'not_allowed' },
      'w0.standards',
      'Only official Common Core codes go here, one per line. Put your school’s own codes (such as Puerto Rico standards) under Standards by category.',
      'Aquí van solo códigos oficiales Common Core, uno por línea. Escribe los códigos de tu escuela (como los estándares de Puerto Rico) en Estándares por categoría.',
    ],
    [
      { field: 'weeks.0.skills', code: 'out_of_range' },
      'w0.skills',
      'Up to 4 skills.',
      'Hasta 4 destrezas.',
    ],
    [
      { field: 'weeks.0.domainStandards.reading', code: 'invalid_format' },
      'w0.domain.reading',
      'Separate codes with commas; a code has no spaces.',
      'Separa los códigos con comas; un código no lleva espacios.',
    ],
    [
      { field: 'weeks.1.domainStandards.writing', code: 'out_of_range' },
      'w1.domain.writing',
      'Up to 12 codes per category.',
      'Hasta 12 códigos por categoría.',
    ],
    [{ field: 'start', code: 'not_allowed' }, 'start', 'Choose a Monday.', 'Elige un lunes.'],
    [
      { field: 'weeks.0.days.2.theme', code: 'too_long' },
      'w0.d2.theme',
      'This is too long.',
      'Esto es demasiado largo.',
    ],
  ] as const)('puts %o under %s in English and Spanish', (error, field, en, es) => {
    expect(planErrors(error, 'en')).toEqual({ [field]: en });
    const spanish = planErrors(error, 'es')[field];
    expect(spanish).toBeDefined();
    if (es !== 'Esto es demasiado largo.') expect(spanish).toBe(es);
  });

  it('puts refusals about the whole plan under the form', () => {
    expect(planErrors({ code: 'not_found' }, 'en')).toEqual({ form: 'We could not find that.' });
    expect(planErrors({ code: 'subscription_required' }, 'es')).toEqual({
      form: 'Para crear borradores con IA necesitas una prueba o un plan activo.',
    });
  });
});

describe('draftFailureMessage', () => {
  it('explains a PDF without text or one that cannot be opened', () => {
    expect(draftFailureMessage('pdf_no_text', 'en')).toMatch(/no text to read/);
    expect(draftFailureMessage('pdf_unreadable', 'es')).toMatch(/No se pudo abrir este PDF/);
  });

  it('explains each failure and treats anything else as a general failure', () => {
    expect(draftFailureMessage('timed_out', 'en')).toBe(
      'Drafting took too long. Please try again.',
    );
    expect(draftFailureMessage('ai_unavailable', 'es')).toBe(
      'La IA está ocupada en este momento. Inténtalo de nuevo en un momento.',
    );
    expect(draftFailureMessage('Error: secret', 'en')).toBe(
      'Something went wrong. Please try again.',
    );
    expect(draftFailureMessage(null, 'en')).toBe('Something went wrong. Please try again.');
  });
});
