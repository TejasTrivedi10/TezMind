/**
 * Deterministic HTML snippets for role injection (composer, search, bottom-nav)
 */

export const COMPOSER_HTML = `
<div class="row gap-2 px-4 py-3" data-role="composer">
  <input class="field fill" type="text" placeholder="Message" data-role="composer-input">
  <button class="icon-btn hug center" data-press data-role="send-button" aria-label="Send">
    <span class="icon" data-icon="send" data-size="20"></span>
  </button>
</div>`;

export const SEARCH_HTML = `
<div class="row gap-2 px-4 py-3" data-role="search-field">
  <span class="icon hug" data-icon="search" data-size="20"></span>
  <input class="field fill" type="text" placeholder="Search">
</div>`;

export const BOTTOM_NAV_HTML = `
<nav class="row between px-2 py-2 gap-1 w-full" style="background:var(--background);border-top:1px solid var(--border)" data-role="bottom-nav">
  ${[['home', 'Home'], ['search', 'Search'], ['message-circle', 'Chats'], ['user', 'Profile']].map(([i, l]) => `
  <button class="nav-item col fill center gap-1" data-press><span class="icon" data-icon="${i}" data-size="24"></span><span class="text-xs nowrap">${l}</span></button>`).join('')}
</nav>`;
