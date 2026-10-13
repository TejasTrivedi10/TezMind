/**
 * Icon name allowlist — the AI may only reference icon names from this list.
 * Source: Lucide Icons (https://lucide.dev).
 *
 * This list is used at validation time to reject unknown icon names.
 * Add new icons here as needed.
 *
 * PURE TYPESCRIPT — no host-specific imports.
 */

export const ICON_NAMES = new Set([
  // Navigation
  'home', 'search', 'menu', 'x', 'chevron-left', 'chevron-right', 'chevron-up', 'chevron-down',
  'arrow-left', 'arrow-right', 'arrow-up', 'arrow-down', 'corner-up-left', 'corner-up-right',

  // Actions
  'plus', 'minus', 'edit', 'edit-2', 'edit-3', 'trash', 'trash-2', 'copy', 'clipboard',
  'share', 'share-2', 'download', 'upload', 'save', 'refresh-cw', 'refresh-ccw', 'rotate-cw',
  'rotate-ccw', 'filter', 'sliders', 'settings', 'more-horizontal', 'more-vertical',

  // Content
  'file', 'file-text', 'folder', 'folder-open', 'image', 'video', 'music', 'mic',
  'camera', 'film', 'book', 'book-open', 'bookmark', 'tag', 'layers', 'layout',
  'grid', 'list', 'align-left', 'align-center', 'align-right', 'align-justify',

  // Communication
  'mail', 'mail-open', 'message-circle', 'message-square', 'send', 'inbox', 'phone',
  'phone-call', 'phone-incoming', 'phone-outgoing', 'phone-missed', 'phone-off',
  'bell', 'bell-off', 'wifi', 'wifi-off',

  // Status / feedback
  'check', 'check-circle', 'check-circle-2', 'check-square', 'x-circle', 'x-square',
  'alert-circle', 'alert-triangle', 'info', 'help-circle', 'loader', 'loader-2',
  'lock', 'lock-open', 'unlock', 'shield', 'eye', 'eye-off',

  // Media
  'play', 'pause', 'stop-circle', 'skip-back', 'skip-forward', 'rewind', 'fast-forward',
  'volume', 'volume-1', 'volume-2', 'volume-x',

  // E-commerce / data
  'shopping-cart', 'shopping-bag', 'credit-card', 'dollar-sign', 'bar-chart',
  'bar-chart-2', 'pie-chart', 'trending-up', 'trending-down', 'activity',

  // User / social
  'user', 'user-plus', 'user-minus', 'user-check', 'users', 'heart', 'star',
  'thumbs-up', 'thumbs-down', 'smile', 'frown', 'meh', 'award', 'zap', 'flag',

  // Devices / tech
  'monitor', 'smartphone', 'tablet', 'laptop', 'cpu', 'database', 'server',
  'cloud', 'cloud-off', 'bluetooth', 'cast', 'printer', 'scan', 'qr-code',

  // Maps / location
  'map', 'map-pin', 'navigation', 'navigation-2', 'compass', 'globe',

  // Misc
  'sun', 'moon', 'cloud-rain', 'wind', 'calendar', 'clock', 'timer', 'watch',
  'maximize', 'minimize', 'maximize-2', 'minimize-2', 'move', 'link', 'link-2',
  'external-link', 'code', 'terminal', 'hash', 'at-sign', 'paperclip', 'scissors',
  'type', 'bold', 'italic', 'underline', 'strikethrough', 'quote', 'package',
  'box', 'gift', 'truck', 'map-pin', 'rss', 'toggle-left', 'toggle-right',
  'sidebar', 'columns', 'table', 'form-input', 'percent', 'sigma',
]);

export const ICON_NAMES_ARRAY = Array.from(ICON_NAMES);

/** Safe list of font families the AI may use. */
export const ALLOWED_FONTS = [
  'Inter',
  'Manrope',
  'Plus Jakarta Sans',
  'Roboto',
  'Outfit',
  'Poppins',
  'Nunito',
  'system',
  'System',
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];
