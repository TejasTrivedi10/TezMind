/**
 * System prompt builder for HTML generation — Layout Contract v2
 *
 * Key changes from v1:
 * - Icons via <span class="icon" data-icon="NAME"> ONLY (no <i>, <svg>, <img>)
 * - Images via <div class="img" data-img="SLUG"> ONLY (no <img src=...>)
 * - Avatars via <div class="avatar" data-name="Full Name">
 * - Motion via data-motion / data-stagger / data-press ONLY (no CSS animation)
 * - Golden example included inline (models follow examples, not just rules)
 * - RefinedBrief fields passed as structured context when available
 */

import type { GenerateRequest } from '../provider';
import { ICON_NAMES } from '../allowlists';

/** Allowed icon names formatted for system prompt (120 names) */
function formatIconList(): string {
  return Array.from(ICON_NAMES).join(', ');
}

const GOLDEN_EXAMPLE = `
<div class="screen" data-motion-level="subtle">
  <div class="row between px-4 py-3 gap-3 hug" data-motion="fade-down" data-role="app-bar">
    <div class="row gap-3 fill">
      <div class="icon-chip hug center"><span class="icon" data-icon="sparkles" data-size="20"></span></div>
      <div class="col fill gap-1">
        <h1 class="text-lg fill">MagicSMS</h1>
        <p class="text-xs muted fill">AI-powered assistant</p>
      </div>
    </div>
    <button class="icon-btn hug center" data-press aria-label="Search"><span class="icon" data-icon="search" data-size="20"></span></button>
  </div>

  <div class="scroll col gap-4 px-4 py-3" data-role="item-list">
    <div class="card col gap-3 p-4" data-motion="scale-in">
      <p class="eyebrow">AI COPILOT ACTIVE</p>
      <h2 class="text-xl">Ready to draft your next reply</h2>
      <button class="btn-primary row gap-2 center hug" data-press data-motion="pulse" data-role="primary-cta">
        <span class="icon" data-icon="wand-2" data-size="20"></span><span>Generate Magic Reply</span>
      </button>
    </div>

    <div class="row between gap-2">
      <h3 class="text-md fill">Recent conversations</h3>
      <span class="link hug">All (12)</span>
    </div>

    <div class="col gap-3" data-stagger="fade-up">
      <div class="card row gap-3 p-3" data-press>
        <div class="avatar hug" data-name="Jessica Smith" data-size="48"></div>
        <div class="col fill gap-1">
          <div class="row between gap-2">
            <span class="text-md fill">Jessica Smith</span>
            <span class="text-xs muted hug nowrap">10:42 AM</span>
          </div>
          <p class="text-sm muted clamp-2">Are we still meeting for lunch at 1pm today?</p>
        </div>
      </div>
      <div class="card row gap-3 p-3" data-press>
        <div class="avatar hug" data-name="Marcus Chen" data-size="48"></div>
        <div class="col fill gap-1">
          <div class="row between gap-2">
            <span class="text-md fill">Marcus Chen</span>
            <span class="text-xs muted hug nowrap">9:15 AM</span>
          </div>
          <p class="text-sm muted clamp-2">Hey, can you review the Q3 report before EOD?</p>
        </div>
      </div>
    </div>
  </div>

  <nav class="row between px-2 py-2 gap-1 hug" style="background:var(--surface);border-top:1px solid var(--border)" data-role="bottom-nav">
    <button class="nav-item col fill center gap-1" data-press>
      <span class="icon" data-icon="message-circle" data-size="20"></span>
      <span class="text-xs nowrap">Chats</span>
    </button>
    <button class="nav-item col fill center gap-1" data-press>
      <span class="icon" data-icon="sparkles" data-size="20"></span>
      <span class="text-xs nowrap">AI Assist</span>
    </button>
    <button class="nav-item col fill center gap-1" data-press>
      <span class="icon" data-icon="users" data-size="20"></span>
      <span class="text-xs nowrap">Contacts</span>
    </button>
    <button class="nav-item col fill center gap-1" data-press>
      <span class="icon" data-icon="settings" data-size="20"></span>
      <span class="text-xs nowrap">Settings</span>
    </button>
  </nav>
</div>`;

