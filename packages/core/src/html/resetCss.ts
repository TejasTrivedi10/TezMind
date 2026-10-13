import type { DesignTokens } from '../dsl';

/**
 * TezMind HTML Preview Reset Stylesheet (v2 spec)
 */
export const RESET_STYLESHEET = `
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html, body {
  width: 100%;
  height: 100%;
  background: var(--background, #FFFFFF);
  color: var(--text, #202123);
  font-family: var(--font-sans, Manrope, Inter, 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif);
  font-size: 16px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
[data-tz-id] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
[data-tz-id]:is(h1, h2, h3, h4, h5, h6, p, span, label) {
  display: block;
}
[data-tz-id]:is(h1, h2, h3, h4, h5, h6, p, label) {
  align-self: stretch;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
[data-tz-id].col > span:not(.hug):not(.nowrap),
[data-tz-id].scroll > span:not(.hug):not(.nowrap),
.col > [data-tz-id]:is(span):not(.hug):not(.nowrap),
.scroll > [data-tz-id]:is(span):not(.hug):not(.nowrap) {
  align-self: stretch;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
button[data-tz-id] {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  border: 0;
  font: inherit;
  color: inherit;
  background: none;
  cursor: pointer;
}
input[data-tz-id], textarea[data-tz-id] {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  outline: 0;
}
img[data-tz-id] {
  display: block;
  background: var(--surface, #F7F7F8);
  object-fit: cover;
}
[data-tz-id][data-selected] {
  outline: 2px solid var(--primary, #10A37F);
  outline-offset: -2px;
}
`;

/**
 * Auto-Layout utility class vocabulary (Layout Contract v2).
 *
 * The AI is instructed to ONLY use these classes for layout — no raw margin,
 * position:absolute|fixed, or float anywhere except data-tz-overlay nodes.
 *
 * Maps cleanly to cross-platform code:
 *   .col   → Column / flexDirection:'column'
 *   .row   → Row    / flexDirection:'row'
 *   .fill  → Expanded / flex:1
 *   .hug   → flex:0 0 auto / SizedBox wrapping Hug
 *   .gap-3 → gap: 12px / gap: 12
 *
 * Motion system: animations are gated on .tz-play (never fires during streaming).
 * During streaming, .tz-streaming disables all animations so chunks don't flicker.
 */
