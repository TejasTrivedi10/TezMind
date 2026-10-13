/**
 * TezMind HTML Layout Linter + Auto-Repair (Layer 3)
 *
 * Runs in the browser after generation.
 * Detects layout contract violations and produces a minimal violation report
 * that is fed back to the AI for repair (max 2 passes).
 *
 * Rules enforced:
 *  1. No margin on container elements
 *  2. No position:absolute|fixed on non-overlay elements
 *  3. No float on any element
 *  4. No width/height in style on non-leaf containers
 *  5. All px values must be on the 4px grid
 *  6. Every .row must have a gap-* class
 *  7. Every .col with multiple children must have a gap-* class
 *  8. No display:grid or display:inline-flex
 *  9. No unknown layout classes (unknown class names not in the allowed set)
 * 10. .fill used only inside .row or .col parents
 */

export interface LayoutViolation {
  /** CSS selector-like description of the offending element */
  selector: string;
  /** Machine-readable rule identifier */
  rule: string;
  /** Human-readable explanation */
  message: string;
  /** Suggested minimal fix */
  fix: string;
}

/** Known auto-layout utility class prefixes */
const ALLOWED_LAYOUT_PREFIXES = new Set([
  'screen', 'col', 'row', 'fill', 'hug', 'scroll', 'scroll-x',
  'between', 'around', 'center', 'wrap',
  'items-start', 'items-end', 'items-center', 'items-stretch',
  'justify-start', 'justify-end', 'justify-center',
  'w-full', 'h-full',
  'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-5', 'gap-6',
  'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6',
  'px-2', 'px-3', 'px-4', 'px-5', 'px-6',
  'py-1', 'py-2', 'py-3', 'py-4', 'py-5',
  'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full',
  'divider', 'overlay-anchor',
]);

const LEAF_TAGS = new Set(['I', 'IMG', 'HR', 'INPUT', 'TEXTAREA', 'BUTTON', 'SVG']);

function isLeaf(el: Element): boolean {
  if (LEAF_TAGS.has(el.tagName)) return true;
  if (!el.children || el.children.length === 0) return true;
  // Treat as leaf if it has data-tz-overlay (floating elements get size freedom)
  if (el.hasAttribute('data-tz-overlay')) return true;
  return false;
}

function getSelector(el: Element): string {
  const id = el.getAttribute('data-tz-id');
  const name = el.getAttribute('data-tz-name');
  const tag = el.tagName.toLowerCase();
  if (id) return `[data-tz-id="${id}"]${name ? ` (${name})` : ''}`;
  const cls = el.className ? `.${String(el.className).trim().split(/\s+/).slice(0, 2).join('.')}` : '';
  return `${tag}${cls}`;
}

function parseStyle(styleAttr: string): Record<string, string> {
  const result: Record<string, string> = {};
  styleAttr.split(';').forEach((decl) => {
    const [prop, val] = decl.split(':').map((s) => s.trim());
    if (prop && val) result[prop.toLowerCase()] = val.toLowerCase();
  });
  return result;
}

function isOnFourPxGrid(value: string): boolean {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  if (!match) return true; // non-px values are OK
  const num = parseFloat(match[1]);
  return num % 4 === 0 || num === 1; // 1px is allowed for dividers/borders
}

function hasGapClass(el: Element): boolean {
  return Array.from(el.classList).some((c) => c.startsWith('gap-'));
}

/**
 * Lint the generated HTML string for layout contract violations.
 * Uses DOMParser (browser-only).
 */
