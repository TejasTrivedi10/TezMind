/**
 * Anthropic (Claude) provider adapter.
 *
 * CORS: Anthropic supports direct browser calls with the header
 * `anthropic-dangerous-direct-browser-access: true`.
 * Documented in DECISIONS.md.
 *
 * PURE TYPESCRIPT — all HTTP via HttpBridge.
 */

import type { HttpBridge } from '@tezmind/core';
import type { AIProvider, GenerateRequest, GenerateEvent, ModelInfo, TokenValidationResult } from '../provider';
import { FALLBACK_MODELS } from '../models.fallback';
import { buildScreenGenPrompt, buildImageToDesignPrompt, buildEditByPromptPrompt, buildValidationRetryPrompt } from '../prompts/v1';
import { validateScreensOutput, validatePatchOutput } from '../validator';
import { redactToken } from '../util';

const BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';
const MAX_RETRIES = 2;

// Known vision-capable model prefixes
const VISION_MODELS = ['claude-3', 'claude-opus', 'claude-sonnet', 'claude-haiku'];

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly displayName = 'Anthropic (Claude)';
  readonly defaultBaseUrl = BASE_URL;

  private headers(token: string, stream = false): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': token,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true', // CORS: allows browser calls
      ...(stream ? {} : {}),
    };
  }

  supportsVision(modelId: string): boolean {
    return VISION_MODELS.some((prefix) => modelId.toLowerCase().includes(prefix.toLowerCase()));
  }

  async validateToken(token: string, http: HttpBridge, signal?: AbortSignal): Promise<TokenValidationResult> {
    try {
      const res = await http.fetch(
        {
          url: `${BASE_URL}/v1/models`,
          method: 'GET',
          headers: this.headers(token),
        },
        signal,
      );
      if ('body' in res) {
        if (res.status === 200) return { ok: true, redacted: redactToken(token) };
        if (res.status === 401) return { ok: false, error: 'Invalid API key', redacted: redactToken(token) };
        if (res.status === 403) return { ok: false, error: 'API key lacks permissions' };
        return { ok: false, error: `HTTP ${res.status}` };
      }
      return { ok: false, error: 'Unexpected streaming response during validation' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  }

  async listModels(token: string, http: HttpBridge, signal?: AbortSignal): Promise<ModelInfo[]> {
    try {
      const res = await http.fetch(
        { url: `${BASE_URL}/v1/models`, method: 'GET', headers: this.headers(token) },
        signal,
      );
      if (!('body' in res) || res.status !== 200) throw new Error('Failed to fetch models');
      const data = JSON.parse(res.body) as { data: { id: string; display_name?: string }[] };
      return data.data.map((m) => ({
        id: m.id,
        name: m.display_name ?? m.id,
        supportsVision: this.supportsVision(m.id),
        supportsStreaming: true,
        contextWindow: 200000,
      }));
    } catch {
      return FALLBACK_MODELS.anthropic ?? [];
    }
  }

  async *generate(
    req: GenerateRequest,
    token: string,
    http: HttpBridge,
    signal?: AbortSignal,
  ): AsyncIterable<GenerateEvent> {
    yield { type: 'progress', stage: 'analyzing', message: 'Analyzing your request…' };

    const { system, user } = this.buildPrompt(req);
    let lastUserMessage = user;

    yield { type: 'progress', stage: 'generating', message: 'Generating design…' };

    let fullText = '';
    let lastError: string[] = [];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      fullText = '';

      const messages: { role: string; content: unknown }[] = [
        {
          role: 'user',
          content: req.imageBase64
            ? [
                { type: 'image', source: { type: 'base64', media_type: req.imageMimeType ?? 'image/png', data: req.imageBase64 } },
                { type: 'text', text: lastUserMessage },
              ]
            : lastUserMessage,
        },
      ];

      if (attempt > 0) {
        messages.push({ role: 'assistant', content: fullText });
        messages.push({
          role: 'user',
          content: buildValidationRetryPrompt(user, lastError),
        });
      }

      const body = JSON.stringify({
        model: req.modelId,
        max_tokens: 8192,
        system,
        messages,
        stream: true,
      });

      try {
        const responseOrStream = await http.fetch(
          { url: `${BASE_URL}/v1/messages`, method: 'POST', headers: this.headers(token, true), body, stream: true },
          signal,
        );

        if ('body' in responseOrStream) {
          // Non-streaming response (shouldn't happen but handle gracefully)
          if (responseOrStream.status === 401) {
            yield { type: 'error', code: 'invalid_token', message: 'Invalid API key', retryable: false };
            return;
          }
          if (responseOrStream.status === 429) {
            yield { type: 'error', code: 'rate_limit', message: 'Rate limit exceeded. Please wait before retrying.', retryable: true };
            return;
          }
          try {
            const parsed = JSON.parse(responseOrStream.body) as {
              content?: { type: string; text?: string }[];
              error?: { message?: string };
            };
            if (parsed.error?.message) {
              yield { type: 'error', code: 'unknown', message: parsed.error.message, retryable: true };
              return;
            }
            const textBlock = parsed.content?.find((c) => c.type === 'text');
            fullText = textBlock?.text ?? responseOrStream.body;
          } catch {
            fullText = responseOrStream.body;
          }
        } else {
          // Streaming
          const decoder = new TextDecoder();
          let lineBuffer = '';
          for await (const chunk of responseOrStream) {
            if (signal?.aborted) {
              yield { type: 'error', code: 'cancelled', message: 'Cancelled', retryable: false };
              return;
            }
            lineBuffer += decoder.decode(chunk, { stream: true });
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') break;
              try {
                const event = JSON.parse(data) as { type: string; delta?: { type: string; text: string }; usage?: { input_tokens: number; output_tokens: number } };
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  fullText += event.delta.text;
                }
                if (event.type === 'message_delta' && event.usage) {
                  yield {
                    type: 'usage',
                    inputTokens: event.usage.input_tokens,
                    outputTokens: event.usage.output_tokens,
                  };
                }
              } catch { /* non-data line */ }
            }
          }
          if (lineBuffer.trim().startsWith('data:')) {
            const data = lineBuffer.trim().slice(5).trim();
            if (data !== '[DONE]') {
              try {
                const event = JSON.parse(data) as { type: string; delta?: { type: string; text: string } };
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  fullText += event.delta.text;
                }
              } catch { /* skip */ }
            }
          }
        }
      } catch (e) {
        if (signal?.aborted) {
          yield { type: 'error', code: 'cancelled', message: 'Cancelled', retryable: false };
          return;
        }
        yield { type: 'error', code: 'unknown', message: e instanceof Error ? e.message : 'Network error', retryable: true };
        return;
      }

      yield { type: 'progress', stage: 'validating', message: `Validating output${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}…` };

      // Validate
      const validation =
        req.mode === 'edit'
          ? validatePatchOutput(fullText)
          : validateScreensOutput(fullText);

      if (validation.ok) {
        if (validation.screens) yield { type: 'screens', screens: validation.screens };
        if (validation.patch) yield { type: 'patch', patch: validation.patch };
        yield { type: 'done' };
        return;
      }

      // Validation failed — retry?
      lastError = validation.errors;
      if (attempt >= MAX_RETRIES) {
        yield {
          type: 'error',
          code: 'validation_failed',
          message: `Design validation failed after ${MAX_RETRIES + 1} attempts. Errors: ${validation.errors.slice(0, 3).join('; ')}`,
          retryable: false,
        };
        return;
      }
      // Loop for retry
    }
  }

  private buildPrompt(req: GenerateRequest): { system: string; user: string } {
    if (req.mode === 'edit' && req.selectedNodeId && req.selectedNodeJson) {
      return buildEditByPromptPrompt({
        selectedNodeId: req.selectedNodeId,
        selectedNodeJson: req.selectedNodeJson,
        parentStyleSummary: req.parentStyleSummary,
        tokensJson: req.tokensJson,
        instruction: req.prompt,
        deviceType: req.deviceType,
      });
    }
    if (req.mode === 'image_to_design') {
      return buildImageToDesignPrompt({
        projectName: req.projectName,
        projectDescription: req.projectDescription,
        idea: req.projectIdea,
        styleKeywords: req.styleKeywords,
        brandColor: req.brandColor,
        deviceWidth: req.deviceWidth,
        deviceHeight: req.deviceHeight,
        deviceType: req.deviceType,
        existingScreensSummary: req.existingScreensSummary,
        tokensJson: req.tokensJson,
        followUpInstruction: req.prompt !== 'Reproduce this design' ? req.prompt : undefined,
      });
    }
    return buildScreenGenPrompt({
      projectName: req.projectName,
      projectDescription: req.projectDescription,
      idea: req.projectIdea,
      styleKeywords: req.styleKeywords,
      brandColor: req.brandColor,
      deviceWidth: req.deviceWidth,
      deviceHeight: req.deviceHeight,
      deviceType: req.deviceType,
      prompt: req.prompt,
      existingScreensSummary: req.existingScreensSummary,
      tokensJson: req.tokensJson,
      maxScreens: req.maxScreens ?? 1,
    });
  }
}
