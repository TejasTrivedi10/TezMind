/**
 * Fallback model list — used when a provider's API is unavailable.
 * These are real model IDs as returned by the respective provider APIs.
 * Update this list when providers deprecate or add models.
 *
 * Google Gemini IDs: verified against GET /v1beta/models (Oct 2026)
 * Anthropic IDs: verified against GET /v1/models
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

import type { ModelInfo } from './provider';

export const FALLBACK_MODELS: Record<string, ModelInfo[]> = {
  google: [
    {
      id: 'gemini-2.5-flash-preview-05-20',
      name: 'Gemini 2.5 Flash Preview',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gemini-2.5-pro-preview-06-05',
      name: 'Gemini 2.5 Pro Preview',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2097152,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gemini-1.5-flash-8b',
      name: 'Gemini 1.5 Flash 8B',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
  ],

  anthropic: [
    {
      id: 'claude-opus-4-5',
      name: 'Claude Opus 4.5',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'claude-sonnet-4-5',
      name: 'Claude Sonnet 4.5',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
    },
  ],

  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'o1',
      name: 'OpenAI o1',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: false,
    },
    {
      id: 'o1-mini',
      name: 'OpenAI o1 Mini',
      contextWindow: 128000,
      supportsVision: false,
      supportsStreaming: false,
    },
  ],

  openrouter: [
    {
      id: 'anthropic/claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet (via OpenRouter)',
      contextWindow: 200000,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'google/gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash (via OpenRouter)',
      contextWindow: 1048576,
      supportsVision: true,
      supportsStreaming: true,
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o (via OpenRouter)',
      contextWindow: 128000,
      supportsVision: true,
      supportsStreaming: true,
    },
  ],
};
