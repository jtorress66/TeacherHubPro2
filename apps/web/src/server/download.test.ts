import { describe, expect, it } from 'vitest';
import { attachmentDisposition } from './download.ts';

describe('attachmentDisposition', () => {
  it('names the download, keeping accents and other scripts for browsers that read UTF-8', () => {
    expect(attachmentDisposition('Volcanoes.pptx')).toBe(
      `attachment; filename="Volcanoes.pptx"; filename*=UTF-8''Volcanoes.pptx`,
    );
    expect(attachmentDisposition('Fracción "1" 分数.pptx')).toBe(
      `attachment; filename="Fraccion _1_ __.pptx"; filename*=UTF-8''Fracci%C3%B3n%20%221%22%20%E5%88%86%E6%95%B0.pptx`,
    );
    expect(attachmentDisposition("Kid's (1).pptx")).toBe(
      `attachment; filename="Kid's (1).pptx"; filename*=UTF-8''Kid%27s%20%281%29.pptx`,
    );
  });
});
