import type { UiKitStyleContext } from '@tezmind/core';

export interface UiKitOption extends UiKitStyleContext {
  keywords: string[];
  matchTerms: RegExp[];
}

/** Curated design kits distilled from the local UI-kit reference files. */
export const UI_KIT_CATALOG: UiKitOption[] = [
  {
    id: 'material3', name: 'Material 3', vibe: 'Expressive, familiar, accessible',
    description: 'Tonal color roles, clear hierarchy, accessible touch targets, and Material components.',
    sourceFile: '20_UI_kit_styles.html', keywords: ['Material 3', 'tonal', 'accessible'],
    matchTerms: [/\bmaterial(?:\s*design)?\s*3\b/i, /\bmaterial you\b/i],
    palette: { background: '#FFFBFE', surface: '#F3EDF7', text: '#1C1B1F', primary: '#6750A4', secondary: '#625B71' },
    fonts: { heading: 'Roboto', body: 'Roboto' },
    guidance: 'Use Material 3 color roles, tonal surfaces, accessible contrast, rounded shapes, and stateful controls. Keep one clear primary action and use consistent 4px spacing.',
  },
  {
    id: 'sms', name: 'SMS & Messaging', vibe: 'Warm, conversational, glanceable',
    description: 'Friendly contact rows, readable previews, message-first hierarchy, and soft indigo accents.',
    sourceFile: 'SMS App UI Kit.html', keywords: ['messaging', 'friendly', 'indigo'],
    matchTerms: [/\b(?:sms|text(?:ing)?|messag(?:e|es|ing)|inbox|chat|conversation)\b/i],
    palette: { background: '#EEF1F7', surface: '#FFFFFF', text: '#14161F', primary: '#2F3FD6', secondary: '#6A7087' },
    fonts: { heading: 'DM Sans', body: 'DM Sans' },
    guidance: 'Prioritize conversations. Use consistent contact rows with initials or profile imagery, contact name and timestamp aligned on one line, a two-line message preview, and clear unread states. Keep compose actions easy to reach.',
  },
  {
    id: 'minimalism', name: 'Minimal', vibe: 'Quiet, crisp, spacious',
    description: 'Restrained color, generous whitespace, fine separators, and typography-led hierarchy.',
    sourceFile: 'Minimalism UI kit.html', keywords: ['minimal', 'clean', 'spacious'],
    matchTerms: [/\bminimal(?:ism|ist)?\b/i, /\b(?:clean|simple|quiet|airy)\s+(?:ui|design|style|app)\b/i],
    palette: { background: '#FAFAFA', surface: '#FFFFFF', text: '#111111', primary: '#111111', secondary: '#767676' },
    fonts: { heading: 'Manrope', body: 'Inter' },
    guidance: 'Use generous whitespace, a restrained palette, fine separators, concise labels, and clear type hierarchy. Avoid decorative effects and excessive cards.',
  },
  {
    id: 'glassmorphism', name: 'Glass', vibe: 'Atmospheric, layered, soft',
    description: 'Translucent surfaces, gentle blur, subtle gradients, and polished depth.',
    sourceFile: 'Glassmorphism UI kit.html', keywords: ['glassmorphism', 'gradient', 'layered'],
    matchTerms: [/\bglass(?:morphism|y)?\b/i, /\bfrosted\s+glass\b/i, /\btranslucent\b/i],
    palette: { background: '#EAEAFB', surface: '#FFFFFF', text: '#1E1B3A', primary: '#5B3FD9', secondary: '#4B4A6B' },
    fonts: { heading: 'Outfit', body: 'Inter' },
    guidance: 'Layer a quiet atmospheric gradient behind a few translucent surfaces. Preserve strong text contrast, keep blur subtle, and reserve glow for one focal action.',
  },
  {
    id: 'neumorphism', name: 'Soft UI', vibe: 'Tactile, gentle, low contrast',
    description: 'Soft raised surfaces and inset controls over a unified, muted base.',
    sourceFile: 'Neumorphism UI kit.html', keywords: ['soft ui', 'tactile', 'muted'],
    matchTerms: [/\bneumorph(?:ism|ic)?\b/i, /\bsoft\s+ui\b/i],
    palette: { background: '#E0E5EC', surface: '#E0E5EC', text: '#3D4468', primary: '#4452C8', secondary: '#5A6180' },
    fonts: { heading: 'Nunito', body: 'Quicksand' },
    guidance: 'Use subtle raised and inset surface treatments with restrained shadows and a unified base color. Keep labels, borders, and focus states legible and interactive controls distinct.',
  },
  {
    id: 'booking', name: 'Booking & Travel', vibe: 'Confident, practical, action-led',
    description: 'Map-aware layouts, clear trip details, compact cards, and warm amber actions.',
    sourceFile: 'Booking_ui_kit_style.html', keywords: ['booking', 'travel', 'amber'],
    matchTerms: [/\b(?:taxi|cab|ride.?hail|rideshare|trip|hotel|travel|booking|reservation)\b/i],
    palette: { background: '#EFF1F5', surface: '#FFFFFF', text: '#12141C', primary: '#FFC61A', secondary: '#666C7E' },
    fonts: { heading: 'Manrope', body: 'Manrope' },
    guidance: 'Keep route or destination context prominent, summarize trip details in compact sections, and use one high-contrast booking action. Use maps only when the request calls for them.',
  },
  {
    id: 'bike-booking', name: 'Bike & Outdoors', vibe: 'Fresh, active, nature-led',
    description: 'Eco greens, clean route information, practical booking cards, and an active feel.',
    sourceFile: 'Bike_Booking_Kit.html', keywords: ['cycling', 'eco', 'green'],
    matchTerms: [/\b(?:bike|bicycle|cycling|cyclist|e-bike|ebike)\b/i],
    palette: { background: '#EEF2F0', surface: '#FFFFFF', text: '#0E1F19', primary: '#00A676', secondary: '#64766F' },
    fonts: { heading: 'Outfit', body: 'Outfit' },
    guidance: 'Use an outdoorsy green accent, readable route and availability details, calm surfaces, and direct booking actions. Keep map and route content proportional to the prompt.',
  },
  {
    id: 'editorial', name: 'Editorial', vibe: 'Elegant, typographic, composed',
    description: 'Strong headlines, thoughtful whitespace, a serif display voice, and minimal ornament.',
    sourceFile: '20_UI_kit_styles.html', keywords: ['editorial', 'serif', 'refined'],
    matchTerms: [/\b(?:editorial|magazine|publication|reading|journal)\b/i],
    palette: { background: '#FFFFFF', surface: '#FFFFFF', text: '#1A1A1A', primary: '#B3001B', secondary: '#6B6B6B' },
    fonts: { heading: 'Playfair Display', body: 'Source Serif 4' },
    guidance: 'Use a strong typographic grid, expressive serif headlines, quiet dividers, and one deliberate accent. Keep information density controlled and scanning clear.',
  },
  {
    id: 'neo-brutalism', name: 'Bold & Graphic', vibe: 'Playful, direct, high-energy',
    description: 'Bold blocks, thick outlines, confident type, and deliberate high-contrast accents.',
    sourceFile: '20_UI_kit_styles.html', keywords: ['bold', 'graphic', 'playful'],
    matchTerms: [/\bneo.?brutal(?:ism|ist)?\b/i, /\bbrutal(?:ist|ism)?\b/i],
    palette: { background: '#FFF4D6', surface: '#FFFFFF', text: '#000000', primary: '#FF5C8A', secondary: '#3DDC97' },
    fonts: { heading: 'Space Grotesk', body: 'Space Mono' },
    guidance: 'Use a small number of bold color blocks, firm outlines, strong type, and crisp alignment. Keep shadows and playful shapes intentional rather than adding decoration everywhere.',
  },
];

