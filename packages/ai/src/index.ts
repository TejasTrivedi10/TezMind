// Provider interface + types
export type { AIProvider, AIProviderRegistry, ModelInfo, GenerateRequest, GenerateEvent, GenerateMode, GenerateErrorCode, TokenValidationResult } from './provider';

// Provider implementations
export { AnthropicProvider } from './providers/anthropic';
export { GoogleProvider, resolveGoogleModelId } from './providers/google';

// Model discovery & testing
export { discoverGoogleModels, categorizeModels, testGoogleModelKey, parseModelVersionAndTier } from './models/registry';
export type { ModelCategoryGroup, ModelTestResult } from './models/registry';

// Prompts
export { buildScreenGenPrompt, buildImageToDesignPrompt, buildEditByPromptPrompt, buildValidationRetryPrompt, DSL_SCHEMA_SUMMARY, DSL_EXAMPLE_COMPACT } from './prompts/v1';
export { buildHtmlSystemPrompt, buildHtmlUserPrompt } from './prompts/html';
export { buildRefinerSystemPrompt, buildRefinerUserPrompt } from './prompts/refine';
export type { ScreenGenParams, ImageToDesignParams, EditByPromptParams } from './prompts/v1';

// Refiner
export { refinePrompt } from './refine';
export type { RefineRequest, RefineResult } from './refine';

// Validation
export { validateScreensOutput, validatePatchOutput, extractJson } from './validator';
export type { ValidationResult, ValidationSuccess, ValidationFailure } from './validator';

// Fallback models
export { FALLBACK_MODELS } from './models.fallback';

// Expander & Generation Pipeline (Contract v2)
export { expandPrompt, renderGeneratorPrompt } from './expand';
export type { LlmJson } from './expand';
export { expand, generateFromBrief, streamComplete, DEFAULT_PROFILE } from './pipeline';
export type { PipelineEvent, PipelineReport, PipelineDeps, ModelProfile, Usage } from './pipeline';
// Prompts
export { buildExpanderSystem } from './prompts/expand';
export { buildRepairPrompt } from './prompts/repair';

// Design-kit selection and project-creation options
export { UI_KIT_CATALOG, UI_KIT_OPTIONS, recommendUiKit, resolveUiKit, getUiKitContext, resolveUiKitAccent } from './ui_kits/catalog';
export type { UiKitOption } from './ui_kits/catalog';

// Hints parser
export { parseHints } from './parseHints';
export { composePaletteOptions, detectPaletteNeed, researchPaletteReferences } from './palette';
export type { DomainProfile, PaletteResearchResult } from './palette';

// Dynamic Design System & Component Pipeline
export { buildDesignSystemSystemPrompt, buildDesignSystemUserPrompt } from './designSystem/prompt';
export { generateDesignSystem, createFallbackDesignSystem } from './designSystem/generate';
export type { GenerateDesignSystemResult } from './designSystem/generate';
export { analyzeScreen, buildScreenAnalysisSystemPrompt, createFallbackComposition } from './components/analyze';
export { planComponents } from './components/plan';
export type { ComponentPlan } from './components/plan';
export { buildComponents } from './components/build';
export { ComponentRegistry } from './components/registry';

// Utilities
export { redactToken } from './util';

