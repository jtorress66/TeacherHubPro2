import { describe, expect, it } from 'vitest';
import { imageTypeOf } from './image-type.ts';

const ascii = (text: string) => Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));

const sampleImages = {
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]),
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]),
  webp: new Uint8Array([...ascii('RIFF'), 4, 0, 0, 0, ...ascii('WEBP')]),
  gif: new Uint8Array([...ascii('GIF89a'), 0, 0]),
};

describe('imageTypeOf', () => {
  it('tells PNG, JPEG, WebP and GIF apart by their first bytes', () => {
    expect(imageTypeOf(sampleImages.png)).toBe('image/png');
    expect(imageTypeOf(sampleImages.jpeg)).toBe('image/jpeg');
    expect(imageTypeOf(sampleImages.webp)).toBe('image/webp');
    expect(imageTypeOf(sampleImages.gif)).toBe('image/gif');
    expect(imageTypeOf(new Uint8Array([...ascii('GIF87a')]))).toBe('image/gif');
  });

  it('knows nothing else, however the file is named', () => {
    expect(imageTypeOf(new TextEncoder().encode('<svg></svg>'))).toBeNull();
    expect(
      imageTypeOf(new Uint8Array([...ascii('RIFF'), 4, 0, 0, 0, ...ascii('WAVE')])),
    ).toBeNull();
    expect(imageTypeOf(new Uint8Array())).toBeNull();
  });
});
