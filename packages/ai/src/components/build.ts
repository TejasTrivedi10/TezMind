import {
  hashString,
  type DesignComponentRecord as ComponentRecord,
  type DesignSystem,
} from '@tezmind/core';
import type { HttpBridge } from '@tezmind/core';
import type { AIProvider } from '../provider';

const DEFAULT_TEMPLATES: Record<string, { html: string; slots: string[]; description: string }> = {
  'app-bar': {
    description: 'Top navigation bar with back action and title',
    slots: ['leading', 'title', 'trailing'],
    html: `<header data-component="app-bar" class="row between items-center px-16 py-12 bg-background border-divider w-full hug">
  <button class="icon-btn hug" aria-label="Back"><span class="icon hug" data-icon="arrow-left"></span></button>
  <h2 class="text-lg font-heading font-semibold fill text-center">Title</h2>
  <button class="icon-btn hug" aria-label="Action"><span class="icon hug" data-icon="more-vertical"></span></button>
</header>`,
  },
  'search-field': {
    description: 'Search input container with leading search icon',
    slots: ['input', 'filter-action'],
    html: `<div data-component="search-field" class="row items-center gap-8 px-12 py-8 bg-surface rounded-input w-full hug">
  <span class="icon hug muted" data-icon="search"></span>
  <input class="fill bg-transparent text-base" placeholder="Search..." />
</div>`,
  },
  'list-item': {
    description: 'Standard row item with leading visual, text stack, and trailing chevron',
    slots: ['leading', 'content', 'trailing'],
    html: `<div data-component="list-item" class="row items-center between gap-12 p-12 bg-surface rounded-card w-full hug">
  <div class="row items-center gap-12 fill">
    <div class="icon-wrap hug"><span class="icon hug" data-icon="circle"></span></div>
    <div class="col gap-4 fill">
      <span class="text-base font-semibold">Title</span>
      <span class="text-sm muted clamp-1">Supporting description text</span>
    </div>
  </div>
  <span class="icon hug muted" data-icon="chevron-right"></span>
</div>`,
  },
  card: {
    description: 'Elevated surface card for grouping content',
    slots: ['header', 'body', 'actions'],
    html: `<div data-component="card" class="col gap-12 p-16 card w-full hug">
  <div class="row between items-center">
    <h3 class="text-base font-semibold">Card Title</h3>
    <span class="icon hug muted" data-icon="more-horizontal"></span>
  </div>
  <p class="text-sm muted clamp-2">Detailed card body copy goes here.</p>
</div>`,
  },
  'button-group': {
    description: 'Full-width bottom action container',
    slots: ['primary', 'secondary'],
    html: `<div data-component="button-group" class="row gap-8 px-16 py-12 bg-background border-divider w-full hug">
  <button class="btn fill bg-primary text-on-primary rounded-button py-12 font-medium">Continue</button>
</div>`,
  },
  'bottom-nav': {
    description: 'Persistent bottom navigation bar with icons and labels',
    slots: ['nav-items'],
    html: `<nav data-component="bottom-nav" class="row between items-center px-16 py-8 bg-surface border-divider w-full hug">
  <button class="col center gap-4 nav-item fill" aria-label="Home"><span class="icon hug" data-icon="home"></span><span class="text-xs nowrap">Home</span></button>
  <button class="col center gap-4 nav-item fill" aria-label="Search"><span class="icon hug" data-icon="search"></span><span class="text-xs nowrap">Search</span></button>
  <button class="col center gap-4 nav-item fill" aria-label="Activity"><span class="icon hug" data-icon="activity"></span><span class="text-xs nowrap">Activity</span></button>
  <button class="col center gap-4 nav-item fill" aria-label="Profile"><span class="icon hug" data-icon="user"></span><span class="text-xs nowrap">Profile</span></button>
</nav>`,
  },
};

export async function buildComponents(params: {
  rolesToBuild: string[];
  designSystem: DesignSystem;
  screenId: string;
  provider?: AIProvider;
  token?: string;
  http?: HttpBridge;
  signal?: AbortSignal;
}): Promise<ComponentRecord[]> {
  const { rolesToBuild, designSystem, screenId } = params;
  const built: ComponentRecord[] = [];

  for (const role of rolesToBuild) {
    const slug = role.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'component';
    const template = DEFAULT_TEMPLATES[slug];

    const html = template
      ? template.html
      : `<div data-component="${slug}" class="col gap-8 p-12 bg-surface rounded-card w-full hug">\n  <span class="text-base font-semibold">${role}</span>\n</div>`;

    const description = template?.description || `Generic ${role} container styled with project tokens`;
    const slots = template?.slots || ['content'];
    const contentHash = hashString(html);

    built.push({
      id: slug,
      name: slug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(''),
      version: 1,
      kind: 'GENERIC',
      description,
      props: [{ name: 'title', type: 'string', required: false }],
      slots,
      variants: ['default'],
      html,
      cssChunkId: `cmp_${slug}`,
      designSystemVersion: designSystem.version,
      contentHash,
      createdByScreenId: screenId,
      usedByScreens: [screenId],
      status: 'ready',
    });
  }

  return built;
}
