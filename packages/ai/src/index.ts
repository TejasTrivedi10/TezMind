/**
 * @tezmind/ai — Public API
 */

// Provider interface + types
export type { AIProvider, AIProviderRegistry, ModelInfo, GenerateRequest, GenerateEvent, GenerateMode, GenerateErrorCode, TokenValidationResult } from './provider';

// Provider implementations
export { AnthropicProvider } from './providers/anthropic';
export { GoogleProvider, resolveGoogleModelId } from './providers/google';

// Prompts
export { buildScreenGenPrompt, buildImageToDesignPrompt, buildEditByPromptPrompt, buildValidationRetryPrompt, DSL_SCHEMA_SUMMARY, DSL_EXAMPLE_COMPACT } from './prompts/v1';
export type { ScreenGenParams, ImageToDesignParams, EditByPromptParams } from './prompts/v1';

// Validation
export { validateScreensOutput, validatePatchOutput, extractJson } from './validator';
export type { ValidationResult, ValidationSuccess, ValidationFailure } from './validator';

// Fallback models
export { FALLBACK_MODELS } from './models.fallback';

// Allowlists
export { ICON_NAMES, ICON_NAMES_ARRAY, ALLOWED_FONTS } from './allowlists';
export type { AllowedFont } from './allowlists';

// Utilities
export { redactToken, redactFromText } from './util';
