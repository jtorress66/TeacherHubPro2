import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Files } from './make-video.ts';
import type { VoiceStore } from './narrator.ts';

/** Text files on disk, making their folders as needed. */
export class DiskFiles implements Files {
  async write(path: string, text: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  }
}

/** Spoken lines kept as mp3 files in one folder, named by their key. */
export class DiskVoiceStore implements VoiceStore {
  constructor(private readonly dir: string) {}

  path(key: string): string {
    return join(this.dir, `${key}.mp3`);
  }

  async has(key: string): Promise<boolean> {
    return access(this.path(key)).then(
      () => true,
      () => false,
    );
  }

  async write(key: string, audio: Uint8Array): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(key), audio);
  }
}
