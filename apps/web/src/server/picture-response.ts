import type { StoredFile } from '@thp/ports';

/**
 * A game picture as a response: private to the person who may see it, cached by their browser
 * (a picture's id never points at different bytes), and never sniffed as anything but a picture.
 */
export function pictureResponse(file: StoredFile | null): Response {
  if (file === null) return new Response(null, { status: 404 });
  return new Response(new Blob([file.bytes.slice()], { type: file.contentType }), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      'Referrer-Policy': 'no-referrer',
    },
  });
}
