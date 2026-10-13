import type { Role, Region } from './roles';

export interface OutlineItem {
  region: Region;
  component: string;
  notes: string;
}

export interface Archetype {
  id: string;
  match: RegExp;
  required: Role[];
  outline: OutlineItem[];
  contentHint: string;
  icons: string[];
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'chat',
    match: /\b(chat|conversation (screen|thread)|messenger|direct message|dm)\b/i,
    required: ['app-bar', 'message-list', 'composer', 'composer-input', 'send-button'],
    outline: [
      { region: 'header', component: 'app bar', notes: 'back icon button, contact avatar (initials), name, online status, call icon button' },
      { region: 'body',   component: 'message list', notes: 'scrollable; date chip; 5-7 messages alternating incoming/outgoing; timestamp under each bubble aligned with its bubble' },
      { region: 'footer', component: 'composer', notes: 'text input (fill) + round send icon button (hug); outside the scroll area' },
    ],
    contentHint: 'short realistic conversation between two people about a plan or task',
    icons: ['arrow-left', 'phone', 'more-vertical', 'send', 'plus', 'smile'],
  },
  {
    id: 'login',
    match: /\b(log ?in|sign ?in|authentication)\b/i,
    required: ['primary-cta'],
    outline: [
      { region: 'body', component: 'brand header', notes: 'logo chip, title, one-line subtitle' },
      { region: 'body', component: 'form', notes: 'email field, password field with show/hide icon, forgot-password link' },
      { region: 'body', component: 'primary button', notes: 'full-width Sign in' },
    ],
    contentHint: 'welcome-back copy',
    icons: ['mail', 'lock', 'eye', 'eye-off', 'arrow-right'],
  },
  {
    id: 'inbox',
    match: /\b(inbox|conversations? list|messages? list|home screen.*list|list screen)\b/i,
    required: ['app-bar', 'item-list'],
    outline: [
      { region: 'header', component: 'app bar', notes: 'title and 1-2 icon buttons' },
      { region: 'body', component: 'list', notes: 'avatar + title + subtitle + trailing time, 5-6 items, identical structure' },
    ],
    contentHint: 'realistic names, previews and times',
    icons: ['search', 'plus', 'more-vertical'],
  },
  {
    id: 'dashboard',
    match: /\b(dashboard|analytics|overview|stats)\b/i,
    required: ['app-bar'],
    outline: [
      { region: 'header', component: 'app bar', notes: 'title, notification icon button' },
      { region: 'body', component: 'stat cards', notes: '2x2 grid via .row of .fill cards; label, value, delta' },
      { region: 'body', component: 'recent activity', notes: 'list of 4-5 rows' },
    ],
    contentHint: 'plausible numbers and labels',
    icons: ['bell', 'trending-up', 'bar-chart-3'],
  },
  {
    id: 'settings',
    match: /\b(settings|preferences)\b/i,
    required: ['app-bar'],
    outline: [
      { region: 'header', component: 'app bar', notes: 'back button and title' },
      { region: 'body', component: 'grouped rows', notes: 'sections with icon + label + chevron or switch' },
    ],
    contentHint: 'account, notifications, privacy, appearance, about',
    icons: ['user', 'bell', 'lock', 'moon', 'chevron-right'],
  },
  {
    id: 'profile',
    match: /\b(profile|account page)\b/i,
    required: ['app-bar'],
    outline: [
      { region: 'header', component: 'app bar', notes: 'title, edit icon' },
      { region: 'body', component: 'profile header', notes: 'avatar, name, handle, 3 stats in a row' },
      { region: 'body', component: 'info rows', notes: 'email, phone, location rows with icons' },
    ],
    contentHint: 'one believable person',
    icons: ['edit-3', 'mail', 'phone', 'map-pin'],
  },
];

// Explicit phrases in the user's prompt -> roles. `when` guards ambiguous phrases.
export const EXPLICIT: Array<{ re: RegExp; role: Role; when?: (p: string, archetype: string | null) => boolean }> = [
  {
    re: /\b(input|text) ?(box|field|bar)\b|\btype a message\b|\bcomposer\b/i,
    role: 'composer-input',
    when: (p, a) => a === 'chat' || /message|send|reply|comment/i.test(p),
  },
  { re: /\bsend (button|btn|icon)\b/i, role: 'send-button' },
  { re: /\bbottom (nav|navigation|tab|bar)\b|\btab bar\b/i, role: 'bottom-nav' },
  { re: /\bsearch (bar|box|field|input)\b/i, role: 'search-field' },
];

export interface Analysis {
  archetype: Archetype | null;
  requiredRoles: Role[];
}

export function analyze(prompt: string): Analysis {
  const scored = ARCHETYPES.map((a) => ({ a, hit: a.match.test(prompt) })).filter((x) => x.hit);
  const archetype = scored[0]?.a ?? null;
  const roles = new Set<Role>(archetype?.required ?? []);

  for (const e of EXPLICIT) {
    if (e.re.test(prompt) && (!e.when || e.when(prompt, archetype?.id ?? null))) {
      roles.add(e.role);
    }
  }

  if (roles.has('send-button') || roles.has('composer-input')) {
    // they come as a pair inside a composer
    roles.add('send-button');
    roles.add('composer-input');
    roles.add('composer');
  }

  return { archetype, requiredRoles: [...roles] };
}
