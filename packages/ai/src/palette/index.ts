import type { PaletteOption, ParsedHints, ProjectMeta } from '@tezmind/core';
import { UI_KIT_CATALOG } from '../ui_kits/catalog';

interface DomainPreset {
  domain: string;
  audience: string;
  mood: string[];
  hues: number[];
}

const DOMAIN_PRESETS: Array<{ match: RegExp; value: DomainPreset }> = [
  { match: /pet|vet|animal|dog|cat/, value: { domain: 'pet care', audience: 'pet owners', mood: ['warm', 'trustworthy', 'playful'], hues: [145, 38, 205, 282] } },
  { match: /taxi|ride|cab|transport|travel|booking|flight|hotel/, value: { domain: 'travel and mobility', audience: 'travelers and commuters', mood: ['confident', 'clear', 'energetic'], hues: [218, 38, 165, 282] } },
  { match: /bank|financ|wallet|payment|invest|crypto/, value: { domain: 'finance', audience: 'people managing money', mood: ['trustworthy', 'calm', 'precise'], hues: [215, 165, 38, 265] } },
  { match: /fitness|workout|health|calorie|wellness/, value: { domain: 'health and fitness', audience: 'people building healthy habits', mood: ['energizing', 'optimistic', 'supportive'], hues: [145, 38, 205, 328] } },
  { match: /kids|child|storybook|school|learn|education/, value: { domain: 'learning', audience: 'learners and families', mood: ['playful', 'friendly', 'encouraging'], hues: [38, 205, 328, 145] } },
  { match: /meditat|mindful|sleep|calm/, value: { domain: 'mindfulness', audience: 'people seeking calm and focus', mood: ['calm', 'gentle', 'restorative'], hues: [265, 165, 205, 38] } },
  { match: /food|delivery|restaurant|recipe|meal/, value: { domain: 'food and dining', audience: 'diners and home cooks', mood: ['appetizing', 'welcoming', 'lively'], hues: [12, 38, 145, 205] } },
  { match: /sms|message|chat|social|community/, value: { domain: 'messaging', audience: 'people connecting with others', mood: ['approachable', 'expressive', 'clear'], hues: [265, 205, 145, 328] } },
  { match: /developer|code|devtool|software|dashboard|productivity/, value: { domain: 'developer tools', audience: 'builders and technical teams', mood: ['focused', 'precise', 'modern'], hues: [225, 165, 282, 38] } },
];

const DIRECTIONS = [
  { name: 'Fresh & Trustworthy', description: 'Clear, grounded colors for everyday confidence.' },
  { name: 'Warm & Playful', description: 'A welcoming, human palette with a lively accent.' },
  { name: 'Calm & Premium', description: 'A composed direction with softer supporting tones.' },
  { name: 'Bold & Energetic', description: 'Confident contrast and a memorable color signature.' },
];

export interface DomainProfile {
  domain: string;
  audience: string;
  mood: string[];
}

function retrievePaletteKits(query: string, profile: DomainProfile) {
  const terms = new Set(`${query} ${profile.domain} ${profile.audience} ${profile.mood.join(' ')}`.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const stopWords = new Set(['app', 'application', 'screen', 'user', 'users', 'and', 'the', 'for', 'with', 'based', 'make', 'create', 'design']);
  return UI_KIT_CATALOG.map((kit) => {
    const corpus = `${kit.name} ${kit.vibe} ${kit.description} ${kit.keywords.join(' ')}`.toLowerCase();
    const corpusTerms = new Set(corpus.match(/[a-z0-9]+/g) ?? []);
    const overlap = [...terms].filter((term) => term.length > 2 && !stopWords.has(term) && corpusTerms.has(term)).length;
    const domainMatch = kit.matchTerms.some((pattern) => pattern.test(query)) ? 4 : 0;
    return { kit, score: overlap + domainMatch };
  }).filter(({ kit, score }) => score > 0 && saturation(kit.palette.primary) >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ kit }) => kit);
}

export interface PaletteResearchResult {
  source: 'grounded' | 'knowledge';
  colors: string[];
  references: string[];
}

