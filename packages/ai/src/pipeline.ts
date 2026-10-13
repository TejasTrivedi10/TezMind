/**
 * TezMind End-to-End Generation Pipeline (Contract v2)
 *
 * Implements:
 * 1. expand(): short prompt → detailed brief
 * 2. streamComplete(): streaming with automatic continuation on MAX_TOKENS / unclosed tags
 * 3. generateFromBrief(): streamComplete → autofix → lint/repair loop → final result
 */

import {
  autofix,
  lint,
  lintBounds,
  openTagDepth,
  stripFences,
  joinContinuation,
  type ExpandInput,
  type ExpandedBrief,
  type Violation,
} from '@tezmind/core';
import type { HttpBridge } from '@tezmind/core';
import type { AIProvider, GenerateRequest, GenerateEvent } from './provider';
import { expandPrompt, type LlmJson } from './expand';
import { buildRepairPrompt } from './prompts/repair';

export interface ModelProfile {
  maxOutput: number;
  repairPasses: number;
  temp: number;
}

export const DEFAULT_PROFILE: ModelProfile = {
  maxOutput: 16384,
  repairPasses: 2,
  temp: 0.4,
};

export interface Usage {
  input: number;
  output: number;
}

export interface PipelineReport {
  usage: Usage;
  recovered: boolean;
  errors: Violation[];
  warnings: Violation[];
}

export type PipelineEvent =
  | { type: 'stage'; stage: 'expanding' | 'streaming' | 'recovering' | 'fixing' | 'repairing' | 'done' }
  | { type: 'html_chunk'; html: string }
  | { type: 'result'; html: string; report: PipelineReport };

export interface PipelineDeps {
  provider: AIProvider;
  token: string;
  http: HttpBridge;
  signal?: AbortSignal;
  systemPrompt: string;
  reqBase: GenerateRequest;
  profile?: ModelProfile;
  llm?: LlmJson;
}

/**
 * Streaming generator that detects truncation (MAX_TOKENS or unclosed HTML tags)
 * and issues continuation requests, joining results seamlessly.
 */
export async function* streamComplete(
  provider: AIProvider,
  req: GenerateRequest,
  token: string,
  http: HttpBridge,
  signal?: AbortSignal,
  maxOutput: number = 16384,
): AsyncGenerator<
  | { type: 'chunk'; html: string }
  | { type: 'complete'; html: string; truncatedRecovered: boolean; usage: Usage }
> {
  let html = '';
  let recovered = false;
  const usage: Usage = { input: 0, output: 0 };

  for (let attempt = 0; attempt < 3; attempt++) {
    let finish = 'STOP';
    let piece = '';

    const attemptReq: GenerateRequest = {
      ...req,
      maxOutputTokens: maxOutput,
      partial: attempt ? html : undefined,
    };

    for await (const ev of provider.generate(attemptReq, token, http, signal)) {
      if (ev.type === 'html_chunk') {
        piece += ev.html;
        yield { type: 'chunk', html: attempt ? joinContinuation(html, piece) : piece };
      }
      if (ev.type === 'done') {
        finish = ev.finishReason ?? 'STOP';
        if (ev.usage) {
          usage.input += ev.usage.input;
          usage.output += ev.usage.output;
        }
      }
    }

    html = stripFences(attempt ? joinContinuation(html, piece) : piece);
    const depth = openTagDepth(html);

    if (finish !== 'MAX_TOKENS' && depth === 0) {
      break;
    }
    recovered = true;
  }

  yield { type: 'complete', html, truncatedRecovered: recovered, usage };
}

/**
 * Expand a user prompt into a structured, role-verified brief.
 */
export async function expand(input: ExpandInput, llm: LlmJson): Promise<ExpandedBrief> {
  return expandPrompt(input, llm);
}

/**
 * Run the generation pipeline from an expanded brief.
 */
export async function* generateFromBrief(
  brief: ExpandedBrief,
  deps: PipelineDeps,
): AsyncGenerator<PipelineEvent> {
  const profile = deps.profile ?? DEFAULT_PROFILE;
  yield { type: 'stage', stage: 'streaming' };

  const genReq: GenerateRequest = {
    ...deps.reqBase,
    prompt: brief.generatorPrompt,
    maxOutputTokens: profile.maxOutput,
  };

  let html = '';
  let recovered = false;
  let usage: Usage = { input: 0, output: 0 };

  for await (const ev of streamComplete(
    deps.provider,
    genReq,
    deps.token,
    deps.http,
    deps.signal,
    profile.maxOutput,
  )) {
    if (ev.type === 'chunk') {
      yield { type: 'html_chunk', html: ev.html };
    } else {
      html = ev.html;
      recovered = ev.truncatedRecovered;
      usage = ev.usage;
    }
  }

  // A focused component edit returns one replacement node. Running it through
  // screen-level autofix/lint would wrap or rewrite the entire component tree.
  if (deps.reqBase.selectedNodeId) {
    const componentBounds = lintBounds(
      `<div class="screen">${html.trim()}</div>`,
      deps.reqBase.deviceWidth ?? 393,
    );
    yield {
      type: 'result',
      html: html.trim(),
      report: {
        usage,
        recovered,
        errors: componentBounds.filter((issue) => issue.severity === 'error'),
        warnings: componentBounds.filter((issue) => issue.severity === 'warn'),
      },
    };
    yield { type: 'stage', stage: 'done' };
    return;
  }

  if (recovered) {
    yield { type: 'stage', stage: 'recovering' };
  }

  const ctx = { required: brief.requiredRoles };
  const validate = (source: string) => [
    ...lint(source, ctx),
    ...lintBounds(source, deps.reqBase.deviceWidth ?? 393),
  ];
  yield { type: 'stage', stage: 'fixing' };
  let out = autofix(html, ctx);

  // LLM repair loop for remaining violations
  for (let pass = 0; pass < profile.repairPasses; pass++) {
    const errs = validate(out).filter((e) => e.severity === 'error');
    if (!errs.length) break;

    yield { type: 'stage', stage: 'repairing' };

    const repairPrompt = buildRepairPrompt(out, errs, brief);
    const repairReq: GenerateRequest = {
      ...deps.reqBase,
      prompt: repairPrompt,
      imageBase64: undefined,
      imageMimeType: undefined,
      maxOutputTokens: profile.maxOutput,
    };

    let repairedText = '';
    for await (const ev of deps.provider.generate(repairReq, deps.token, deps.http, deps.signal)) {
      if (ev.type === 'html_chunk') {
        repairedText += ev.html;
      }
      if (ev.type === 'done' && ev.usage) {
        usage.input += ev.usage.input;
        usage.output += ev.usage.output;
      }
    }

    if (repairedText.trim()) {
      out = autofix(repairedText, ctx);
    }
  }

  const remaining = validate(out);
  yield {
    type: 'result',
    html: out,
    report: {
      usage,
      recovered,
      errors: remaining.filter((e) => e.severity === 'error'),
      warnings: remaining.filter((e) => e.severity === 'warn'),
    },
  };

  yield { type: 'stage', stage: 'done' };
}
