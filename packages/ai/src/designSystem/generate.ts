import {
  validateDesignSystem,
  compileTokens,
  hashString,
  type DesignSystem,
  type ParsedHints,
  type PaletteOption,
  contrastRatio,
} from '@tezmind/core';
import type { HttpBridge, ProjectMeta } from '@tezmind/core';
import type { AIProvider, GenerateRequest } from '../provider';
import { extractJson } from '../validator';
import { UI_KIT_OPTIONS } from '../ui_kits/catalog';
import { buildDesignSystemSystemPrompt, buildDesignSystemUserPrompt } from './prompt';

export interface GenerateDesignSystemResult {
  designSystem: DesignSystem;
  tokensCss: string;
  tokensCssHash: string;
  isNew: boolean;
}

function lockChosenPalette(ds: DesignSystem, palette?: PaletteOption): DesignSystem {
  if (!palette) return ds;
  const c = palette.colors;
  const onSecondary = contrastRatio('#FFFFFF', c.secondary) >= contrastRatio('#111318', c.secondary) ? '#FFFFFF' : '#111318';
  return {
    ...ds,
    name: palette.name,
    mode: palette.mode,
    paletteName: palette.name,
    paletteSource: palette.source,
    colors: {
      ...ds.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      secondary: c.secondary,
      onSecondary,
      accent: c.accent,
      background: c.background,
      surface: c.surface,
      surfaceAlt: c.surfaceAlt,
      border: c.border,
      divider: c.border,
      text: c.text,
      textMuted: c.textMuted,
      textInverse: c.onPrimary,
      success: c.success,
      warning: c.warning,
      danger: c.danger,
      info: c.accent,
    },
  };
}

