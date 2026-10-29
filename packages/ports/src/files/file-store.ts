import type { Result } from '@thp/domain';

export interface StoredFile {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface FileStoreError {
  readonly code: 'not_found' | 'unavailable';
}

/** Uploaded files (assignment attachments, school logos) by key. */
export interface FileStore {
  put(key: string, file: StoredFile): Promise<Result<true, FileStoreError>>;
  get(key: string): Promise<Result<StoredFile, FileStoreError>>;
  delete(key: string): Promise<Result<true, FileStoreError>>;
}