export const AUTO_LAYOUT_STYLESHEET = `
/* ── Spacing scale ─────────────────────────────────── */
:root {
  --s1: 4px;
  --s2: 8px;
  --s3: 12px;
  --s4: 16px;
  --s5: 24px;
  --s6: 32px;
  --s7: 40px;
  --s8: 48px;
  --font-sans: Manrope, Inter, 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;

  /* Motion tokens */
  --tz-ease: cubic-bezier(.2,.8,.2,1);
  --tz-dur: 420ms;
  --tz-step: 60ms;
}

/* ── Layout primitives ─────────────────────────────── */
.screen {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--font-sans);
}
.col  { display: flex; flex-direction: column; min-width: 0; max-width: 100%; }
.row  { display: flex; flex-direction: row; align-items: center; min-width: 0; max-width: 100%; }

/* Sizing modes */
.fill {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow-wrap: anywhere;
}
.hug  { flex: 0 0 auto; }
.w-full  { width: 100%; }
.h-full  { height: 100%; }

/* Scrollable content region */
.scroll   { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; }
.scroll::-webkit-scrollbar { display: none; }
.scroll-x {
  display: flex;
  flex-direction: row;
  flex: 0 0 auto;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;
  scrollbar-width: none;
}
.scroll-x::-webkit-scrollbar { display: none; }
.scroll-x > .carousel-item { flex: 0 0 85%; width: 85%; max-width: 85%; box-sizing: border-box; }

/* Alignment helpers */
.between       { justify-content: space-between; }
.around        { justify-content: space-around; }
.center        { align-items: center; justify-content: center; }
.items-start   { align-items: flex-start; }
.items-end     { align-items: flex-end; }
.items-center  { align-items: center; }
.items-stretch { align-items: stretch; }
.justify-start  { justify-content: flex-start; }
.justify-end    { justify-content: flex-end; }
.justify-center { justify-content: center; }
.wrap { flex-wrap: wrap; }

/* ── Gap scale ─────────────────────────────────────── */
.gap-0 { gap: 0; }
.gap-1 { gap: var(--s1); }
.gap-2 { gap: var(--s2); }
.gap-3 { gap: var(--s3); }
.gap-4 { gap: var(--s4); }
.gap-5 { gap: var(--s5); }
.gap-6 { gap: var(--s6); }

/* ── Padding (all sides) ───────────────────────────── */
.p-0 { padding: 0; }
.p-1 { padding: var(--s1); }
.p-2 { padding: var(--s2); }
.p-3 { padding: var(--s3); }
.p-4 { padding: var(--s4); }
.p-5 { padding: var(--s5); }
.p-6 { padding: var(--s6); }

/* ── Padding inline (horizontal) ──────────────────── */
.px-2 { padding-inline: var(--s2); }
.px-3 { padding-inline: var(--s3); }
.px-4 { padding-inline: var(--s4); }
.px-5 { padding-inline: var(--s5); }
.px-6 { padding-inline: var(--s6); }

/* ── Padding block (vertical) ─────────────────────── */
.py-1 { padding-block: var(--s1); }
.py-2 { padding-block: var(--s2); }
.py-3 { padding-block: var(--s3); }
.py-4 { padding-block: var(--s4); }
.py-5 { padding-block: var(--s5); }

/* ── Border radius ─────────────────────────────────── */
.rounded-sm   { border-radius: 4px; }
.rounded      { border-radius: 8px; }
.rounded-md   { border-radius: 12px; }
.rounded-lg   { border-radius: 16px; }
.rounded-xl   { border-radius: 24px; }
.rounded-full { border-radius: 9999px; }

/* ── Text utilities ────────────────────────────────── */
.nowrap { white-space: nowrap; }
.clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

/* ── Text overflow in fill containers ─────────────── */
.fill p, .fill span, .fill h1, .fill h2, .fill h3,
.fill h4, .fill h5, .fill h6, .fill label {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* ── Typography scale ──────────────────────────────── */
.text-xs  { font-size: 12px; line-height: 1.4; }
.text-sm  { font-size: 14px; line-height: 1.4; }
.text-md  { font-size: 16px; line-height: 1.5; font-weight: 500; }
.text-lg  { font-size: 20px; line-height: 1.3; font-weight: 600; }
.text-xl  { font-size: 24px; line-height: 1.25; font-weight: 700; }
.text-2xl { font-size: 30px; line-height: 1.2; font-weight: 700; }
.eyebrow  { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6; }
.muted    { opacity: 0.6; }
.link     { color: var(--primary); cursor: pointer; }

/* ── Divider ───────────────────────────────────────── */
.divider {
  width: 100%;
  height: 1px;
  background-color: var(--border, #334155);
  flex-shrink: 0;
}

/* ── Overlay / floating badge anchoring ────────────── */
.overlay-anchor { position: relative; }
[data-tz-overlay] { position: absolute; }

/* ── Icon system ───────────────────────────────────── */
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: inherit;
  width: var(--sz, 20px);
  height: var(--sz, 20px);
}
.icon svg {
  width: 100%;
  height: 100%;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 40px;
  min-height: 40px;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  border-radius: var(--radius-md, 12px);
}
.fab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-end;
  flex: 0 0 auto;
  min-width: 56px;
  min-height: 56px;
  padding: 16px;
  border-radius: 16px;
  background: var(--primary, #6C5CE7);
  color: var(--onPrimary, #FFFFFF);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
}
.screen > .fab { margin: 0 16px 16px; }
.icon-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  border-radius: 10px;
}

/* ── Avatar system ─────────────────────────────────── */
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 14px;
  flex: 0 0 auto;
  background: var(--surface, #F7F7F8);
  color: var(--text, #F8FAFC);
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

/* ── Image slot system ─────────────────────────────── */
.img {
  width: 100%;
  border-radius: var(--radius-md, 12px);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface, #F7F7F8);
  position: relative;
  flex-shrink: 0;
}
.img-credit {
  position: absolute;
  right: 6px;
  bottom: 6px;
  max-width: calc(100% - 12px);
  overflow: hidden;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(15, 18, 24, 0.72);
  color: #fff;
  font: 500 9px/1.3 system-ui, sans-serif;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
  z-index: 1;
}

/* ── Component primitives ──────────────────────────── */
.card {
  background: var(--surface, #F7F7F8);
  border-radius: var(--radius-md, 12px);
  border: 1px solid var(--border, #334155);
  min-width: 0;
  max-width: 100%;
}
.btn-primary {
  background: var(--primary, #6C5CE7);
  color: #fff;
  border: none;
  border-radius: var(--radius-md, 12px);
  padding: 12px 20px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
}
.btn-secondary {
  background: var(--surface, #F7F7F8);
  color: var(--text, #F8FAFC);
  border: 1px solid var(--border, #334155);
  border-radius: var(--radius-md, 12px);
  padding: 12px 20px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  gap: 4px;
  min-height: 48px;
  cursor: pointer;
  border: none;
  background: none;
  color: var(--text, #F8FAFC);
  opacity: 0.5;
  border-radius: 10px;
}
.nav-item.active,
.nav-item[data-active] { opacity: 1; color: var(--primary, #6C5CE7); }
.nav-item .nowrap { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }

/* ── Motion keyframes ──────────────────────────────── */
@keyframes tz-fade-in    { from { opacity: 0 } to { opacity: 1 } }
@keyframes tz-fade-up    { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes tz-fade-down  { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: none } }
@keyframes tz-slide-left { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: none } }
@keyframes tz-slide-right{ from { opacity: 0; transform: translateX(-16px) } to { opacity: 1; transform: none } }
@keyframes tz-scale-in   { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: none } }
@keyframes tz-pulse  { 0%,100% { transform: scale(1) } 50% { transform: scale(1.04) } }
@keyframes tz-float  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes tz-glow   {
  0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent) }
  50%     { box-shadow: 0 0 20px 2px color-mix(in srgb, var(--primary) 35%, transparent) }
}
@keyframes tz-shimmer{ from { background-position: -200% 0 } to { background-position: 200% 0 } }

/* ── Motion: ENTRANCE (plays only after .tz-play is set on root) ─── */
@media (prefers-reduced-motion: no-preference) {
  .tz-play [data-motion] {
    animation-duration: var(--tz-dur);
    animation-timing-function: var(--tz-ease);
    animation-fill-mode: both;
    animation-delay: calc((var(--i, 0) + var(--d, 0)) * var(--tz-step));
  }
  .tz-play [data-motion="fade-in"]     { animation-name: tz-fade-in }
  .tz-play [data-motion="fade-up"]     { animation-name: tz-fade-up }
  .tz-play [data-motion="fade-down"]   { animation-name: tz-fade-down }
  .tz-play [data-motion="slide-left"]  { animation-name: tz-slide-left }
  .tz-play [data-motion="slide-right"] { animation-name: tz-slide-right }
  .tz-play [data-motion="scale-in"]    { animation-name: tz-scale-in }
  /* Loop animations */
  .tz-play [data-motion="pulse"]   { animation: tz-pulse   2.2s ease-in-out 600ms infinite }
  .tz-play [data-motion="float"]   { animation: tz-float   3s   ease-in-out infinite }
  .tz-play [data-motion="glow"]    { animation: tz-glow    2.4s ease-in-out infinite }
  .tz-play [data-motion="shimmer"] { background-size: 200% 100%; animation: tz-shimmer 1.8s linear infinite }
}

/* ── Streaming: disable all animations, keep content visible ─────── */
/* Prevents flicker/restart when innerHTML is replaced each SSE chunk */
.tz-streaming [data-motion] {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}

/* ── Motion: level=none override ─────────────────────────────────── */
[data-motion-level="none"] [data-motion] {
  animation: none !important;
}

/* ── Interaction feedback (always active, transform only) ─────────── */
[data-press] {
  transition: transform 120ms var(--tz-ease);
  cursor: pointer;
}
[data-press]:active {
  transform: scale(.97);
}
[data-hover="lift"] {
  transition: transform 160ms var(--tz-ease), box-shadow 160ms var(--tz-ease);
}
[data-hover="lift"]:hover {
  transform: translateY(-2px);
}

/* ── Form & control elements (Contract v2) ─────────── */
.screen > .scroll { flex: 1 1 0; min-height: 0; overflow-y: auto; scrollbar-width: none; }
.screen > .scroll::-webkit-scrollbar { display: none; }
/* Stretch primary content sections across the device. Nodes carry data-tz-id,
   whose default align-items:flex-start otherwise makes column children shrink
   to their content (notably bottom action panels and wide cards). */
.screen > .scroll > :not(.hug):not(.icon):not(.avatar):not(.fab),
.col > :not(.hug):not(.icon):not(.avatar):not(.fab) {
  align-self: stretch;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
.screen > header,
.screen > [data-role="app-bar"] {
  width: 100%;
  align-self: stretch;
  flex: 0 0 auto;
  background-color: var(--background);
}
.screen > header,
.screen > [data-role="app-bar"] {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3, 12px);
  min-width: 0;
  box-sizing: border-box;
}
.screen > header h1,
.screen > header h2,
.screen > [data-role="app-bar"] h1,
.screen > [data-role="app-bar"] h2 {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.screen > header .col,
.screen > [data-role="app-bar"] .col {
  flex: 1 1 auto;
  min-width: 0;
}
.screen > header h1,
.screen > header h2,
.screen > [data-role="app-bar"] h1,
.screen > [data-role="app-bar"] h2 {
  max-width: 100%;
}
.screen > nav,
.screen > footer,
.screen > [data-role="bottom-nav"],
.screen > [data-role="footer"] {
  width: 100%;
  align-self: stretch;
  flex: 0 0 auto;
  box-sizing: border-box;
  background-color: var(--background) !important;
}
.screen > nav .nav-item,
.screen > [data-role="bottom-nav"] .nav-item {
  flex: 1 1 0;
  min-width: 0;
}

.field {
  flex: 1 1 0;
  min-width: 0;
  height: 44px;
  padding: 0 16px;
  border-radius: 9999px;
  border: 1px solid var(--border, #334155);
  background: var(--surface, #F7F7F8);
  color: var(--text, #F8FAFC);
  font: inherit;
  outline: none;
}
.field:focus { border-color: var(--primary, #6C5CE7); }
.field::placeholder { color: var(--textMuted, #94A3B8); }
textarea.field { height: auto; min-height: 44px; padding-block: 12px; border-radius: var(--radius-md, 12px); resize: none; }

.icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  border: 0;
  background: var(--primary, #6C5CE7);
  color: var(--on-primary, #000);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  cursor: pointer;
}
.icon-btn .icon { color: currentColor; }

.self-start { align-self: flex-start; }
.self-end { align-self: flex-end; }
.bubble-wrap { max-width: 80%; }
.bubble-in, .bubble-out { border-radius: var(--radius-md, 12px); overflow-wrap: anywhere; }
.bubble-in { background: var(--surface, #F7F7F8); color: var(--text, #202123); }
.bubble-out { background: var(--primary, #6C5CE7); color: var(--on-primary, #000); }
.chip { display: inline-flex; padding: 4px 12px; border-radius: 9999px; background: var(--surface, #F7F7F8); font-size: 12px; }
`;