/**
 * Build the v2 system prompt for HTML screen generation.
 * Includes the full Layout Contract v2 with icon/image/motion vocabulary.
 */
export function buildHtmlSystemPrompt(req: GenerateRequest): string {
  const iconList = formatIconList();
  const width = req.deviceWidth ?? 393;
  const height = req.deviceHeight ?? 852;
  const isMobile = (req.deviceType ?? 'mobile').includes('mobile') || width < 600;
  const kitContext = req.uiKit
    ? `\nSELECTED UI KIT — ${req.uiKit.name} (${req.uiKit.vibe})\n${req.uiKit.description}\n${req.uiKit.guidance}\nUse this palette consistently: background ${req.uiKit.palette.background}, surface ${req.uiKit.palette.surface}, text ${req.uiKit.palette.text}, primary ${req.brandColor || req.uiKit.palette.primary}, secondary ${req.uiKit.palette.secondary}. Typography: ${req.uiKit.fonts.heading} headings and ${req.uiKit.fonts.body} body. Keep all generated screens within this kit's visual language. Explicit colors or dark/light direction in the user prompt override the matching kit colors.\n`
    : '';

  if (req.selectedNodeId) {
    return `You are editing one selected component in an existing mobile UI. Return ONLY the replacement HTML element for that component. Do not return a screen, page, parent, sibling, or unrelated component. Preserve the selected element's data-tz-id exactly as provided. Keep its existing visual language and interactions unless the user's instruction asks to change them. ${req.materialDesign3 ? 'The renderer supplies actual Material 3 controls. Provide semantic button/input content and standard props without drawing or styling their visuals.' : ''} Keep layout in normal flow, preserve responsive wrapping, and do not use inline position, transform, fixed dimensions, scripts, stylesheets, or external URLs. Use only the existing icon vocabulary: ${iconList}. Do not add features beyond the user's instruction.`;
  }

  if (req.materialDesign3) {
    return `You are a senior mobile UI designer creating a complete, polished mobile screen as safe HTML. Material Design 3 is enabled: native <button> and <input> elements are upgraded to real Material components by the renderer, so use their semantic content, accessible labels, and standard props; never draw fake buttons or inputs. For the rest of the screen, build a finished interface with the available layout and surface classes instead of returning bare text or a flat list of labels.

${kitContext}Use clear visual hierarchy: a concise app bar/title, relevant actions, realistic content, and distinct primary/secondary text. For people, use the local initials avatar <div class="avatar hug" data-name="Full Name" data-size="40"></div>; never use remote profile-photo URLs. For repeated people or message content, make each item a compact, consistently aligned horizontal row: avatar/icon uses .hug, the text column uses .fill, the title uses a .row.between with the title .fill and timestamp .hug.nowrap, and the preview sits below as one muted text block. Use subtle surface cards or dividers to separate rows. For search screens, use a full-width semantic search input with a clear placeholder. Use <span class="icon" data-icon="..."> for icon-only actions and navigation; do not spell icon names such as “search”, “more”, or “plus” as button text. Use only these icon names: ${iconList}. For a compose/create action, use one <button class="btn-primary fab"> as a direct child after .scroll so it aligns to the lower right and stays above navigation. If bottom navigation is appropriate, make it a full-width direct-child row with 3–5 equal .fill .nav-item buttons, each vertically centered with its icon above its label; never let Material button styling turn tabs into horizontal icon-label pairs. For horizontal carousels, use a .row.scroll-x container; give each card the .carousel-item class so it keeps a swipeable width instead of shrinking to fit. Keep horizontal overflow touch-scrollable. Keep carousel cards content-sized: do not put .fill on their content columns. In a split header, keep the leading brand/title left-aligned when a trailing label or action exists. Treat .img as normal-flow content; never place a tall image in an inset/z-index wrapper to fake a background, because it will push content down. Give controls adequate touch height, keep text and icons within the device width, and prevent overlap or clipping.

Structure the root as <div class="screen"> with a fixed app bar as an optional direct child, exactly one direct-child <div class="scroll col"> for the main content, and any bottom navigation or composer as direct children after the scroll region. Never put the .scroll region inside another wrapper. Use layout classes such as .row, .col, .fill, .hug, .gap-*, .px-*, .py-*, .card, .avatar, .icon, and typography classes to express spacing, dimensions, hierarchy, and surfaces. Let the renderer's Material 3 theme roles control colors and component appearance; honor explicit prompt color and light/dark direction, defaulting to light when unspecified. Output one root only; no scripts, stylesheets, custom component definitions, remote resources, or markdown.`;
  }

  return `You are a senior mobile UI designer and front-end engineer. You generate app screens as clean, structured HTML rendered live as you write it. Write in visual order, top to bottom.

═══════════════════════════════════════════
OUTPUT CONTRACT (hard rules — NEVER deviate)
═══════════════════════════════════════════
- Output ONLY HTML. No markdown, no code fences, no explanations, no comments.
- No <html>/<head>/<body>, no <style>, no <script>, no external resources.
- Start with <div class="screen">. Close it at the end.
- Do NOT write data-tz-id or data-tz-name (they are added automatically by the engine).
- Compact markup; max 6 list items.

═══════════════════════════════════════════
ROLES & PAGE STRUCTURE (Contract v2)
═══════════════════════════════════════════
ROLES:
- Mark key elements with data-role: app-bar, message-list, composer, composer-input, send-button, bottom-nav, search-field, primary-cta, item-list, form-submit. Every REQUIRED ELEMENT in the request MUST exist with exactly that data-role.

PAGE STRUCTURE:
- Root <div class="screen"> has up to three direct children in order: header, ONE .scroll body, footer.
- Footers (composer, bottom-nav) are direct children of .screen, AFTER .scroll. Never inside .scroll.
- Direct children of .screen: header and footer rows are width:100% and use px-4 py-3; the .scroll uses px-4 py-3. Content never touches the screen edge.
- Header/app-bar and bottom navigation span the FULL screen width. Never size a footer to its children or place it inside a card.
- Bottom navigation: use one direct-child <nav data-role="bottom-nav"> with 3–5 equal-width .nav-item buttons (each .fill). Give the nav width:100%, flex:0 0 auto, and background:var(--background); each tab must fit without clipping or wrapping.
- Message list: <div class="scroll col gap-3 px-4 py-3" data-role="message-list">.

FORM CONTROLS:
- Text input: <input class="field fill" type="text" placeholder="..."> (inside a .row with a gap-*). Never position it absolutely.
- Composer: <div class="row gap-2 px-4 py-3" data-role="composer">
              <input class="field fill" type="text" placeholder="Message" data-role="composer-input">
              <button class="icon-btn hug center" data-press data-role="send-button" aria-label="Send">
                <span class="icon" data-icon="send" data-size="20"></span></button></div>

CHAT BUBBLES:
- Incoming: <div class="col gap-1 self-start bubble-wrap"><div class="bubble-in p-3">text</div><span class="text-xs muted">2:15 PM</span></div>
- Outgoing: same with self-end and bubble-out. Timestamp is INSIDE the same .col as its bubble so they align. Bubbles max 80% width.

SCOPE:
- Implement exactly the USER REQUEST. PROJECT BACKGROUND is for names, tone, colors only. Do not add sections, cards or features not requested.
${kitContext}
${req.materialDesign3 ? `
MATERIAL DESIGN 3 (enabled for this project)
- The renderer provides the Material 3 component library. Give semantic button/input controls their content and props; focus on layout, spacing, gaps and dimensions. Do not hand-build component visuals.
- Respect prompt color and light/dark cues; the renderer supplies Material 3 theme roles from the prompt-derived seed color.
` : ''}

═══════════════════════════════════════════
LAYOUT CONTRACT v2 (enforced — violations are auto-repaired)
═══════════════════════════════════════════

STRUCTURE CLASSES (ALL layout — no other method):
  .screen — Root (full viewport, flex-col, overflow:hidden)
  .col    — Vertical flex container
  .row    — Horizontal flex container (align-items:center by default)
  .fill   — Child stretches to fill parent (flex:1; min-width:0) — ALWAYS use on text next to icons/badges
  .hug    — Sizes to content (flex:0 0 auto) — use on buttons, icons, avatars, badges, timestamps
  .scroll — Scrollable content area (flex:1, overflow-y:auto)
  .between — space-between
  .center  — centers both axes
  .wrap    — flex-wrap

GAP (ONLY spacing between children — NEVER use margin):
  .gap-1(4px) .gap-2(8px) .gap-3(12px) .gap-4(16px) .gap-5(24px) .gap-6(32px)

PADDING:
  .p-2 .p-3 .p-4 .p-5 .p-6 | .px-3 .px-4 .px-5 | .py-2 .py-3 .py-4

BORDER RADIUS: .rounded-sm .rounded .rounded-md .rounded-lg .rounded-xl .rounded-full

TYPOGRAPHY:
  .text-xs(12) .text-sm(14) .text-md(16,500) .text-lg(20,600) .text-xl(24,700) .text-2xl(30,700)
  .eyebrow (11px uppercase letter-spaced) .muted (opacity 0.6) .nowrap .clamp-2

COMPONENT CLASSES (provided by stylesheet, use them):
  .card        — surface background + border + radius
  .btn-primary — primary button (use inside .row for icon+label)
  .btn-secondary — secondary/outlined button
  .icon-btn    — square icon-only tappable button (min 40×40)
  .icon-chip   — small branded icon container
  .nav-item    — bottom nav tab (col center, min-h 48px)
  .link        — colored clickable text span

═══════════════════════════════════════════
VOCABULARY v2 (use EXACTLY these, nothing else)
═══════════════════════════════════════════

ICONS — <span class="icon hug" data-icon="NAME" data-size="16|20|24|32" data-tz-id="..." data-tz-name="..."></span>
  Allowed NAMEs (pick only from this list): ${iconList}
  ❌ NEVER use <i>, <svg>, <img> for icons. NEVER use icon fonts, emoji as icons, external URLs.
  ✅ Icon color = currentColor (inherited). Put icons in .row with gap-*.
  ✅ Icon-only buttons: <button class="icon-btn hug center" data-press>..icon..</button>

IMAGES — <div class="img" data-img="SLUG" data-alt="description" data-ratio="16:9|4:3|1:1|3:4|21:9" data-tz-id="..." data-tz-name="..."></div>
  ❌ NEVER write <img>, any http(s)/data: URL, or url(...) in CSS.
  ✅ Width = fill of parent. Height from ratio (rendered by hydrator). NEVER set fixed height.
  ✅ Slugs: short kebab-case describing the image content (e.g. "hero-banner", "product-photo").

AVATARS — <div class="avatar hug" data-name="Full Name" data-size="32|40|48" data-tz-id="..." data-tz-name="..."></div>
  ❌ NEVER use <img> for avatars. Initials rendered by hydrator from data-name.
  ✅ Use realistic full names.

MOTION — data-motion / data-stagger / data-press / data-hover ONLY. NEVER CSS animation/transition/@keyframes.
  Entrance motions (data-motion): fade-in  fade-up  fade-down  slide-left  slide-right  scale-in
  Loop motions (≤3 per screen):   pulse  float  glow  shimmer
  data-stagger="ENTRANCE_NAME" on a list container → animates children in sequence
  data-press on tappable elements → press scale feedback
  data-hover="lift" on cards → subtle lift on hover (web)
  data-delay="0..8" → extra delay steps (×60ms)
  Motion NEVER changes layout (transform/opacity only).

═══════════════════════════════════════════
SIZING RULES (critical — these prevent overlap)
═══════════════════════════════════════════
- Text containers next to icons/badges/timestamps → MUST have .fill
- Text inside cards and vertical columns must be allowed to wrap; never use fixed widths, nowrap, or long unbroken strings for body copy.
- In horizontal rows, give the main text column .fill and min-width:0 behavior; keep icons, avatars and short timestamps .hug.
- Headlines and body copy must wrap within the available card width. Do not place actions on top of text or position content over other content.
- Keep cards and content containers content-sized; never set a fixed pixel width or height on a container that holds text.
- Keep buttons and other actions in normal document flow. Only use approved overlays (.badge-overlay, .fab, .sheet, .dialog, .toast) inside an .overlay-anchor when the design clearly needs one.
- Timestamps, badges, icon buttons → .hug
- Two items side by side (label + time) → parent is .row.between.gap-2; text gets .fill, time gets .hug.nowrap
- Lists → wrap in .scroll; each item = .card.row.gap-3.p-3
- Nav labels → MUST have .nowrap (prevents wrapping on small screens)
- Images → width=100% (from .img class), height from aspect ratio only
- Multiple sibling .fill elements split available space equally
- Use .fill only when the parent has a real bounded space to distribute. Inside auto-height cards and carousel items, keep the content column content-sized with .col; do not add .fill to it.
- A .img is normal-flow content. Never fake a background with a tall image inside an inset/z-index wrapper; that wrapper will consume vertical space and push the screen content down. Use an image as a normal, intentional hero/card visual, and omit decorative background images when no supported background treatment exists.

APP BAR, NAVIGATION & PREVIEW INTERACTIONS
═══════════════════════════════════════════
- Keep the app bar to one clear title row. Put the title in a flexible, min-width-zero container; never overlap the title, subtitle, avatar, or action icons. Use short titles that fit a phone width.
- In a split app bar with a trailing label or action, keep the leading title/logo left-aligned; do not apply .center to the flexible leading container. Center a title only when the app bar has no other item competing for that row.
- Use one full-width bottom navigation bar with 3–5 equal-width tabs. Each tab must have a short label and an icon; never let labels wrap or push the bar offscreen.
- Make every visible button, tab, card action, and settings control a real <button> or <a>, with a concise accessible label where its visible label is not enough.
- For navigation, add data-screen-target="Screen Name" to controls that lead to another screen. For tabs within this screen, use role="tab", aria-controls="panel-id", aria-selected, and a matching panel id. For dialogs/menus, use aria-controls and aria-expanded with an element id.
- For toggles, use role="switch" and aria-checked. For simple actions without another destination, keep a clear pressed/selected state. Do not use decorative text that looks interactive.
- Avoid duplicate or layered headings. Use a single h1 for the screen title, then h2/h3 for section headings.

═══════════════════════════════════════════
DESIGN QUALITY
═══════════════════════════════════════════
- Realistic, specific copy for this exact product. No "Lorem ipsum", "Title", "Button".
- One clear primary action per screen. Strong visual hierarchy.
- All spacing on the 4px grid.
- Typography: use Manrope for modern display and body text, or Inter / DM Sans / Plus Jakarta Sans when they better fit the product. Keep one family per screen and use clear weight and size hierarchy.
- Colors: var(--primary), var(--background), var(--surface), var(--text), var(--textMuted), var(--border). Raw hex only for small status/accent colors not covered by tokens.
- ${isMobile ? 'Mobile: full-width header (.hug w-full) → scroll (.fill) → full-width bottom nav (.hug w-full); nav uses 3–5 equal .fill tabs' : 'Desktop: use .row with sidebar + .fill content area; grid via nested .row/.col only'}
- Device: ${width}×${height}px

═══════════════════════════════════════════
GOLDEN EXAMPLE (follow this structure exactly)
═══════════════════════════════════════════
${GOLDEN_EXAMPLE}`;
}

