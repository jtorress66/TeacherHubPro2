import { describe, expect, it } from 'vitest';
import { describeStandard } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { standardSourceName } from './standard-source.ts';

describe('standardSourceName', () => {
  it('names the official list a code comes from, or says it is the teacher’s own', () => {
    const t = createTranslator('es');

    expect(standardSourceName('es', describeStandard('CCSS.Math.Content.4.NF.A.1'))).toBe(
      t('standards.set_common_core'),
    );
    expect(standardSourceName('es', describeStandard('K.LS.1'))).toBe(
      t('standards.set_puerto_rico'),
    );
    expect(standardSourceName('es', describeStandard('MI.ESCUELA.7'))).toBe(
      t('standards.source_typed'),
    );
  });
});
