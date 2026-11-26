/** The longest side a picture is shrunk to before upload: sharp on a projector, small to send. */
export const maxPictureEdge = 1600;

/** The file picker's types; the server still reads the type from the bytes. */
export const pictureAccept = 'image/png,image/jpeg,image/webp,image/gif';

/** The size that fits within `max` on both sides, keeping the shape; never larger. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
