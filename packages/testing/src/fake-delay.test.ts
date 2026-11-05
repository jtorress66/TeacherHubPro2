import { describe, expect, it } from 'vitest';
import { delayContract } from './contracts/delay.contract.ts';
import { FakeDelay } from './fake-delay.ts';

delayContract('FakeDelay', () => new FakeDelay());

describe('FakeDelay', () => {
  it('records each wait without sleeping', async () => {
    const delay = new FakeDelay();
    await delay.wait(1000);
    await delay.wait(2000);
    expect(delay.waits).toEqual([1000, 2000]);
  });
});