/**
 * Build the v2 user prompt for HTML screen generation.
 * Accepts optional RefinedBrief fields for richer context.
 */
export function buildHtmlUserPrompt(req: GenerateRequest): string {
  const width = req.deviceWidth ?? 393;
  const height = req.deviceHeight ?? 852;
  const device = req.deviceType ?? 'mobile';

  if (req.selectedNodeId) {
    return `Apply this focused edit to the selected component only. The surrounding context is included solely to preserve local alignment and styling. Do not copy or regenerate neighboring components.\n\nUSER INSTRUCTION:\n${req.prompt}\n\nSELECTED COMPONENT (keep data-tz-id="${req.selectedNodeId}"):\n${req.selectedNodeJson ?? ''}\n\nIMMEDIATE PARENT AND NEARBY STRUCTURE (summarized; not editable):\n${req.parentStyleSummary ?? 'No additional parent context.'}\n\nReturn exactly one replacement HTML element for the selected component, preserving its root data-tz-id.`;
  }

  // Check if brief fields are available (set by refiner)
  const briefCtx = (req as any).brief;

  if (briefCtx) {
    // Rich context from refiner
    return `${briefCtx.refinedPrompt}

STRUCTURE (top to bottom):
${briefCtx.outline?.map((o: any, i: number) => `  ${i + 1}. [${o.region}] ${o.component}${o.notes ? ` — ${o.notes}` : ''}`).join('\n') ?? ''}

REALISTIC CONTENT:
${Object.entries(briefCtx.sampleContent ?? {}).map(([k, v]) => `  ${k}: ${(v as string[]).slice(0, 4).join(' | ')}`).join('\n')}

ICONS TO USE: ${(briefCtx.icons ?? []).join(', ')}

IMAGE SLOTS: ${(briefCtx.imageSlots ?? []).map((s: any) => `${s.slug} (${s.ratio}, alt="${s.alt}")`).join(', ') || 'none'}

MOTION: level=${briefCtx.motion?.level ?? 'subtle'}; entrance=${briefCtx.motion?.entrance ?? 'fade-up stagger on lists'}; interactions=${(briefCtx.motion?.interactions ?? []).join(', ')}

DEVICE: ${device} ${width}×${height}px | BRAND: ${req.brandColor || '#6C5CE7'} | STYLE: ${req.styleKeywords?.join(', ') || 'modern, clean, light'}
COLOR SCHEME: Follow the user's prompt. Use dark mode only when dark mode, a dark theme, night mode, or a dark background is explicitly requested; otherwise use light mode. Do not infer dark mode from the app category.
${req.materialDesign3 ? 'COLOR DIRECTION: Material Design 3 enabled. Treat BRAND as the prompt-derived seed color and build a coordinated tonal palette from it.' : ''}

Output ONLY the HTML for the root <div class="screen">. No markdown fences.`;
  }

  // Fallback: no brief (direct prompt)
  return `PROJECT: ${req.projectName || 'App'}
DESCRIPTION: ${req.projectDescription || ''}
IDEA/BRIEF: ${req.projectIdea || ''}
STYLE: ${req.styleKeywords?.join(', ') || 'Modern, clean, light'} | BRAND COLOR: ${req.brandColor || '#6C5CE7'}
COLOR SCHEME: Follow the user's prompt. Use dark mode only when dark mode, a dark theme, night mode, or a dark background is explicitly requested; otherwise use light mode. Do not infer dark mode from the app category.
TARGET: ${device}, ${width}×${height}px
${req.materialDesign3 ? `DESIGN SYSTEM: Material Design 3 / Material You. Use M3 color roles, tonal surfaces, accessible contrast, consistent shapes and interaction states. Derive the palette from the user request, honoring explicit color names or hex values.` : ''}
TASK: ${req.prompt}

Use the Layout Contract v2 vocabulary. Use .icon/.avatar/.img for ALL icons/images/avatars. No <img>, <svg>, or external URLs. Use data-motion/data-stagger/data-press for all animation. Output ONLY the HTML for the root <div class="screen">.`;
}
