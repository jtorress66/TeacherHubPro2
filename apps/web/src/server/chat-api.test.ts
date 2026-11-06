import { describe, expect, it } from 'vitest';
import { chatTokenOf, sendChatBody, startChatBody, visitorOf } from './chat-api.ts';

describe('the chat API helpers', () => {
  it('reads the visitor from the first forwarded address', () => {
    const request = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(visitorOf(request)).toBe('203.0.113.7');
    expect(visitorOf(new Request('https://x.test'))).toBe('unknown');
  });

  it('reads the chat token from its header only', () => {
    expect(
      chatTokenOf(new Request('https://x.test', { headers: { 'x-chat-token': ' abc ' } })),
    ).toBe('abc');
    expect(chatTokenOf(new Request('https://x.test?token=abc'))).toBe('');
  });

  it('checks the request shapes', () => {
    expect(
      startChatBody.safeParse({ role: 'teacher', interest: 'pricing', locale: 'en', page: null })
        .success,
    ).toBe(true);
    expect(startChatBody.safeParse({ role: 'teacher' }).success).toBe(false);
    expect(sendChatBody.safeParse({ message: 'x'.repeat(4001) }).success).toBe(false);
  });
});
