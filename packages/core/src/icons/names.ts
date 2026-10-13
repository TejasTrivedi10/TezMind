/**
 * TezMind Icon Registry — SINGLE SOURCE OF TRUTH
 *
 * Used in: refiner prompt, generator prompt, linter, hydrator, DSL converters, exporters.
 * All names are Lucide icon names (https://lucide.dev).
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

export const ICON_NAMES = [
  // Navigation
  'home', 'search', 'menu', 'x', 'chevron-left', 'chevron-right', 'chevron-up', 'chevron-down',
  'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down',

  // Actions
  'plus', 'minus', 'edit', 'edit-2', 'edit-3', 'trash', 'trash-2', 'copy', 'clipboard',
  'share', 'share-2', 'download', 'upload', 'save', 'refresh-cw', 'filter',
  'sliders-horizontal', 'sliders', 'settings', 'more-horizontal', 'more-vertical',
  'check', 'check-circle', 'check-circle-2',

  // AI / tech
  'sparkles', 'wand-2', 'bot', 'brain', 'zap', 'cpu', 'code', 'terminal', 'database',

  // Content
  'file', 'file-text', 'folder', 'folder-open', 'image', 'video', 'music', 'mic',
  'camera', 'book', 'bookmark', 'tag', 'layers', 'layout', 'grid', 'list',

  // Communication
  'mail', 'message-circle', 'message-square', 'send', 'inbox', 'phone',
  'bell', 'bell-off', 'wifi',

  // Status / feedback
  'alert-circle', 'alert-triangle', 'info', 'help-circle', 'loader', 'loader-2',
  'lock', 'lock-open', 'shield', 'shield-check', 'eye', 'eye-off',

  // Media
  'play', 'pause', 'stop-circle', 'skip-back', 'skip-forward',
  'volume', 'volume-1', 'volume-2', 'volume-x',

  // E-commerce / data
  'shopping-cart', 'shopping-bag', 'credit-card', 'wallet', 'dollar-sign',
  'bar-chart', 'bar-chart-2', 'bar-chart-3', 'pie-chart', 'trending-up', 'trending-down', 'activity',
  'percent',

  // User / social
  'user', 'user-plus', 'user-minus', 'user-check', 'users',
  'heart', 'star', 'thumbs-up', 'thumbs-down', 'smile', 'award', 'flag', 'gift',

  // Devices / tech
  'monitor', 'smartphone', 'tablet', 'laptop', 'server', 'cloud',
  'bluetooth', 'printer', 'qr-code',

  // Maps / location
  'map', 'map-pin', 'navigation', 'navigation-2', 'compass', 'globe',

  // Misc
  'sun', 'moon', 'cloud-rain', 'calendar', 'clock', 'timer',
  'maximize', 'minimize', 'link', 'link-2', 'external-link', 'hash', 'at-sign',
  'paperclip', 'scissors', 'package', 'box', 'truck', 'rss',
  'toggle-left', 'toggle-right', 'sidebar', 'columns', 'table',
  'circle', 'square', 'triangle', 'hexagon',
] as const;

export type IconName = typeof ICON_NAMES[number];

/** Set for O(1) lookups */
export const ICON_NAMES_SET: ReadonlySet<string> = new Set(ICON_NAMES);

/**
 * Validate an icon name against the allowlist.
 * Returns the name if valid, otherwise 'circle' (safe fallback).
 */
export function resolveIconName(name: string | undefined | null): string {
  if (!name) return 'circle';
  const clean = name.trim().toLowerCase();
  return ICON_NAMES_SET.has(clean) ? clean : 'circle';
}