/** Ask Gemini with Google Search grounding for palette references; use local knowledge on any failure. */
export async function researchPaletteReferences(params: {
  domain: string;
  mood: string[];
  token?: string;
  http?: import('@tezmind/core').HttpBridge;
  modelId?: string;
}): Promise<PaletteResearchResult> {
  const fallback: PaletteResearchResult = { source: 'knowledge', colors: [], references: [] };
  if (!params.token || !params.http) return fallback;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const model = (params.modelId || 'gemini-2.0-flash').replace(/^models\//, '');
    const response = await params.http.fetch({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': params.token },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `Use Google Search to research real UI color palette references suitable for a ${params.domain} mobile app for ${params.mood.join(', ')}. Return 4 distinct palette references, each with a short name, target audience, and 3 to 5 exact #RRGGBB colors. Prefer palettes documented by design systems, product brands, or reputable design publications. Do not invent citations.` }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
      }),
    }, controller.signal);
    if (!('body' in response) || response.status < 200 || response.status >= 300) return fallback;
    const payload = JSON.parse(response.body) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> } }>;
    };
    const candidate = payload.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('\n') ?? '';
    const colors = Array.from(new Set(text.match(/#[0-9a-f]{6}\b/gi) ?? []))
      .map((color) => color.toUpperCase())
      .filter((color) => saturation(color) >= 0.2)
      .slice(0, 12);
    const references = groundingChunks.map((chunk) => chunk.web?.uri).filter((uri): uri is string => {
      if (!uri) return false;
      try { return new URL(uri).protocol === 'https:'; } catch { return false; }
    }).slice(0, 8);
    if (references.length === 0 || colors.length < 4) return fallback;
    return { source: 'grounded', colors, references };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

export function detectPaletteNeed(project: Pick<ProjectMeta, 'name' | 'idea' | 'description' | 'designMode' | 'seedKitId' | 'parsedHints'>, prompt = ''): {
  needResearch: boolean;
  domainProfile: DomainProfile;
  source: 'hint' | 'knowledge';
} {
  const text = `${project.name} ${project.idea || ''} ${project.description || ''} ${prompt}`.toLowerCase();
  const preset = DOMAIN_PRESETS.find((item) => item.match.test(text))?.value
    ?? { domain: 'mobile app', audience: 'everyday users', mood: ['clear', 'modern', 'approachable'], hues: [225, 165, 38, 282] };
  const hints = project.parsedHints;
  const needResearch = !(project.designMode === 'seed' || (!!hints?.colors?.length && !!hints.mode));
  return {
    needResearch,
    domainProfile: {
      domain: preset.domain,
      audience: preset.audience,
      mood: hints?.vibe ? hints.vibe.split(',').map((value) => value.trim()).filter(Boolean) : preset.mood,
    },
    source: hints?.colors?.length ? 'hint' : 'knowledge',
  };
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0]
    : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma]
      : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function hexRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  return hexRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function saturation(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function bestText(background: string): string {
  return contrast('#FFFFFF', background) >= contrast('#111318', background) ? '#FFFFFF' : '#111318';
}

function parseColor(value: string): string | null {
  const hex = value.trim().match(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i)?.[0];
  if (hex) return hex.length === 4 ? `#${hex.slice(1).split('').map((char) => char + char).join('')}`.toUpperCase() : hex.toUpperCase();
  const map: Record<string, string> = {
    purple: '#7856D6', violet: '#7856D6', indigo: '#4F55C7', blue: '#2764D8', sky: '#1785C1', cyan: '#008D9C',
    teal: '#008577', emerald: '#16845B', green: '#34823B', lime: '#63851A', yellow: '#B07800', amber: '#A86600',
    orange: '#B84F00', red: '#BD3434', rose: '#B63A62', pink: '#B33D79', fuchsia: '#9E3BA4', black: '#272727',
    white: '#4F55C7', monochrome: '#4F55C7',
  };
  return map[value.toLowerCase()] ?? null;
}

function buildOption(
  index: number,
  hue: number,
  profile: DomainProfile,
  mode: 'light' | 'dark',
  source: PaletteOption['source'],
  primaryOverride?: string,
  monochrome = false,
  coolPalette = false,
  customDarkColors?: { background: string; surface: string; surfaceAlt: string; text: string; textMuted: string; border: string },
): PaletteOption {
  const primary = primaryOverride || (monochrome
    ? hslToHex(0, 0, [28, 38, 48, 58][index])
    : hslToHex(hue, [68, 72, 48, 78][index], [42, 43, 38, 38][index]));
  let onPrimary = bestText(primary);
  if (contrast(onPrimary, primary) < 4.5) {
    onPrimary = contrast('#FFFFFF', primary) >= contrast('#111318', primary) ? '#FFFFFF' : '#111318';
  }
  const background = mode === 'dark' ? customDarkColors?.background || '#171922' : '#F8F7FC';
  const surface = mode === 'dark' ? customDarkColors?.surface || '#222530' : '#FFFFFF';
  const surfaceAlt = mode === 'dark' ? customDarkColors?.surfaceAlt || '#2D303C' : hslToHex(hue, 32, 95);
  const text = mode === 'dark' ? customDarkColors?.text || '#F5F3FA' : '#24232B';
  const textMuted = mode === 'dark' ? customDarkColors?.textMuted || '#C0BECA' : '#5F5D69';
  const secondary = monochrome ? hslToHex(0, 0, mode === 'dark' ? 70 : 32) : hslToHex(hue + (coolPalette ? 18 : 125), 48, mode === 'dark' ? 61 : 39);
  const colors = {
    primary, onPrimary, secondary, accent: monochrome ? hslToHex(0, 0, 56) : hslToHex(hue + (coolPalette ? 28 : 205), coolPalette ? 56 : 72, coolPalette ? 66 : 51), background, surface, surfaceAlt,
    border: mode === 'dark' ? customDarkColors?.border || '#454754' : '#E3E1E9', text, textMuted,
    success: '#24845A', warning: '#9A6100', danger: '#B33B43',
  };
  return {
    id: `palette-${index + 1}-${primary.slice(1).toLowerCase()}`,
    name: DIRECTIONS[index].name,
    description: DIRECTIONS[index].description,
    mood: profile.mood,
    mode,
    colors,
    source,
    preview: { sampleButtonLabel: 'Continue', sampleCardTitle: `${profile.domain[0].toUpperCase()}${profile.domain.slice(1)} dashboard` },
  };
}

export function composePaletteOptions(params: {
  project: Pick<ProjectMeta, 'name' | 'idea' | 'description' | 'designMode' | 'seedKitId' | 'parsedHints'>;
  prompt?: string;
  mode?: 'light' | 'dark';
  seed?: number;
  research?: PaletteResearchResult;
}): { domainProfile: DomainProfile; options: PaletteOption[]; needResearch: boolean } {
  const detected = detectPaletteNeed(params.project, params.prompt);
  const text = `${params.project.name} ${params.project.idea || ''} ${params.project.description || ''} ${params.prompt || ''}`.toLowerCase();
  const preset = DOMAIN_PRESETS.find((item) => item.match.test(text))?.value
    ?? { domain: 'mobile app', audience: 'everyday users', mood: ['clear', 'modern', 'approachable'], hues: [225, 165, 38, 282] };
  const mode = params.mode || params.project.parsedHints?.mode || 'light';
  const referenceKits = retrievePaletteKits(text, detected.domainProfile);
  const paletteText = `${params.project.parsedHints?.raw || ''} ${params.prompt || ''}`;
  const tokenColors = Array.from(paletteText.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{6})/gi), (match) => ({ token: match[1].toLowerCase(), color: match[2].toUpperCase() }));
  const blueOnly = /\b(?:dark[- ]?)?(?:blue|navy)\s+only\b|\bonly\s+(?:dark[- ]?)?(?:blue|navy)\b/i.test(paletteText);
  const tokenColor = (name: RegExp, fallback: string) => tokenColors.find(({ token }) => name.test(token))?.color || fallback;
  const darkBlueColors = blueOnly ? {
    background: tokenColor(/navy-950/, '#040A24'),
    surface: tokenColor(/navy-900/, '#071338'),
    surfaceAlt: tokenColor(/navy-800/, '#0A1F4F'),
    text: tokenColor(/(?:^|-)white(?:-|$)/, '#FFFFFF'),
    textMuted: '#B8C8E4',
    border: '#27436A',
  } : undefined;
  let explicitColors: string[] = [];
  if (tokenColors.length) {
    const rankedTokens = tokenColors.filter(({ token, color }) => {
      if (blueOnly && !/(?:blue|navy|primary|brand)/.test(token)) return false;
      if (/navy-(?:950|900)|background|surface|white|text|glass|border|glow|shadow/.test(token)) return false;
      return saturation(color) >= 0.2 && luminance(color) >= 0.06 && luminance(color) <= 0.55;
    }).sort((a, b) => {
      const rank = (token: string) => /primary|brand/.test(token) ? 0 : /blue-600|blue-700/.test(token) ? 1 : /blue-500/.test(token) ? 2 : 3;
      return rank(a.token) - rank(b.token);
    });
    explicitColors = Array.from(new Set(rankedTokens.map(({ color }) => color)));
  } else {
    explicitColors = params.project.parsedHints?.colors?.map(parseColor).filter((value): value is string => !!value) ?? [];
  }
  const monochrome = /\b(black\s*(and|&)\s*white|monochrome|grayscale|greyscale)\b/i.test(paletteText);
  const preferredHue = explicitColors[0] ? (() => {
    const [r, g, b] = hexRgb(explicitColors[0]).map((value) => value / 255);
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
    if (delta === 0) return preset.hues[0];
    const raw = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return Math.round(((raw * 60 + 360) % 360));
  })() : undefined;
  const baseHue = blueOnly ? 218 : preferredHue;
  const hues = DIRECTIONS.map((_, index) => (baseHue === undefined ? preset.hues[index] : baseHue + (blueOnly ? [0, 7, -7, 3][index] : 0)) + (params.seed ? ((params.seed + index * 17) % 13) - 6 : 0));
  const researchColors = (params.research?.colors ?? []).filter((color) => /^#[0-9A-F]{6}$/i.test(color) && saturation(color) >= 0.2);
  const source: PaletteOption['source'] = explicitColors.length ? 'hint' : params.research?.source === 'grounded' && researchColors.length >= 4 ? 'grounded' : detected.source;
  const options = DIRECTIONS.map((_, index) => ({
    ...buildOption(index, hues[index], detected.domainProfile, mode, source, monochrome ? undefined : explicitColors[index] || (index === 0 ? explicitColors[0] : undefined) || (researchColors.length ? researchColors[index % researchColors.length] : undefined) || referenceKits[index]?.palette.primary, monochrome, blueOnly, mode === 'dark' ? darkBlueColors : undefined),
    ...(source === 'grounded' ? { references: params.research?.references } : {}),
    ...(source === 'knowledge' && referenceKits.length ? { basis: referenceKits.map((kit) => kit.name) } : {}),
  }));
  return { domainProfile: detected.domainProfile, options, needResearch: detected.needResearch };
}
