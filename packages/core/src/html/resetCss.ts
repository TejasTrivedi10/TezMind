import type { DesignTokens } from '../dsl';

/**
 * TezMind HTML Preview Reset Stylesheet (B4 spec)
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
  background: var(--background, #0F172A);
  color: var(--text, #F8FAFC);
  font-family: var(--font-body, system-ui, -apple-system, sans-serif);
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
button[data-tz-id] {
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: var(--surface, #1E293B);
  object-fit: cover;
}
[data-tz-id][data-selected] {
  outline: 2px solid #6C5CE7;
  outline-offset: -2px;
}
`;

/**
 * Generate CSS custom variables from design tokens and brand color
 */
export function generateTokenCssVariables(
  tokens?: DesignTokens,
  brandColor?: string,
): string {
  const primary = brandColor || tokens?.colors?.primary || '#6C5CE7';
  const background = tokens?.colors?.background || '#0F172A';
  const surface = tokens?.colors?.surface || '#1E293B';
  const text = tokens?.colors?.text || '#F8FAFC';
  const textMuted = tokens?.colors?.textMuted || '#94A3B8';
  const border = tokens?.colors?.border || '#334155';

  return `
:root {
  --primary: ${primary};
  --background: ${background};
  --surface: ${surface};
  --text: ${text};
  --textMuted: ${textMuted};
  --border: ${border};
}
`;
}
