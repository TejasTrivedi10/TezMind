/**
 * Prompt Expander — short prompt in → detailed, role-aware expanded brief out.
 */

import {
  analyze,
  ICON_NAMES,
  ROLE_DESC,
  ROLE_REGION,
  type ExpandInput,
  type ExpandedBrief,
  type RefinedBrief,
  RefinerOutputSchema,
  type Analysis,
  type Archetype,
} from '@tezmind/core';
import { buildExpanderSystem } from './prompts/expand';

export interface LlmJson {
  generateJson: (options: {
    system: string;
    user: string;
    maxOutputTokens?: number;
    temperature?: number;
  }) => Promise<any>;
}

export async function expandPrompt(input: ExpandInput, llm: LlmJson): Promise<ExpandedBrief> {
  const a = analyze(input.prompt);
  let raw: Partial<RefinedBrief> | null = null;

  try {
    const candidate: unknown = await llm.generateJson({
      system: buildExpanderSystem(ICON_NAMES),
      user: JSON.stringify({
        userRequest: input.prompt,
        requiredRoles: a.requiredRoles.map((r) => ({
          role: r,
          description: ROLE_DESC[r],
          region: ROLE_REGION[r],
        })),
        archetype: a.archetype?.id ?? null,
        archetypeOutlineHint: a.archetype?.outline ?? [],
        projectBackground: { name: input.project.name, idea: input.project.idea ?? '' },
        brand: input.project.brand,
        styleKeywords: input.project.keywords,
        materialDesign3: input.project.materialDesign3 ?? false,
        uiKit: input.project.uiKit,
        device: input.device,
        motionLevel: input.motionLevel,
      }),
      maxOutputTokens: 1800,
      temperature: 0.3,
    });
    const validated = RefinerOutputSchema.safeParse(candidate);
    if (validated.success) {
      raw = validated.data;
    }
  } catch {
    // Invalid JSON, a rejected model call, or a schema violation all use the
    // deterministic brief. The user's original request is never discarded.
  }

  return assemble(input, a, raw);
}

function assemble(input: ExpandInput, a: Analysis, raw: Partial<RefinedBrief> | null): ExpandedBrief {
  const arch = a.archetype;
  const requestText = input.prompt.trim();
  const fallbackPurpose = requestText || `Recreate the supplied reference as a polished ${input.device.kind} screen.`;
  const outline = (
    raw?.outline?.length
      ? raw.outline
      : arch?.outline ?? [{ region: 'body' as const, component: 'main content', notes: fallbackPurpose }]
  ).slice(0, 8);

  // GUARANTEE: every required role is represented in the outline
  for (const r of a.requiredRoles) {
    const rolePhrase = r.replace('-', ' ');
    const covered = outline.some(
      (o) =>
        o.component.toLowerCase().includes(rolePhrase) ||
        (r === 'composer' && /composer/i.test(o.component)),
    );
    if (!covered) {
      outline.push({ region: ROLE_REGION[r], component: rolePhrase, notes: ROLE_DESC[r] });
    }
  }

  const brief: ExpandedBrief = {
    title: raw?.title ?? (requestText.slice(0, 40) || `${input.project.name} — Screen`),
    purpose: raw?.purpose ?? fallbackPurpose,
    style: raw?.style ?? { keywords: input.project.keywords, density: 'comfortable', radius: 'lg' },
    outline,
    sampleContent: raw?.sampleContent ?? {},
    icons: [...new Set([...(raw?.icons ?? []), ...(arch?.icons ?? [])])]
      .filter((i) => (ICON_NAMES as readonly string[]).includes(i))
      .slice(0, 12),
    imageSlots: (raw?.imageSlots ?? []).slice(0, 3),
    motion:
      input.motionLevel === 'none'
        ? { level: 'none', entrance: '', interactions: [] }
        : raw?.motion ?? {
            level: input.motionLevel,
            entrance: 'list items fade-up with stagger',
            interactions: ['buttons press-scale'],
          },
    refinedPrompt: raw?.refinedPrompt ?? defaultRefined(input, arch),
    archetypeId: arch?.id ?? null,
    requiredRoles: a.requiredRoles,
    generatorPrompt: '',
  };

  brief.generatorPrompt = renderGeneratorPrompt(brief, input);
  return brief;
}

