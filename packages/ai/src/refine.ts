/**
 * Prompt Refiner — takes a rough user prompt → RefinedBrief
 *
 * Uses a cheap Google model (Flash Lite tier), non-streaming JSON mode.
 * Caching: callers should cache by hash(prompt+ctx) in IndexedDB.
 * Fallback: on error / invalid JSON → returns null (caller uses raw prompt).
 *
 * PURE TYPESCRIPT — all HTTP via HttpBridge.
 */

import type { HttpBridge } from '@tezmind/core';
import { parseRefinedBrief, type RefinedBrief } from '@tezmind/core';
import { buildRefinerSystemPrompt, buildRefinerUserPrompt } from './prompts/refine';
import { ICON_NAMES } from './allowlists';

const BASE_URL = 'https://generativelanguage.googleapis.com';

/** Default cheap model for refiner (override per API key tier) */
const DEFAULT_REFINER_MODEL = 'gemini-2.0-flash-lite';

export interface RefineRequest {
  prompt: string;
  projectName?: string;
  projectDescription?: string;
  projectIdea?: string;
  styleKeywords?: string[];
  brandColor?: string;
  motionLevel?: 'none' | 'subtle' | 'rich';
  deviceWidth?: number;
  deviceHeight?: number;
  deviceType?: string;
  modelId?: string; // override model
}

export type RefineResult =
  | { ok: true; brief: RefinedBrief }
  | { ok: false; reason: string };

/**
 * Call the Gemini API in non-streaming JSON mode to produce a RefinedBrief.
 * Returns null on any error (caller should fall back to raw prompt).
 */
export async function refinePrompt(
  req: RefineRequest,
  token: string,
  http: HttpBridge,
  signal?: AbortSignal,
): Promise<RefineResult> {
  const modelId = req.modelId ?? DEFAULT_REFINER_MODEL;
  const deviceWidth = req.deviceWidth ?? 393;
  const deviceHeight = req.deviceHeight ?? 852;
  const deviceType = req.deviceType ?? 'mobile';

  const system = buildRefinerSystemPrompt(deviceWidth, deviceHeight, deviceType);
  const user = buildRefinerUserPrompt({
    prompt: req.prompt,
    projectName: req.projectName,
    projectDescription: req.projectDescription,
    projectIdea: req.projectIdea,
    styleKeywords: req.styleKeywords,
    brandColor: req.brandColor,
    motionLevel: req.motionLevel ?? 'subtle',
    deviceWidth,
    deviceHeight,
    deviceType,
  });

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  for (let attempt = 0; attempt <= 1; attempt++) {
    if (signal?.aborted) return { ok: false, reason: 'cancelled' };

    try {
      const url = `${BASE_URL}/v1beta/models/${modelId}:generateContent`;
      const resp = await http.fetch(
        {
          url,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': token,
          },
          body,
        },
        signal,
      );

      if (!('body' in resp)) {
        if (attempt < 1) continue;
        return { ok: false, reason: 'Unexpected streaming response from refiner' };
      }

      if (resp.status !== 200) {
        if (attempt < 1) continue;
        return { ok: false, reason: `Refiner HTTP ${resp.status}` };
      }

      let rawText: string = resp.body ?? '';
      try {
        const parsed = JSON.parse(rawText) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          error?: { message?: string };
        };
        if (parsed.error?.message) {
          if (attempt < 1) continue;
          return { ok: false, reason: parsed.error.message };
        }
        rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? rawText;
      } catch { /* rawText already has the content */ }

      // Strip markdown fences if model leaked them
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      let jsonObj: unknown;
      try {
        jsonObj = JSON.parse(rawText);
      } catch {
        if (attempt < 1) continue;
        return { ok: false, reason: 'Refiner returned invalid JSON' };
      }

      // Validate + filter icons
      const result = parseRefinedBrief(jsonObj);
      if (!result.ok) {
        if (attempt < 1) continue;
        return { ok: false, reason: `Brief schema invalid: ${result.error}` };
      }

      // Post-process: filter icon names to allowlist
      const iconSet = new Set(Array.from(ICON_NAMES));
      result.brief.icons = result.brief.icons.filter((n) => iconSet.has(n as any));

      return { ok: true, brief: result.brief };
    } catch (err) {
      if (signal?.aborted) return { ok: false, reason: 'cancelled' };
      if (attempt < 1) continue;
      return { ok: false, reason: err instanceof Error ? err.message : 'Network error' };
    }
  }

  return { ok: false, reason: 'Max attempts exceeded' };
}
