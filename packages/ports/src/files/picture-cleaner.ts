import type { ImageContentType, Result } from '@thp/domain';

export interface PictureCleanError {
  readonly code: 'unreadable';
}

/**
 * Removes what a picture carries besides the picture (camera details, GPS location, comments),
 * so an uploaded photo never tells where it was taken. Unreadable files are refused.
 */
export interface PictureCleaner {
  clean(bytes: Uint8Array, type: ImageContentType): Promise<Result<Uint8Array, PictureCleanError>>;
}