const defaultRefined = (i: ExpandInput, a: Archetype | null) =>
  `Build the ${i.project.name} screen requested by the user: “${i.prompt.trim() || `Recreate the supplied reference as a polished ${i.device.kind} screen` }”. ` +
  `${a ? `Use the ${a.id} screen pattern and its ordered regions (${a.outline.map((o) => o.component).join(', ')}). ` : 'Choose only the standard regions this specific screen needs: a compact header, one scrollable content area, and a footer only when the requested screen needs persistent actions or navigation. '}` +
  `Keep the user's requested features and content as the source of truth; do not add unrelated product features. ` +
  `${i.project.uiKit ? `Follow the ${i.project.uiKit.name} kit consistently: ${i.project.uiKit.guidance} Palette ${i.project.uiKit.palette.background} background, ${i.project.uiKit.palette.surface} surfaces, ${i.project.brand} primary, and ${i.project.uiKit.palette.text} text; use ${i.project.uiKit.fonts.heading} for headings and ${i.project.uiKit.fonts.body} for body copy. ` : ''}` +
  `${i.project.materialDesign3 ? 'Use semantic Material 3 controls and theme roles. ' : ''}` +
  `Use a ${i.device.w} by ${i.device.h} ${i.device.kind} viewport, a 4px spacing grid, consistent 16px page insets, readable type hierarchy, full-width aligned header/footer regions, one direct-child scroll area, and content that wraps within the available width. ` +
  `Specify realistic screen-specific copy, concise accessible actions, and clear interaction outcomes. Respect any explicit color or light/dark direction in the user's request; otherwise use the selected kit's palette and mode.`;

export function renderGeneratorPrompt(b: ExpandedBrief, i: ExpandInput): string {
  const content =
    Object.entries(b.sampleContent)
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(' | ') : v}`)
      .join('\n') || '(invent realistic copy)';

  return [
    `USER REQUEST (implement exactly this; add nothing that is not implied by it):\n"${i.prompt.trim() || 'Recreate the supplied reference faithfully, preserving its structure and visual hierarchy.'}"`,
    `DESIGN DIRECTION:\n${b.refinedPrompt}`,
    `STRUCTURE (top to bottom):\n${b.outline.map((o, n) => `${n + 1}. [${o.region}] ${o.component} - ${o.notes}`).join('\n')}`,
    `REQUIRED ELEMENTS (must exist, using exactly these data-role values):\n${b.requiredRoles.map((r) => `- data-role="${r}" (${ROLE_REGION[r]}): ${ROLE_DESC[r]}`).join('\n')}`,
    `CONTENT:\n${content}`,
    `IMPLEMENTATION BLUEPRINT:\n- Build one finished screen for the user's exact request; include only the regions listed above and no unrelated feature sections.\n- Use the ordered header, body, and footer regions from STRUCTURE. Keep the header and any persistent footer as full-device-width direct children of .screen; keep exactly one direct-child .scroll for body content. Never nest the footer in a card or scroll area.\n- Stretch primary content sections to the available width, keep deliberate 16px page insets inside them, and keep every row/card/button within the viewport. Use .fill and min-width:0 for flexible text; use .hug for icons, avatars, short labels, and compact controls. Allow headings and body copy to wrap without overlapping actions.\n- Use one consistent hierarchy: screen title, supporting context, section heading, then relevant content. Keep each repeated item aligned to the same grid and limit repeated examples to six.\n- Use the selected kit's palette, type, surfaces, shape language, and component behavior on every region. Honor explicit prompt colors and light/dark mode over the kit defaults. Use semantic Material 3 controls when enabled.\n- Make visible controls actionable with clear labels and sensible local outcomes; navigation tabs are equal-width, have short labels, and stay inside a full-width bottom bar. Avoid decorative controls that imply unavailable features.`,
    `ICONS (only these names): ${b.icons.join(', ') || 'none'}`,
    b.imageSlots.length
      ? `IMAGE SLOTS:\n${b.imageSlots.map((s) => `- ${s.slug} (${s.ratio}): ${s.alt}`).join('\n')}`
      : '',
    `MOTION: level=${b.motion.level}; entrance=${b.motion.entrance || 'none'}; interactions=${b.motion.interactions.join(', ') || 'none'}`,
    `DEVICE: ${i.device.w}x${i.device.h} (${i.device.kind}) | BRAND: ${i.project.brand} | STYLE: ${b.style.keywords.join(', ')}`,
    i.project.uiKit
      ? `SELECTED UI KIT: ${i.project.uiKit.name} (${i.project.uiKit.vibe})\n${i.project.uiKit.description}\nKit guidance: ${i.project.uiKit.guidance}\nPalette: background ${i.project.uiKit.palette.background}, surface ${i.project.uiKit.palette.surface}, text ${i.project.uiKit.palette.text}, primary ${i.project.brand}, secondary ${i.project.uiKit.palette.secondary}.\nTypography: headings ${i.project.uiKit.fonts.heading}; body ${i.project.uiKit.fonts.body}. Keep the same kit language across screens.`
      : '',
    i.project.materialDesign3
      ? 'DESIGN SYSTEM: Material Design 3 (Material You). Use its color roles, tonal surfaces, accessible contrast, shape system, and component behavior. Derive the color scheme from the user request: honor explicit color names or hex values first; otherwise infer a fitting seed color from the product and prompt. Use the resulting M3 roles consistently across the screen. Do not force TezMind’s default accent.'
      : '',
    `PROJECT BACKGROUND (names, tone, colors only; do NOT add features from it): ${i.project.name}${i.project.idea ? ' - ' + i.project.idea : ''}`,
    `OUTPUT: only the root <div class="screen"> HTML. No markdown fences. Do NOT write data-tz-id/data-tz-name. Compact markup; max 6 list items.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
