/**
 * Google Gemini provider adapter.
 *
 * Uses the Gemini REST API (v1beta).
 * API key sent via `x-goog-api-key` header (never in the URL).
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

const BASE_URL = 'https://generativelanguage.googleapis.com';
const MAX_RETRIES = 2;

// Models that definitely support vision
const VISION_PREFIXES = ['gemini-1.5', 'gemini-2', 'gemini-2.0', 'gemini-2.5'];

// Models known NOT to support responseMimeType: 'application/json' — we disable it for these
// Most flash-lite and older 1.0 models have limited JSON mode support
const JSON_MODE_UNSUPPORTED_PATTERNS = ['flash-lite', 'gemini-1.0', 'aqa', 'embedding'];

/**
 * Map any user-facing or shorthand model ID to a real Gemini API model ID.
 * Real IDs are validated against the /v1beta/models endpoint.
 */
export function resolveGoogleModelId(modelId: string): string {
  const cleaned = (modelId || '').replace(/^models\//, '').trim();
  const lower = cleaned.toLowerCase();

  // Already a real model ID — pass through if it looks like one
  if (lower.startsWith('gemini-') && lower.includes('-')) {
    return cleaned;
  }

  // Fallback to a reliable model
  return 'gemini-1.5-flash';
}

/**
 * Returns true if this model supports `responseMimeType: 'application/json'`
 * in the generationConfig. Using it on unsupported models returns HTTP 400.
 */
function supportsJsonMode(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return !JSON_MODE_UNSUPPORTED_PATTERNS.some((p) => lower.includes(p));
}

export class GoogleProvider implements AIProvider {
  readonly id = 'google' as const;
  readonly displayName = 'Google (Gemini)';
  readonly defaultBaseUrl = BASE_URL;

  supportsVision(modelId: string): boolean {
    return VISION_PREFIXES.some((prefix) => modelId.toLowerCase().startsWith(prefix.toLowerCase()));
  }

  async validateToken(token: string, http: HttpBridge, signal?: AbortSignal): Promise<TokenValidationResult> {
    const cleanToken = (token || '').trim();
    if (!cleanToken.startsWith('AIzaSy')) {
      return {
        ok: false,
        error: 'Invalid Google Gemini API key format. Keys start with "AIzaSy...". Get a free key at aistudio.google.com',
        redacted: redactToken(token),
      };
    }
    try {
      const res = await http.fetch(
        {
          url: `${BASE_URL}/v1beta/models`,
          method: 'GET',
          headers: { 'x-goog-api-key': cleanToken },
        },
        signal,
      );
      if ('body' in res) {
        if (res.status === 200) return { ok: true, redacted: redactToken(token) };
        if (res.status === 400 || res.status === 403) return { ok: false, error: 'Invalid API key', redacted: redactToken(token) };
        return { ok: false, error: `HTTP ${res.status}` };
      }
      return { ok: false, error: 'Unexpected response' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
    }
  }

  async listModels(token: string, http: HttpBridge, signal?: AbortSignal): Promise<ModelInfo[]> {
    try {
      const res = await http.fetch(
        {
          url: `${BASE_URL}/v1beta/models`,
          method: 'GET',
          headers: { 'x-goog-api-key': token },
        },
        signal,
      );
      if (!('body' in res)) throw new Error('Streaming response not expected for listModels');
      if (res.status !== 200) throw new Error(`Failed to fetch models: HTTP ${res.status}`);

      const data = JSON.parse(res.body) as {
        models: {
          name: string;
          displayName?: string;
          inputTokenLimit?: number;
          supportedGenerationMethods?: string[];
        }[];
      };

      const UI_GEN_BLACKLIST = ['image', 'tts', 'embedding', 'aqa', 'retrieval'];

      return data.models
        .filter((m) => {
          const id = m.name.replace('models/', '').toLowerCase();
          const supportsGenerate = m.supportedGenerationMethods?.includes('generateContent');
          const isBlacklisted = UI_GEN_BLACKLIST.some((b) => id.includes(b));
          return supportsGenerate && !isBlacklisted;
        })
        .map((m) => {
          const id = m.name.replace('models/', '');
          return {
            id,
            name: m.displayName ?? id,
            contextWindow: m.inputTokenLimit,
            supportsVision: this.supportsVision(id),
            supportsStreaming: true,
          };
        })
        .sort((a, b) => {
          // Sort: newer/larger models first
          const score = (id: string) => {
            if (id.includes('2.5')) return 100;
            if (id.includes('2.0')) return 90;
            if (id.includes('1.5')) return 80;
            if (id.includes('pro')) return 5;
            return 0;
          };
          return score(b.id) - score(a.id);
        });
    } catch (e) {
      console.warn('[TezMind AI] listModels failed, using fallback:', e instanceof Error ? e.message : e);
      return FALLBACK_MODELS.google ?? [];
    }
  }

  async *generate(
    req: GenerateRequest,
    token: string,
    http: HttpBridge,
    signal?: AbortSignal,
  ): AsyncIterable<GenerateEvent> {
    const cleanToken = (token || '').trim();
    if (!cleanToken.startsWith('AIzaSy')) {
      yield {
        type: 'error',
        code: 'invalid_token',
        message: 'Invalid Google Gemini API key format. Gemini API keys start with "AIzaSy...". Get a free key at aistudio.google.com and update in Settings ⚙️.',
        retryable: false,
      };
      return;
    }

    yield { type: 'progress', stage: 'analyzing', message: 'Analyzing your request…' };

    const { system, user } = this.buildPrompt(req);

    yield { type: 'progress', stage: 'generating', message: 'Generating design…' };

    let lastError: string[] = [];
    let lastUserMessage = user;

    const resolvedModel = resolveGoogleModelId(req.modelId);
    const useJsonMode = supportsJsonMode(resolvedModel);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const parts: unknown[] = [{ text: lastUserMessage }];

      if (req.imageBase64 && req.mode === 'image_to_design') {
        parts.unshift({
          inline_data: {
            mime_type: req.imageMimeType ?? 'image/png',
            data: req.imageBase64,
          },
        });
      }

      const generationConfig: Record<string, unknown> = {
        maxOutputTokens: 8192,
        temperature: 0.4,
      };
      if (useJsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      const body = JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig,
      });

      let fullText = '';

      try {
        const url = `${BASE_URL}/v1beta/models/${resolvedModel}:streamGenerateContent?alt=sse`;
        const responseOrStream = await http.fetch(
          {
            url,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': cleanToken,
            },
            body,
            stream: true,
          },
          signal,
        );

        if ('body' in responseOrStream) {
          // Non-streaming fallback response
          if (responseOrStream.status === 400 || responseOrStream.status === 403) {
            let errMsg = 'Invalid API key or unsupported model parameters.';
            try {
              const parsed = JSON.parse(responseOrStream.body) as { error?: { message?: string } };
              if (parsed.error?.message) errMsg = parsed.error.message;
            } catch { /* skip */ }
            yield { type: 'error', code: 'invalid_token', message: errMsg, retryable: false };
            return;
          }
          if (responseOrStream.status === 404) {
            yield {
              type: 'error',
              code: 'model_not_found',
              message: `Model "${resolvedModel}" not found (HTTP 404). Try a different model.`,
              retryable: false,
            };
            return;
          }
          if (responseOrStream.status === 429) {
            yield { type: 'error', code: 'rate_limit', message: 'Rate limit exceeded. Please wait and try again.', retryable: true };
            return;
          }
          if (responseOrStream.status !== 200) {
            let errMsg = `HTTP ${responseOrStream.status}`;
            try {
              const parsed = JSON.parse(responseOrStream.body) as { error?: { message?: string } };
              if (parsed.error?.message) errMsg = parsed.error.message;
            } catch { /* skip */ }
            yield { type: 'error', code: 'unknown', message: errMsg, retryable: true };
            return;
          }
          // Parse non-streaming response body
          try {
            const parsed = JSON.parse(responseOrStream.body) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
              error?: { message?: string };
            };
            if (parsed.error?.message) {
              yield { type: 'error', code: 'unknown', message: parsed.error.message, retryable: true };
              return;
            }
            const textPart = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            fullText = textPart ?? responseOrStream.body;
          } catch {
            fullText = responseOrStream.body;
          }
        } else {
          // Streaming SSE path
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
                const event = JSON.parse(data) as {
                  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
                  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
                  error?: { message?: string; code?: number };
                };
                // Handle inline error in streaming response
                if (event.error?.message) {
                  yield { type: 'error', code: 'unknown', message: event.error.message, retryable: true };
                  return;
                }
                const textPart = event.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textPart) {
                  fullText += textPart;
                }
                if (event.usageMetadata) {
                  yield {
                    type: 'usage',
                    inputTokens: event.usageMetadata.promptTokenCount,
                    outputTokens: event.usageMetadata.candidatesTokenCount,
                  };
                }
              } catch { /* skip incomplete SSE chunks */ }
            }
          }

          // Flush remaining buffer
          if (lineBuffer.trim().startsWith('data:')) {
            const data = lineBuffer.trim().slice(5).trim();
            if (data !== '[DONE]') {
              try {
                const event = JSON.parse(data) as {
                  candidates?: { content?: { parts?: { text?: string }[] } }[];
                };
                const textPart = event.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textPart) fullText += textPart;
              } catch { /* skip */ }
            }
          }
        }

        if (typeof console !== 'undefined') {
          console.log(`[TezMind AI] Gemini (${resolvedModel}) raw output length:`, fullText.length);
          if (fullText.length > 0) {
            console.log('[TezMind AI] First 200 chars:', fullText.slice(0, 200));
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

      if (!fullText.trim()) {
        yield {
          type: 'error',
          code: 'unknown',
          message: `Model "${resolvedModel}" returned an empty response. Try a different model or simplify your prompt.`,
          retryable: false,
        };
        return;
      }

      yield { type: 'progress', stage: 'validating', message: `Validating output${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}…` };

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

      lastError = validation.errors;
      if (attempt >= MAX_RETRIES) {
        yield {
          type: 'error',
          code: 'validation_failed',
          message: `Design validation failed: ${validation.errors.slice(0, 3).join('; ')}`,
          retryable: false,
        };
        return;
      }
      lastUserMessage = buildValidationRetryPrompt(user, lastError);
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