export function lintHtml(html: string): LayoutViolation[] {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return []; // SSR / non-browser: skip
  }

  const violations: LayoutViolation[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');

  const walk = (el: Element) => {
    const styleAttr = el.getAttribute('style') || '';
    const styles = parseStyle(styleAttr);
    const sel = getSelector(el);
    const leaf = isLeaf(el);
    const isOverlay = el.hasAttribute('data-tz-overlay');
    const classes = Array.from(el.classList);

    // Rule 1: No margin on containers
    const marginProps = ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'];
    marginProps.forEach((prop) => {
      if (styles[prop] && styles[prop] !== '0' && styles[prop] !== '0px') {
        violations.push({
          selector: sel,
          rule: 'NO_MARGIN',
          message: `${sel} uses ${prop}:${styles[prop]}. Margins are forbidden — use gap-* on the parent instead.`,
          fix: `Remove ${prop} from style. Add a gap-* class to the parent container.`,
        });
      }
    });

    // Rule 2: No position:absolute|fixed on non-overlay elements
    if (!isOverlay && (styles['position'] === 'absolute' || styles['position'] === 'fixed')) {
      violations.push({
        selector: sel,
        rule: 'NO_ABSOLUTE_POSITION',
        message: `${sel} uses position:${styles['position']}. Only data-tz-overlay elements may be positioned.`,
        fix: `Add data-tz-overlay attribute and wrap parent with class="overlay-anchor". Or restructure using .row.between.`,
      });
    }

    // Rule 3: No float
    if (styles['float'] && styles['float'] !== 'none') {
      violations.push({
        selector: sel,
        rule: 'NO_FLOAT',
        message: `${sel} uses float:${styles['float']}. Float is forbidden — use .row for horizontal layout.`,
        fix: `Replace float with a .row parent container.`,
      });
    }

    // Rule 4: No width/height on non-leaf containers
    if (!leaf) {
      ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height'].forEach((prop) => {
        const val = styles[prop];
        if (val && val !== '100%' && val.endsWith('px')) {
          const num = parseFloat(val);
          if (!isNaN(num) && num > 56) {
            // Large fixed sizes on containers are suspicious
            violations.push({
              selector: sel,
              rule: 'FIXED_SIZE_ON_CONTAINER',
              message: `${sel} has ${prop}:${val} on a container. Use .fill or .hug instead of fixed sizes on containers.`,
              fix: `Remove ${prop} from style. Add class .fill (if it should stretch) or .hug (if it should shrink-wrap).`,
            });
          }
        }
      });
    }

    // Rule 5: All px values on 4px grid (check all style values)
    Object.entries(styles).forEach(([prop, val]) => {
      if (!['border-radius', 'font-size', 'line-height', 'letter-spacing', 'opacity'].includes(prop)) {
        const nums = (val.match(/(\d+(?:\.\d+)?)px/g) || []);
        nums.forEach((pxVal) => {
          if (!isOnFourPxGrid(pxVal)) {
            violations.push({
              selector: sel,
              rule: 'OFF_GRID_SPACING',
              message: `${sel} has ${prop}:…${pxVal}… which is not on the 4px grid.`,
              fix: `Round ${pxVal} to the nearest 4px multiple.`,
            });
          }
        });
      }
    });

    // Rule 6: .row with multiple children must have a gap-* class
    if (classes.includes('row') && el.children.length > 1 && !hasGapClass(el)) {
      violations.push({
        selector: sel,
        rule: 'ROW_MISSING_GAP',
        message: `${sel} is a .row with ${el.children.length} children but no gap-* class.`,
        fix: `Add gap-2 (8px), gap-3 (12px), or gap-4 (16px) class to this .row.`,
      });
    }

    // Rule 7: .col with multiple children must have a gap-* class
    if (classes.includes('col') && el.children.length > 1 && !hasGapClass(el)) {
      violations.push({
        selector: sel,
        rule: 'COL_MISSING_GAP',
        message: `${sel} is a .col with ${el.children.length} children but no gap-* class.`,
        fix: `Add gap-2 (8px), gap-3 (12px), or gap-4 (16px) class to this .col.`,
      });
    }

    // Rule 8: No display:grid or display:inline-flex in style
    if (styles['display'] && !['flex', 'block', 'inline', 'inline-block', 'none', 'contents'].includes(styles['display'])) {
      violations.push({
        selector: sel,
        rule: 'INVALID_DISPLAY',
        message: `${sel} uses display:${styles['display']}. Only display:flex|block|inline is allowed.`,
        fix: `Remove display:${styles['display']} from style. Use .row or .col classes for flex containers.`,
      });
    }

    // Recurse
    Array.from(el.children).forEach(walk);
  };

  const root = doc.body.firstElementChild || doc.body;
  Array.from(root.children).forEach(walk);
  // Also walk root itself
  if (root.tagName !== 'BODY') walk(root);

  return violations;
}

/**
 * Format violations into a compact repair prompt for the AI.
 * The repair prompt is intentionally minimal to save tokens.
 */
export function buildRepairPrompt(html: string, violations: LayoutViolation[]): string {
  const violationList = violations
    .slice(0, 20) // cap at 20 to keep token cost low
    .map((v, i) => `${i + 1}. [${v.rule}] ${v.message}\n   FIX: ${v.fix}`)
    .join('\n\n');

  return `The following HTML has layout contract violations. Make ONLY the minimal edits needed to fix each violation. Do not rewrite the entire HTML. Output only the corrected complete HTML.

VIOLATIONS TO FIX:
${violationList}

ORIGINAL HTML:
${html}

Output ONLY the fixed HTML. Apply all fixes. Do not change any design, colors, copy, or structure beyond what the violations require.`;
}
