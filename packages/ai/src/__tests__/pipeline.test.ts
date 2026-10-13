import { streamComplete, generateFromBrief } from '../pipeline';
import type { AIProvider, GenerateRequest, GenerateEvent } from '../provider';
import type { ExpandedBrief, HttpBridge } from '@tezmind/core';

// Mock HttpBridge
const mockHttp: HttpBridge = {
  fetch: async () => ({ status: 200, headers: {}, body: '' }),
};

describe('pipeline streamComplete & generateFromBrief', () => {
  test('MAX_TOKENS triggers continuation and joins output', async () => {
    let callCount = 0;

    const mockProvider: AIProvider = {
      id: 'google',
      displayName: 'Mock Provider',
      defaultBaseUrl: 'https://mock',
      listModels: async () => [],
      supportsVision: () => true,
      validateToken: async () => ({ ok: true }),
      generate: async function* (req: GenerateRequest): AsyncGenerator<GenerateEvent> {
        callCount++;
        if (callCount === 1) {
          // First attempt stops mid-way with MAX_TOKENS
          yield { type: 'html_chunk', html: '<div class="screen"><div class="row px-4 py-3"><h1>Chat</h1></div><div class="scroll col px-4 py-3">' };
          yield { type: 'done', finishReason: 'MAX_TOKENS', usage: { input: 100, output: 50 } };
        } else {
          // Continuation call finishes with STOP
          yield { type: 'html_chunk', html: '<div class="bubble-in">Hi</div></div><div class="row px-4 py-3" data-role="composer"><input class="field fill" data-role="composer-input"><button class="icon-btn hug" data-role="send-button"></button></div></div>' };
          yield { type: 'done', finishReason: 'STOP', usage: { input: 150, output: 60 } };
        }
      },
    };

    const req: GenerateRequest = {
      mode: 'screen',
      modelId: 'test-model',
      projectName: 'Test',
      projectDescription: '',
      deviceWidth: 393,
      deviceHeight: 852,
      deviceType: 'mobile',
      prompt: 'Chat',
    };

    let resultHtml = '';
    let recovered = false;

    for await (const ev of streamComplete(mockProvider, req, 'fake-token', mockHttp, undefined, 1000)) {
      if (ev.type === 'complete') {
        resultHtml = ev.html;
        recovered = ev.truncatedRecovered;
      }
    }

    expect(callCount).toBe(2);
    expect(recovered).toBe(true);
    expect(resultHtml).toContain('<h1>Chat</h1>');
    expect(resultHtml).toContain('data-role="composer"');
    expect(resultHtml).toContain('data-role="send-button"');
  });

  test('3 failed continuations still yield result with required roles through autofix', async () => {
    const mockProvider: AIProvider = {
      id: 'google',
      displayName: 'Mock Provider',
      defaultBaseUrl: 'https://mock',
      listModels: async () => [],
      supportsVision: () => true,
      validateToken: async () => ({ ok: true }),
      generate: async function* (): AsyncGenerator<GenerateEvent> {
        // Always ends with MAX_TOKENS and cut-off tag
        yield { type: 'html_chunk', html: '<div class="screen"><div class="row px-4 py-3"><h1>Cutoff</h1></div><div class="scroll col px-4 py-3"><div cla' };
        yield { type: 'done', finishReason: 'MAX_TOKENS', usage: { input: 50, output: 30 } };
      },
    };

    const brief: ExpandedBrief = {
      title: 'Chat',
      purpose: 'Chat',
      style: { keywords: ['dark'], density: 'comfortable', radius: 'md' },
      outline: [],
      sampleContent: {},
      icons: ['send'],
      imageSlots: [],
      motion: { level: 'none', entrance: '', interactions: [] },
      refinedPrompt: 'Chat screen',
      archetypeId: 'chat',
      requiredRoles: ['composer', 'composer-input', 'send-button'],
      generatorPrompt: 'Chat',
    };

    let finalHtml = '';
    for await (const ev of generateFromBrief(brief, {
      provider: mockProvider,
      token: 'fake',
      http: mockHttp,
      systemPrompt: 'sys',
      reqBase: {
        mode: 'screen',
        modelId: 'test',
        projectName: 'Test',
        projectDescription: '',
        deviceWidth: 393,
        deviceHeight: 852,
        deviceType: 'mobile',
        prompt: 'test',
      },
      profile: { maxOutput: 100, repairPasses: 0, temp: 0 },
    })) {
      if (ev.type === 'result') {
        finalHtml = ev.html;
      }
    }

    // Autofix must guarantee the required roles are present even when LLM was truncated 3 times:
    expect(finalHtml).toContain('data-role="composer"');
    expect(finalHtml).toContain('data-role="composer-input"');
    expect(finalHtml).toContain('data-role="send-button"');
  });
});
