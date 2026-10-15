import {
  CompositionSchema,
  type Composition,
  type DesignSystem,
  type ProjectContext,
} from '@tezmind/core';
import type { HttpBridge } from '@tezmind/core';
import type { AIProvider, GenerateRequest } from '../provider';
import { extractJson } from '../validator';

export function buildScreenAnalysisSystemPrompt(ds: DesignSystem): string {
  return `You are a mobile screen architecture expert.
Given a screen description, produce a structured Composition JSON object representing the sections, layouts, containers, and icon plan.

DESIGN SYSTEM CONTEXT:
- Mode: ${ds.mode}
- Icon library: ${ds.icons.library} (${ds.icons.style})
- Density: ${ds.density}

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "sections": [
    {
      "id": "header",
      "role": "header", // 'header' | 'hero' | 'summary' | 'list' | 'grid' | 'form' | 'actions' | 'filters' | 'footer' | 'nav' | 'empty-state'
      "layout": "row",  // 'row' | 'col' | 'grid-2' | 'grid-3' | 'wrap' | 'stack'
      "minItems": 1,
      "containers": [
        {
          "id": "c1",
          "role": "toolbar",
          "contentSlots": ["title", "action"],
          "icon": "arrow-left"
        }
      ]
    }
  ],
  "iconPlan": [
    {
      "name": "arrow-left",
      "where": "header toolbar",
      "purpose": "nav" // 'nav' | 'action' | 'status' | 'leading' | 'trailing' | 'decor'
    }
  ]
}

RULES:
1. Plan realistic, functional sections. E.g. for a taxi app: top app bar, hero destination picker / map, nearby ride list, payment bar.
2. For lists or grids, specify "minItems" (e.g. 3 to 6 items) so the generator produces rich populated content, not an empty placeholder.
3. Every icon planned in "iconPlan" must use a standard icon name from the vocabulary (e.g. search, map-pin, car, chevron-right, bell, star, user).
4. No markdown formatting outside the JSON. Return pure JSON.`;
}

export function createFallbackComposition(prompt: string): Composition {
  return {
    sections: [
      {
        id: 'header',
        role: 'header',
        layout: 'row',
        containers: [
          {
            id: 'app-bar',
            role: 'app-bar',
            contentSlots: ['back-btn', 'title', 'action'],
            icon: 'arrow-left',
          },
        ],
      },
      {
        id: 'main-content',
        role: 'list',
        layout: 'col',
        minItems: 3,
        containers: [
          {
            id: 'items',
            role: 'list-item',
            contentSlots: ['leading-visual', 'title-desc', 'trailing-action'],
          },
        ],
      },
      {
        id: 'bottom-actions',
        role: 'actions',
        layout: 'row',
        containers: [
          {
            id: 'action-bar',
            role: 'button-group',
            contentSlots: ['primary-action'],
          },
        ],
      },
    ],
    iconPlan: [
      { name: 'arrow-left', where: 'header', purpose: 'nav' },
      { name: 'search', where: 'main-content', purpose: 'action' },
      { name: 'chevron-right', where: 'list items', purpose: 'trailing' },
    ],
  };
}

export async function analyzeScreen(params: {
  prompt: string;
  designSystem: DesignSystem;
  projectContext?: ProjectContext;
  provider?: AIProvider;
  token?: string;
  http?: HttpBridge;
  signal?: AbortSignal;
  llm?: import('../expand').LlmJson;
}): Promise<Composition> {
  const { prompt, designSystem, provider, token, http, signal, llm } = params;

  const systemPrompt = buildScreenAnalysisSystemPrompt(designSystem);
  const userPrompt = `SCREEN PROMPT: ${prompt}\n\nProduce the Composition JSON object now.`;

  try {
    let parsed: unknown = null;
    if (llm) {
      parsed = await llm.generateJson({
        system: systemPrompt,
        user: userPrompt,
        maxOutputTokens: 2048,
        temperature: 0.2,
      });
    } else if (provider && token && http) {
      const req: GenerateRequest = {
        mode: 'screen',
        modelId: 'gemini-2.0-flash',
        projectName: 'Screen',
        projectDescription: prompt,
        deviceWidth: 393,
        deviceHeight: 852,
        deviceType: 'mobile-ios',
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        maxOutputTokens: 2048,
      };

      let rawJson = '';
      for await (const ev of provider.generate(req, token, http, signal)) {
        if (ev.type === 'html_chunk') {
          rawJson += ev.html;
        }
      }
      parsed = extractJson(rawJson);
    }

    if (parsed) {
      const valid = CompositionSchema.safeParse(parsed);
      if (valid.success) {
        return valid.data;
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  return createFallbackComposition(prompt);
}
