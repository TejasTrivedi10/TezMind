/**
 * AI provider abstraction — all providers implement this interface.
 *
 * Rules:
 * - All HTTP goes through HostBridge.http, never direct fetch.
 * - Tokens are passed in at call time; never stored in provider instances.
 * - This file is pure TypeScript; no host imports.
 */

import type { HttpBridge, UiKitStyleContext } from '@tezmind/core';
import type { Screen } from '@tezmind/core';
import type { Patch } from '@tezmind/core';

// ─── MODEL INFO ──────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsVision: boolean;
  supportsStreaming: boolean;
  inputPricePer1kTokens?: number;   // USD
  outputPricePer1kTokens?: number;  // USD
  isDeprecated?: boolean;
}

// ─── GENERATE REQUEST ────────────────────────────────────────────────────────

export type GenerateMode = 'screen' | 'edit' | 'image_to_design' | 'variations';

export interface GenerateRequest {
  mode: GenerateMode;
  modelId: string;

  // Project context
  projectName: string;
  projectDescription: string;
  projectIdea?: string;
  styleKeywords?: string[];
  brandColor?: string;
  materialDesign3?: boolean;
  uiKit?: UiKitStyleContext;
  deviceWidth: number;
  deviceHeight: number;
  deviceType: string;
  existingScreensSummary?: string;  // compact summary for multi-screen consistency

  // Screen / edit context
  prompt: string;
  selectedNodeId?: string;          // for edit mode
  selectedNodeJson?: string;        // JSON of selected subtree for edit mode
  parentStyleSummary?: string;      // for edit mode context
  tokensJson?: string;              // serialized DesignTokens

  // Image inputs
  imageBase64?: string;
  imageMimeType?: string;

  // Options
  maxScreens?: number;              // for screen mode
  variationCount?: number;          // for variations mode
  maxOutputTokens?: number;         // token budget override
  partial?: string;                 // for continuation calls
}

// ─── GENERATE EVENTS ─────────────────────────────────────────────────────────

export type GenerateEvent =
  | { type: 'progress'; stage: 'analyzing' | 'planning' | 'generating' | 'validating'; message?: string }
  | { type: 'html_chunk'; html: string }
  | { type: 'screens'; screens: Screen[] }
  | { type: 'patch'; patch: Patch }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cost?: number }
  | { type: 'error'; code: GenerateErrorCode; message: string; retryable: boolean }
  | { type: 'done'; finishReason?: string; usage?: { input: number; output: number } };

export type GenerateErrorCode =
  | 'invalid_token'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'model_not_found'
  | 'context_too_long'
  | 'network_offline'
  | 'cancelled'
  | 'validation_failed'
  | 'unknown';

// ─── TOKEN VALIDATION ────────────────────────────────────────────────────────

export interface TokenValidationResult {
  ok: boolean;
  error?: string;
  /** Redacted token for display (e.g. "sk-ant-...abc") — never the full token. */
  redacted?: string;
}

// ─── PROVIDER INTERFACE ──────────────────────────────────────────────────────

export interface AIProvider {
  readonly id: 'anthropic' | 'google' | 'openai' | 'openrouter' | 'custom';
  readonly displayName: string;
  readonly defaultBaseUrl: string;

  /**
   * Validate that the token is syntactically and semantically valid.
   * Makes a lightweight API call (e.g. list models or check account).
   */
  validateToken(
    token: string,
    http: HttpBridge,
    signal?: AbortSignal,
  ): Promise<TokenValidationResult>;

  /**
   * Fetch the list of available models for this provider.
   * Falls back to the static fallback list if the API call fails.
   */
  listModels(
    token: string,
    http: HttpBridge,
    signal?: AbortSignal,
  ): Promise<ModelInfo[]>;

  /**
   * Check if a given model supports vision (image inputs).
   */
  supportsVision(modelId: string): boolean;

  /**
   * Generate screens or a patch.
   * Yields GenerateEvent objects; the caller should handle 'error' and 'done'.
   */
  generate(
    req: GenerateRequest,
    token: string,
    http: HttpBridge,
    signal?: AbortSignal,
  ): AsyncIterable<GenerateEvent>;
}

// ─── REGISTRY ────────────────────────────────────────────────────────────────

/** Map from provider id to provider instance. Populated by the web app. */
export type AIProviderRegistry = Map<string, AIProvider>;
