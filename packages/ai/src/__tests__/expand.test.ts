import { expandPrompt } from '../expand';
import type { ExpandInput } from '@tezmind/core';

const chatInput: ExpandInput = {
  prompt: 'Generate Chat Screen UI: bottom show input box with send button',
  project: {
    name: 'TezChat',
    brand: '#6C5CE7',
    keywords: ['clean', 'modern'],
  },
  device: { w: 393, h: 852, kind: 'mobile' },
  motionLevel: 'subtle',
};

describe('expandPrompt()', () => {
  test('works with LLM failing (deterministic fallback)', async () => {
    const b = await expandPrompt(chatInput, {
      generateJson: async () => {
        throw new Error('LLM unavailable');
      },
    });

    expect(b.generatorPrompt).toContain('data-role="send-button"');
    expect(b.generatorPrompt).toContain('data-role="composer-input"');
    expect(b.outline.some((o) => /composer/i.test(o.component))).toBe(true);
    expect(b.requiredRoles).toEqual(
      expect.arrayContaining(['app-bar', 'message-list', 'composer', 'composer-input', 'send-button'])
    );
  });

  test('LLM omitting roles still yields them in outline', async () => {
    const b = await expandPrompt(chatInput, {
      generateJson: async () => ({
        title: 'Chat Screen',
        purpose: 'Chat with someone',
        outline: [
          { region: 'header', component: 'app bar', notes: 'title only' },
          { region: 'body', component: 'message list', notes: 'messages' },
        ], // omitted composer and send-button!
      }),
    });

    // The guaranteed merge must have injected composer & send-button into outline:
    expect(b.outline.some((o) => /send button/i.test(o.component))).toBe(true);
    expect(b.outline.some((o) => /composer/i.test(o.component))).toBe(true);
    expect(b.generatorPrompt).toContain('data-role="send-button"');
  });

  test('rejects malformed structured output and keeps the original request', async () => {
    const b = await expandPrompt(chatInput, {
      generateJson: async () => ({
        title: 42,
        style: { keywords: ['clean'], density: 'ultra', radius: 'lg' },
        outline: [{ region: 'sidebar', component: null, notes: 9 }],
        motion: { level: 'wild', entrance: 12, interactions: [] },
      }),
    });

    expect(b.title).toBe(chatInput.prompt.slice(0, 40));
    expect(b.generatorPrompt).toContain(chatInput.prompt);
    expect(b.generatorPrompt).toContain('data-role="composer-input"');
  });

  test('filters unsupported icons from otherwise valid model output', async () => {
    const b = await expandPrompt(chatInput, {
      generateJson: async () => ({
        icons: ['send', '<script>'],
      }),
    });

    expect(b.icons).toContain('send');
    expect(b.icons).not.toContain('<script>');
  });

  test('builds a useful brief for image-only generation', async () => {
    const b = await expandPrompt({ ...chatInput, prompt: '' }, {
      generateJson: async () => { throw new Error('offline'); },
    });

    expect(b.title).toBe('TezChat — Screen');
    expect(b.purpose).toContain('Recreate the supplied reference');
    expect(b.generatorPrompt).toContain('Recreate the supplied reference faithfully');
  });
});