/**
 * Generate CSS custom variables from design tokens and brand color
 */
export function generateTokenCssVariables(
  tokens?: DesignTokens,
  brandColor?: string,
  materialDesign3 = false,
  colorScheme: 'light' | 'dark' = 'light',
): string {
  const primary = brandColor || tokens?.colors?.primary || '#6C5CE7';
  const m3Light = colorScheme === 'light';
  const background = tokens?.colors?.background || (m3Light ? '#FFFFFF' : '#0F172A');
  const surface = tokens?.colors?.surface || (m3Light ? '#F7F7F8' : '#1E293B');
  const text = tokens?.colors?.text || (m3Light ? '#202123' : '#F8FAFC');
  const textMuted = tokens?.colors?.textMuted || (m3Light ? '#6B7280' : '#94A3B8');
  const border = tokens?.colors?.border || (m3Light ? '#E5E7EB' : '#334155');
  const onPrimary = isLightColor(primary) ? '#1C1B1F' : '#FFFFFF';
  const primaryContainer = m3Light ? tintHex(primary, 0.84) : tintHex(primary, 0.26);
  const onPrimaryContainer = m3Light ? '#1D1730' : '#F1EAFE';
  const secondary = tintHex(primary, m3Light ? 0.25 : 0.45);
  const onSurface = text;
  const surfaceVariant = m3Light ? '#E7E0EC' : '#49454F';
  const onSurfaceVariant = m3Light ? '#49454F' : '#CAC4D0';

  // Derive radius from tokens or pick a sensible default
  const radiusSm = '4px';
  const radiusMd = '12px';
  const radiusLg = '16px';

  return `
:root {
  --primary: ${primary};
  --background: ${background};
  --surface: ${surface};
  --text: ${text};
  --textMuted: ${textMuted};
  --border: ${border};
  --md-sys-color-primary: ${primary};
  --md-sys-color-on-primary: ${onPrimary};
  --md-sys-color-primary-container: ${primaryContainer};
  --md-sys-color-on-primary-container: ${onPrimaryContainer};
  --md-sys-color-secondary: ${secondary};
  --md-sys-color-on-secondary: ${onPrimary};
  --md-sys-color-surface: ${surface};
  --md-sys-color-on-surface: ${onSurface};
  --md-sys-color-surface-container: ${surface};
  --md-sys-color-surface-container-high: ${m3Light ? '#ECE6F0' : '#36343B'};
  --md-sys-color-surface-variant: ${surfaceVariant};
  --md-sys-color-on-surface-variant: ${onSurfaceVariant};
  --md-sys-color-outline: ${border};
  --md-sys-color-error: ${m3Light ? '#BA1A1A' : '#F2B8B5'};
  --md-sys-color-on-error: ${m3Light ? '#FFFFFF' : '#601410'};
  --radius-sm: ${radiusSm};
  --radius-md: ${radiusMd};
  --radius-lg: ${radiusLg};
}
`;
}

function tintHex(color: string, amount: number): string {
  const match = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return color;
  const raw = match[1].length === 3 ? match[1].split('').map((part) => part + part).join('') : match[1];
  const channels = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16));
  return `#${channels.map((channel) => Math.round(channel * (1 - amount) + 255 * amount).toString(16).padStart(2, '0')).join('')}`;
}

function isLightColor(color: string): boolean {
  const match = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return false;
  const raw = match[1].length === 3 ? match[1].split('').map((part) => part + part).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16) / 255);
  const linear = [r, g, b].map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.42;
}
