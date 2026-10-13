/**
 * Role definitions and region mappings (Layout Contract v2)
 */

export const ROLES = [
  'app-bar',
  'message-list',
  'composer',
  'composer-input',
  'send-button',
  'bottom-nav',
  'search-field',
  'primary-cta',
  'item-list',
  'form-submit',
] as const;

export type Role = (typeof ROLES)[number];
export type Region = 'header' | 'body' | 'footer';

export const ROLE_REGION: Record<Role, Region> = {
  'app-bar': 'header',
  'message-list': 'body',
  'composer': 'footer',
  'composer-input': 'footer',
  'send-button': 'footer',
  'bottom-nav': 'footer',
  'search-field': 'header',
  'primary-cta': 'body',
  'item-list': 'body',
  'form-submit': 'body',
};

export const ROLE_DESC: Record<Role, string> = {
  'app-bar': 'top app bar with title and actions',
  'message-list': 'scrollable list of chat messages',
  'composer': 'footer row containing the message input and send button',
  'composer-input': 'single-line text input for typing a message (placeholder "Message")',
  'send-button': 'round icon button with the send icon next to the input',
  'bottom-nav': 'bottom navigation with 3-5 labelled icon items',
  'search-field': 'search input with search icon',
  'primary-cta': 'main call-to-action button',
  'item-list': 'scrollable list of cards/rows',
  'form-submit': 'submit button at the end of the form',
};