export const UI_KIT_OPTIONS = UI_KIT_CATALOG.map(({ matchTerms: _matchTerms, ...kit }) => kit);

export function recommendUiKit(prompt: string, projectIdea = ''): UiKitOption {
  const text = `${prompt} ${projectIdea}`.trim();
  const explicitStyleOrder = ['material3', 'glassmorphism', 'neumorphism', 'minimalism', 'editorial', 'neo-brutalism'];
  for (const id of explicitStyleOrder) {
    const kit = UI_KIT_CATALOG.find((entry) => entry.id === id)!;
    if (kit.matchTerms.some((pattern) => pattern.test(text))) return kit;
  }
  for (const id of ['sms', 'bike-booking', 'booking']) {
    const kit = UI_KIT_CATALOG.find((entry) => entry.id === id)!;
    if (kit.matchTerms.some((pattern) => pattern.test(text))) return kit;
  }
  return UI_KIT_CATALOG.find((kit) => kit.id === 'minimalism')!;
}

export function resolveUiKit(uiKitId: string | undefined, prompt: string, projectIdea = ''): UiKitOption {
  if (uiKitId && uiKitId !== 'auto') {
    const selected = UI_KIT_CATALOG.find((kit) => kit.id === uiKitId);
    if (selected) return selected;
  }
  return recommendUiKit(prompt, projectIdea);
}

export function getUiKitContext(uiKitId: string | undefined, prompt: string, projectIdea = ''): UiKitStyleContext {
  const { matchTerms: _matchTerms, keywords: _keywords, ...context } = resolveUiKit(uiKitId, prompt, projectIdea);
  return context;
}

export function resolveUiKitAccent(prompt: string, fallback: string): string {
  const hex = prompt.match(/(?:^|\s)(#[\da-f]{3}(?:[\da-f]{3})?)(?=$|\s|[,.;])/i)?.[1];
  if (hex) return hex.toUpperCase();
  const colorWords: Array<[RegExp, string]> = [
    [/\b(?:indigo|deep blue)\b/i, '#3F51B5'],
    [/\b(?:navy|blue|cyan|sky)\b/i, '#1976D2'],
    [/\b(?:teal|turquoise)\b/i, '#008577'],
    [/\b(?:green|mint|emerald)\b/i, '#2E7D32'],
    [/\b(?:lime|olive)\b/i, '#687F00'],
    [/\b(?:yellow|gold|amber)\b/i, '#9A6700'],
    [/\b(?:orange|coral)\b/i, '#C45100'],
    [/\b(?:red|crimson|maroon)\b/i, '#BA1A1A'],
    [/\b(?:pink|rose|magenta)\b/i, '#B52C68'],
    [/\b(?:purple|violet|lavender)\b/i, '#6750A4'],
    [/\b(?:brown|coffee|terracotta)\b/i, '#795548'],
    [/\b(?:gray|grey|slate|monochrome)\b/i, '#5F6368'],
  ];
  return colorWords.find(([pattern]) => pattern.test(prompt))?.[1] ?? fallback;
}
