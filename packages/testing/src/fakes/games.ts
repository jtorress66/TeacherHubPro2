import { err, ok, type GameContent, type GameRequest, type Result } from '@thp/domain';
import type { DraftError, GameWriter, SeedSource } from '@thp/ports';
import { sampleGameContent } from '../game-content.ts';

/** Writes the sample content for the asked kind (or fails), and records each request. */
export class FakeGameWriter implements GameWriter {
  readonly requests: GameRequest[] = [];

  constructor(private readonly failure: DraftError['code'] | null = null) {}

  write(request: GameRequest): Promise<Result<GameContent, DraftError>> {
    this.requests.push(request);
    if (this.failure !== null) return Promise.resolve(err({ code: this.failure }));
    return Promise.resolve(ok(sampleGameContent[request.kind]));
  }
}

/** Predictable seeds: 1, 2, 3, … */
export class SequentialSeedSource implements SeedSource {
  private count = 0;

  next(): number {
    this.count += 1;
    return this.count;
  }
}
