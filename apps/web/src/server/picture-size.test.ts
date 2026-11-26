import { describe, expect, it } from 'vitest';
import { fitWithin, pictureAccept } from './picture-size.ts';

describe('fitWithin', () => {
  it('shrinks a big photo to fit, keeping its shape', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('leaves a picture that already fits as it is', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('pictureAccept', () => {
  it('offers only the picture types the app keeps', () => {
    expect(pictureAccept).toBe('image/png,image/jpeg,image/webp,image/gif');
  });
});