function primarySaturation(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const lightness = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function validateForProject(raw: unknown, project: ProjectMeta) {
  const validation = validateDesignSystem(raw);
  if (!validation.ok) return validation;
  const explicitlyMonochrome = /\b(black\s*(and|&)\s*white|monochrome|grayscale|greyscale)\b/i
    .test(`${project.userHints || ''} ${project.parsedHints?.raw || ''} ${project.description || ''} ${project.idea || ''}`);
  if (!explicitlyMonochrome && primarySaturation(validation.ds.colors.primary) < 0.12) {
    return { ok: false as const, errors: ['colors.primary is near-monochrome; choose a domain-appropriate colored primary because monochrome was not requested.'] };
  }
  return validation;
}

export function createFallbackDesignSystem(hints?: ParsedHints, seedKitId?: string): DesignSystem {
  const isDark = hints?.mode === 'dark';
  const kit = seedKitId ? UI_KIT_OPTIONS.find((k) => k.id === seedKitId) : undefined;

  const primary = hints?.colors?.[0]?.startsWith('#')
    ? hints.colors[0]
    : kit?.palette.primary || '#2563eb';

  return {
    version: 1,
    mode: isDark ? 'dark' : 'light',
    name: kit?.name || 'Modern Clean',
    vibe: hints?.vibe || kit?.vibe || 'Modern, accessible, and structured',
    colors: {
      primary,
      onPrimary: '#ffffff',
      secondary: isDark ? '#94a3b8' : '#475569',
      onSecondary: '#ffffff',
      accent: kit?.palette.secondary || '#f59e0b',
      background: isDark ? '#0f172a' : '#ffffff',
      surface: isDark ? '#1e293b' : '#f8fafc',
      surfaceAlt: isDark ? '#334155' : '#f1f5f9',
      border: isDark ? '#334155' : '#e2e8f0',
      divider: isDark ? '#1e293b' : '#f1f5f9',
      text: isDark ? '#f8fafc' : '#0f172a',
      textMuted: isDark ? '#94a3b8' : '#64748b',
      textInverse: isDark ? '#0f172a' : '#ffffff',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
    typography: {
      fontFamily: {
        heading: kit?.fonts.heading || 'Inter',
        body: kit?.fonts.body || 'Inter',
        mono: 'IBM Plex Mono',
      },
      scale: {
        xs: 11,
        sm: 13,
        base: 15,
        lg: 18,
        xl: 22,
        '2xl': 26,
        '3xl': 32,
        '4xl': 40,
      },
      weights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      lineHeights: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
      },
    },
    spacing: {
      base: 4,
      scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    },
    radius: {
      none: 0,
      sm: hints?.radius === 'sharp' ? 0 : 4,
      md: hints?.radius === 'sharp' ? 0 : 8,
      lg: hints?.radius === 'sharp' ? 0 : 12,
      xl: hints?.radius === 'sharp' ? 0 : 16,
      full: 9999,
      card: hints?.radius === 'sharp' ? 0 : 12,
      button: hints?.radius === 'sharp' ? 0 : hints?.radius === 'pill' ? 9999 : 8,
      input: hints?.radius === 'sharp' ? 0 : 8,
      sheet: hints?.radius === 'sharp' ? 0 : 16,
      chip: 9999,
      avatar: 9999,
    },
    elevation: {
      none: 'none',
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      md: '0 4px 6px rgba(0,0,0,0.1)',
      lg: '0 10px 15px rgba(0,0,0,0.15)',
    },
    borders: {
      width: 1,
      style: 'solid',
    },
    icons: {
      library: 'material-symbols',
      style: 'outline',
      tintCircle: true,
      strokeWidth: 2,
      size: {
        sm: 16,
        md: 24,
        lg: 32,
      },
    },
    motion: {
      durationFast: '150ms',
      durationBase: '250ms',
      durationSlow: '400ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    density: 'comfortable',
    rules: [
      'Use rounded-card for elevated surfaces',
      'Maintain clear visual hierarchy with type scale',
    ],
  };
}

export async function generateDesignSystem(params: {
  project: ProjectMeta;
  prompt: string;
  provider?: AIProvider;
  token?: string;
  http?: HttpBridge;
  signal?: AbortSignal;
  existingDs?: DesignSystem;
  llm?: import('../expand').LlmJson;
}): Promise<GenerateDesignSystemResult> {
  const { project, prompt, provider, token, http, signal, existingDs, llm } = params;

  // 1. If project already has a locked design system, reuse it
  if (existingDs) {
    const valid = validateForProject(lockChosenPalette(existingDs, project.chosenPalette), project);
    if (valid.ok) {
      const tokensCss = compileTokens(valid.ds);
      return {
        designSystem: valid.ds,
        tokensCss,
        tokensCssHash: hashString(tokensCss),
        isNew: false,
      };
    }
  }

  // 2. Generate new design system via AI
  const seedKit = project.seedKitId
    ? UI_KIT_OPTIONS.find((k) => k.id === project.seedKitId)
    : undefined;

  const systemPrompt = buildDesignSystemSystemPrompt();
  const userPrompt = buildDesignSystemUserPrompt({
    idea: prompt || project.description || project.name,
    name: project.name,
    parsedHints: project.parsedHints,
    seedKitName: seedKit?.name,
    seedKitDescription: seedKit?.description,
    seedPalette: seedKit?.palette as any,
    chosenPalette: project.chosenPalette ? {
      name: project.chosenPalette.name,
      mode: project.chosenPalette.mode,
      source: project.chosenPalette.source,
      colors: project.chosenPalette.colors,
    } : undefined,
    domainProfile: project.domainProfile,
  });

  try {
    let parsed: unknown = null;
    if (llm) {
      parsed = await llm.generateJson({
        system: systemPrompt,
        user: userPrompt,
        maxOutputTokens: 4096,
        temperature: 0.2,
      });
    } else if (provider && token && http) {
      const req: GenerateRequest = {
        mode: 'screen',
        modelId: project.defaultModelId || 'gemini-2.0-flash',
        projectName: project.name,
        projectDescription: project.description,
        deviceWidth: 393,
        deviceHeight: 852,
        deviceType: project.device || 'mobile-ios',
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        maxOutputTokens: 4096,
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
      const validation = validateForProject(parsed, project);
      if (validation.ok) {
        const locked = lockChosenPalette(validation.ds, project.chosenPalette);
        const tokensCss = compileTokens(locked);
        return {
          designSystem: locked,
          tokensCss,
          tokensCssHash: hashString(tokensCss),
          isNew: true,
        };
      }
      // If validation had errors, attempt one repair pass
      const repairPrompt = `${userPrompt}\n\nPREVIOUS ATTEMPT HAD THE FOLLOWING VALIDATION ERRORS:\n${validation.errors.join('\n')}\nFix all errors and return valid JSON.`;
      let repairedParsed: unknown = null;
      if (llm) {
        repairedParsed = await llm.generateJson({
          system: systemPrompt,
          user: repairPrompt,
          maxOutputTokens: 4096,
            temperature: 0.2,
        });
      } else if (provider && token && http) {
        const req: GenerateRequest = {
          mode: 'screen',
          modelId: project.defaultModelId || 'gemini-2.0-flash',
          projectName: project.name,
          projectDescription: project.description,
          deviceWidth: 393,
          deviceHeight: 852,
          deviceType: project.device || 'mobile-ios',
          prompt: `${systemPrompt}\n\n${repairPrompt}`,
          maxOutputTokens: 4096,
        };
        let rawRepaired = '';
        for await (const ev of provider.generate(req, token, http, signal)) {
          if (ev.type === 'html_chunk') rawRepaired += ev.html;
        }
        repairedParsed = extractJson(rawRepaired);
      }

      if (repairedParsed) {
        const repairedValidation = validateForProject(repairedParsed, project);
        if (repairedValidation.ok) {
          const locked = lockChosenPalette(repairedValidation.ds, project.chosenPalette);
          const tokensCss = compileTokens(locked);
          return {
            designSystem: locked,
            tokensCss,
            tokensCssHash: hashString(tokensCss),
            isNew: true,
          };
        }
      }
    }
  } catch (err) {
    // LLM call failed or aborted
    if (signal?.aborted) throw err;
  }

  // 3. Fallback: return deterministic safe design system
  const fallback = lockChosenPalette(createFallbackDesignSystem(project.parsedHints, project.seedKitId), project.chosenPalette);
  const fallbackTokensCss = compileTokens(fallback);
  return {
    designSystem: fallback,
    tokensCss: fallbackTokensCss,
    tokensCssHash: hashString(fallbackTokensCss),
    isNew: true,
  };
}
