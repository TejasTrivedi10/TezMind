import type { HttpBridge } from '@tezmind/core';
import type { ModelInfo } from '../provider';
import { FALLBACK_MODELS } from '../models.fallback';

export interface ModelCategoryGroup {
  latest: ModelInfo[];
  fast: ModelInfo[];
  quality: ModelInfo[];
  other: ModelInfo[];
}

export interface ModelTestResult {
  status: 'ready' | 'no_access' | 'quota_exhausted' | 'rate_limited' | 'invalid_key' | 'error';
  message: string;
  retryDelaySeconds?: number;
}

/**
 * Exclude non-text/generation models by substring
 */
const EXCLUDED_KEYWORDS = [
  'image',
  'tts',
  'transcribe',
  'live',
  'embedding',
  'aqa',
  'robotics',
  'veo',
  'imagen',
];

/**
 * Parse version and tier from model ID.
 * Examples:
 * - "models/gemini-2.0-flash" -> version 2.0, tier "flash"
 * - "models/gemini-1.5-pro" -> version 1.5, tier "pro"
 * - "models/gemini-3.5-flash-lite" -> version 3.5, tier "flash-lite"
 */
export function parseModelVersionAndTier(modelId: string): { version: number; tier: 'flash-lite' | 'flash' | 'pro' | 'other' } {
  const cleanId = modelId.replace(/^models\//, '');
  const match = cleanId.match(/^gemini-(\d+(?:\.\d+)?)-(flash-lite|flash|pro)/i);
  if (!match) {
    return { version: 0, tier: 'other' };
  }
  const version = parseFloat(match[1]);
  const tierRaw = match[2].toLowerCase();
  const tier = tierRaw === 'flash-lite' ? 'flash-lite' : tierRaw === 'flash' ? 'flash' : tierRaw === 'pro' ? 'pro' : 'other';
  return { version: isNaN(version) ? 0 : version, tier };
}

/**
 * Fetch and categorize Gemini models dynamically via GET /v1beta/models
 */
export async function discoverGoogleModels(token: string, http: HttpBridge, signal?: AbortSignal): Promise<{ models: ModelInfo[]; grouped: ModelCategoryGroup }> {
  const cleanToken = token.trim();
  const headers = { 'x-goog-api-key': cleanToken };

  try {
    const res = await http.fetch(
      {
        url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        method: 'GET',
        headers,
      },
      signal,
    );

    if (!('body' in res) || res.status !== 200) {
      return {
        models: FALLBACK_MODELS.google ?? [],
        grouped: categorizeModels(FALLBACK_MODELS.google ?? []),
      };
    }

    const data = JSON.parse(res.body) as {
      models?: {
        name: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
        inputTokenLimit?: number;
        outputTokenLimit?: number;
      }[];
    };

    if (!data.models || !Array.isArray(data.models)) {
      return {
        models: FALLBACK_MODELS.google ?? [],
        grouped: categorizeModels(FALLBACK_MODELS.google ?? []),
      };
    }

    const discovered: ModelInfo[] = [];

    for (const m of data.models) {
      const id = m.name.replace(/^models\//, '');
      const methods = m.supportedGenerationMethods ?? [];

      // Must support generateContent
      if (!methods.includes('generateContent')) continue;

      // Exclude non-UI/text models
      const idLower = id.toLowerCase();
      if (EXCLUDED_KEYWORDS.some((kw) => idLower.includes(kw))) continue;

      const { version, tier } = parseModelVersionAndTier(id);

      discovered.push({
        id,
        name: m.displayName || id,
        contextWindow: m.inputTokenLimit ?? 1048576,
        supportsVision: idLower.includes('vision') || idLower.includes('flash') || idLower.includes('pro') || version >= 1.5,
        supportsStreaming: true,
      });
    }

    if (discovered.length === 0) {
      return {
        models: FALLBACK_MODELS.google ?? [],
        grouped: categorizeModels(FALLBACK_MODELS.google ?? []),
      };
    }

    // Sort newest version first, then pro > flash > flash-lite
    discovered.sort((a, b) => {
      const pA = parseModelVersionAndTier(a.id);
      const pB = parseModelVersionAndTier(b.id);
      if (pB.version !== pA.version) return pB.version - pA.version;

      const tierScore = { pro: 3, flash: 2, 'flash-lite': 1, other: 0 };
      return tierScore[pB.tier] - tierScore[pA.tier];
    });

    return {
      models: discovered,
      grouped: categorizeModels(discovered),
    };
  } catch {
    return {
      models: FALLBACK_MODELS.google ?? [],
      grouped: categorizeModels(FALLBACK_MODELS.google ?? []),
    };
  }
}

/**
 * Group models into Latest, Fast, Quality, Other
 */
export function categorizeModels(models: ModelInfo[]): ModelCategoryGroup {
  const latest: ModelInfo[] = [];
  const fast: ModelInfo[] = [];
  const quality: ModelInfo[] = [];
  const other: ModelInfo[] = [];

  let highestFlashVersion = 0;
  for (const m of models) {
    const { version, tier } = parseModelVersionAndTier(m.id);
    if (tier === 'flash' && version > highestFlashVersion) {
      highestFlashVersion = version;
    }
  }

  for (const m of models) {
    const { version, tier } = parseModelVersionAndTier(m.id);
    if (tier === 'flash' && version === highestFlashVersion && highestFlashVersion > 0) {
      latest.push(m);
    } else if (tier === 'flash-lite') {
      fast.push(m);
    } else if (tier === 'pro') {
      quality.push(m);
    } else {
      other.push(m);
    }
  }

  return { latest, fast, quality, other };
}

/**
 * Test API key lazily against a specific selected model
 */
export async function testGoogleModelKey(
  token: string,
  modelId: string,
  http: HttpBridge,
  signal?: AbortSignal,
): Promise<ModelTestResult> {
  const cleanToken = token.trim();
  if (!cleanToken.startsWith('AIzaSy')) {
    return { status: 'invalid_key', message: 'Invalid API key format.' };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  try {
    const res = await http.fetch(
      {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanToken,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      },
      signal,
    );

    if ('body' in res) {
      if (res.status === 200) {
        return { status: 'ready', message: 'Key is valid and model is ready.' };
      }
      if (res.status === 401 || res.status === 400) {
        return { status: 'invalid_key', message: `Invalid key or request error (HTTP ${res.status}).` };
      }
      if (res.status === 403 || res.status === 404) {
        return { status: 'no_access', message: `No access to model "${modelId}" (HTTP ${res.status}).` };
      }
      if (res.status === 429) {
        const bodyLower = res.body.toLowerCase();
        if (bodyLower.includes('day') || bodyLower.includes('daily')) {
          return { status: 'quota_exhausted', message: 'Daily quota exhausted for this model.' };
        }
        return { status: 'rate_limited', message: 'Rate limited. Try again in a few seconds.', retryDelaySeconds: 10 };
      }
    }
    return { status: 'ready', message: 'Model test completed.' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Network error' };
  }
}
