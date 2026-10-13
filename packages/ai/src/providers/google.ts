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
import { htmlToDsl } from '@tezmind/core';
import type { AIProvider, GenerateRequest, GenerateEvent, ModelInfo, TokenValidationResult } from '../provider';
import { FALLBACK_MODELS } from '../models.fallback';
import { buildScreenGenPrompt, buildImageToDesignPrompt, buildEditByPromptPrompt, buildValidationRetryPrompt } from '../prompts/v1';
import { buildHtmlSystemPrompt, buildHtmlUserPrompt } from '../prompts/html';
import { discoverGoogleModels } from '../models/registry';
import { validateScreensOutput, validatePatchOutput } from '../validator';
import { redactToken } from '../util';

const BASE_URL = 'https://generativelanguage.googleapis.com';
const MAX_RETRIES = 2;

// Models that definitely support vision
const VISION_PREFIXES = ['gemini-1.5', 'gemini-2', 'gemini-2.0', 'gemini-2.5', 'gemini-3'];

export function resolveGoogleModelId(modelId: string): string {
  const cleaned = (modelId || '').replace(/^models\//, '').trim();
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('gemini-') && lower.includes('-')) {
    return cleaned;
  }
  return 'gemini-2.0-flash';
}

export const CONTINUE_PROMPT =
  'Continue EXACTLY where you stopped. Output only the remaining HTML (do not repeat anything), then close all open tags.';

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
          url: `${BASE_URL}/v1beta/models?pageSize=1`,
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
      const discovered = await discoverGoogleModels(token, http, signal);
      return discovered.models;
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
        message: 'Invalid Google Gemini API key format. Get a free key at aistudio.google.com and update in Settings ⚙️.',
        retryable: false,
      };
      return;
    }

    yield { type: 'progress', stage: 'analyzing', message: 'Analyzing your request…' };

    const system = buildHtmlSystemPrompt(req);
    const user = buildHtmlUserPrompt(req);

    yield { type: 'progress', stage: 'generating', message: 'Generating design HTML…' };

    const resolvedModel = resolveGoogleModelId(req.modelId);

    const parts: unknown[] = [{ text: user }];

    if (req.imageBase64 && req.mode === 'image_to_design') {
      parts.unshift({
        inline_data: {
          mime_type: req.imageMimeType ?? 'image/png',
          data: req.imageBase64,
        },
      });
    }

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: req.maxOutputTokens ?? 16384,
      temperature: 0.4,
      responseMimeType: 'text/plain',
    };

    const contents = req.partial
      ? [
          { role: 'user', parts },
          { role: 'model', parts: [{ text: req.partial }] },
          { role: 'user', parts: [{ text: CONTINUE_PROMPT }] },
        ]
      : [{ role: 'user', parts }];

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig,
    });

    const MAX_HTTP_RETRIES = 3;
    let fullText = '';
    let lastUsage: { inputTokens: number; outputTokens: number } | null = null;
    let finishReason = 'STOP';

    for (let attempt = 0; attempt <= MAX_HTTP_RETRIES; attempt++) {
      if (signal?.aborted) {
        yield { type: 'error', code: 'cancelled', message: 'Cancelled', retryable: false };
        return;
      }

      let responseOrStream: any;
      try {
        const url = `${BASE_URL}/v1beta/models/${resolvedModel}:streamGenerateContent?alt=sse`;
        responseOrStream = await http.fetch(
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
      } catch (err) {
        if (signal?.aborted) {
          yield { type: 'error', code: 'cancelled', message: 'Cancelled', retryable: false };
          return;
        }
        if (attempt < MAX_HTTP_RETRIES) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500), 6000);
          yield {
            type: 'progress',
            stage: 'generating',
            message: `Connection failed, retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_HTTP_RETRIES})…`,
          };
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        yield { type: 'error', code: 'unknown', message: err instanceof Error ? err.message : 'Network error', retryable: true };
        return;
      }

      if ('body' in responseOrStream) {
        const status = responseOrStream.status;

        if (status === 400 || status === 403) {
          let errMsg = 'Invalid API key or unsupported model parameters.';
          try {
            const parsed = JSON.parse(responseOrStream.body) as { error?: { message?: string } };
            if (parsed.error?.message) errMsg = parsed.error.message;
          } catch { /* skip */ }
          yield { type: 'error', code: 'invalid_token', message: errMsg, retryable: false };
          return;
        }

        if (status === 404) {
          yield {
            type: 'error',
            code: 'model_not_found',
            message: `Model "${resolvedModel}" not found (HTTP 404). Try a different model.`,
            retryable: false,
          };
          return;
        }

        // Retryable status codes: 503 (overloaded), 429 (rate limit), 500/502/504 (server error)
        const isRetryable = status === 503 || status === 429 || (status >= 500 && status <= 504);
        if (isRetryable && attempt < MAX_HTTP_RETRIES) {
          const delayMs = Math.min(1500 * Math.pow(2, attempt) + Math.floor(Math.random() * 800), 6000);
          const reason = status === 503 ? 'Gemini model is currently overloaded (503)' : status === 429 ? 'Rate limit reached (429)' : `Server error (${status})`;
          yield {
            type: 'progress',
            stage: 'generating',
            message: `${reason}. Retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_HTTP_RETRIES})…`,
          };
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (status === 503) {
          yield {
            type: 'error',
            code: 'rate_limit',
            message: `Google Gemini service is temporarily overloaded (HTTP 503). The servers for "${resolvedModel}" are experiencing high traffic. Please try again shortly or switch to a different model (such as Gemini 2.0 Flash or Gemini 1.5 Pro).`,
            retryable: true,
          };
          return;
        }

        if (status === 429) {
          yield { type: 'error', code: 'rate_limit', message: 'Rate limit exceeded. Please wait a moment and try again.', retryable: true };
          return;
        }

        if (status !== 200) {
          let errMsg = `HTTP ${status}`;
          try {
            const parsed = JSON.parse(responseOrStream.body) as { error?: { message?: string } };
            if (parsed.error?.message) errMsg = parsed.error.message;
          } catch { /* skip */ }
          yield { type: 'error', code: 'unknown', message: errMsg, retryable: true };
          return;
        }

        // Non-streaming fallback
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
          yield { type: 'html_chunk', html: fullText };
        } catch {
          fullText = responseOrStream.body;
          yield { type: 'html_chunk', html: fullText };
        }
        break;
      } else {
        // Streaming SSE response
        const decoder = new TextDecoder();
        let lineBuffer = '';

        try {
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
                if (event.candidates?.[0]?.finishReason) {
                  finishReason = event.candidates[0].finishReason;
                }
                if (event.error?.message) {
                  const is503 = event.error.code === 503 || event.error.message.toLowerCase().includes('overloaded');
                  const errMsg = is503
                    ? `Google Gemini service is temporarily overloaded (503). The servers for "${resolvedModel}" are experiencing high traffic. Please try again shortly or switch to a different model (e.g. Gemini 2.0 Flash).`
                    : event.error.message;
                  yield { type: 'error', code: is503 ? 'rate_limit' : 'unknown', message: errMsg, retryable: true };
                  return;
                }
                const textPart = event.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textPart) {
                  fullText += textPart;
                  yield { type: 'html_chunk', html: textPart };
                }
                if (event.usageMetadata) {
                  lastUsage = {
                    inputTokens: event.usageMetadata.promptTokenCount,
                    outputTokens: event.usageMetadata.candidatesTokenCount,
                  };
                }
              } catch { /* skip incomplete SSE chunks */ }
            }
          }
          if (lastUsage) {
            yield {
              type: 'usage',
              inputTokens: lastUsage.inputTokens,
              outputTokens: lastUsage.outputTokens,
            };
          }
          break; // streaming done
        } catch (streamErr) {
          if (signal?.aborted) {
            yield { type: 'error', code: 'cancelled', message: 'Cancelled', retryable: false };
            return;
          }
          if (attempt < MAX_HTTP_RETRIES) {
            const delayMs = Math.min(1500 * Math.pow(2, attempt), 5000);
            yield {
              type: 'progress',
              stage: 'generating',
              message: `Stream interrupted, retrying in ${(delayMs / 1000).toFixed(1)}s…`,
            };
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          yield { type: 'error', code: 'unknown', message: streamErr instanceof Error ? streamErr.message : 'Stream error', retryable: true };
          return;
        }
      }
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

    yield { type: 'progress', stage: 'validating', message: 'Converting HTML to TezDSL tree…' };

    const { screens, errors } = htmlToDsl(fullText, {
      width: req.deviceWidth,
      height: req.deviceHeight,
      projectName: req.projectName,
    });

    if (screens && screens.length > 0) {
      yield { type: 'screens', screens };
      yield {
        type: 'done',
        finishReason,
        usage: lastUsage ? { input: lastUsage.inputTokens, output: lastUsage.outputTokens } : undefined,
      };
    } else {
      yield {
        type: 'error',
        code: 'validation_failed',
        message: `HTML conversion failed: ${errors.join('; ')}`,
        retryable: false,
      };
    }
  }
}
