import { autofix } from '../html/autofix';
import { parseScreen } from '../html/parse';

describe('autofix()', () => {
  test('truncated chat HTML gets composer injected', () => {
    const truncated = `<div class="screen"><div class="row px-4 py-3"><h1>Chat</h1></div><div class="scroll col gap-3"><div class="bubble-in p-3">Hi</div>`; // cut off
    const out = autofix(truncated, { required: ['composer', 'composer-input', 'send-button'] });
    const root = parseScreen(out).body.firstElementChild as HTMLElement;

    expect(root.querySelector('[data-role="composer-input"]')).toBeTruthy();
    expect(root.querySelector('[data-role="send-button"]')).toBeTruthy();
    expect(root.querySelector('.scroll [data-role="composer"]')).toBeNull(); // outside scroll
  });

  test('adds page padding to scroll and header when missing', () => {
    const html = `<div class="screen"><div class="row">Header</div><div class="scroll col">Body</div></div>`;
    const out = autofix(html, { required: [] });
    const root = parseScreen(out).body.firstElementChild as HTMLElement;

    const header = root.children[0];
    const body = root.children[1];
    expect(header.classList.contains('px-4')).toBe(true);
    expect(header.classList.contains('py-3')).toBe(true);
    expect(body.classList.contains('px-4')).toBe(true);
    expect(body.classList.contains('py-3')).toBe(true);
  });

  test('label next to hug badge becomes fill', () => {
    const html = `<div class="screen"><div class="row between"><span>Name</span><span class="hug">Now</span></div></div>`;
    const out = autofix(html, { required: [] });
    const root = parseScreen(out).body.firstElementChild as HTMLElement;

    const spanName = root.querySelector('span');
    expect(spanName?.classList.contains('fill')).toBe(true);
  });

  test('composer inside scroll is moved out', () => {
    const html = `
      <div class="screen">
        <div class="scroll col">
          <div class="row" data-role="composer">
            <input class="field fill" data-role="composer-input">
            <button class="icon-btn hug" data-role="send-button"></button>
          </div>
        </div>
      </div>
    `;
    const out = autofix(html, { required: ['composer', 'composer-input', 'send-button'] });
    const root = parseScreen(out).body.firstElementChild as HTMLElement;

    expect(root.querySelector('.scroll [data-role="composer"]')).toBeNull();
    expect(root.querySelector(':scope > [data-role="composer"]')).toBeTruthy();
  });

  test('legacy <i class="fa fa-paper-plane"> becomes send icon', () => {
    const html = `<div class="screen"><i class="fa fa-paper-plane"></i></div>`;
    const out = autofix(html, { required: [] });
    const root = parseScreen(out).body.firstElementChild as HTMLElement;

    const icon = root.querySelector('span.icon');
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute('data-icon')).toBe('send');
  });

  test('autofix is idempotent', () => {
    const html = `<div class="screen"><div class="row"><span>Hello</span><span class="hug">Chip</span></div></div>`;
    const ctx = { required: [] as any };
    const pass1 = autofix(html, ctx);
    const pass2 = autofix(pass1, ctx);
    expect(pass2).toBe(pass1);
  });

  test('strips script, handlers, and external URLs', () => {
    const html = `<div class="screen"><script>alert(1)</script><div onclick="evil()" style="margin: 20px; color: red;" data-url="http://evil.com">Clean</div></div>`;
    const out = autofix(html, { required: [] });
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('http://evil.com');
    expect(out).not.toContain('margin');
    expect(out).toContain('color: red');
  });

  test('keeps actions in flow and removes fixed container sizing that can cause overlap', () => {
    const html = `<div class="screen"><div class="card" style="height: 152px"><p>Long digest text wraps to another line</p><button class="btn-primary" data-tz-overlay style="position: absolute; top: 60px; transform: translateY(-20px)">Review notes</button></div></div>`;
    const out = autofix(html, { required: [] });
    const root = parseScreen(out).body.firstElementChild as HTMLElement;
    const card = root.querySelector('.card');
    const button = root.querySelector('button');

    expect(card?.getAttribute('style') ?? '').not.toMatch(/height\s*:/i);
    expect(button?.hasAttribute('data-tz-overlay')).toBe(false);
    expect(button?.getAttribute('style') ?? '').not.toMatch(/position\s*:\s*absolute|transform\s*:/i);
  });

  test('preserves explicitly approved badge overlays', () => {
    const out = autofix(`<div class="screen"><div class="card overlay-anchor"><span class="badge-overlay" data-tz-overlay style="position: absolute; top: 0"></span></div></div>`, { required: [] });
    expect(out).toContain('class="badge-overlay" data-tz-overlay');
    expect(out).toContain('position: absolute');
  });
});
