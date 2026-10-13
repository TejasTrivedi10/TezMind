/**
 * Repair prompt builder for LLM Layout Contract v2 repair loop
 */

import type { Violation, ExpandedBrief } from '@tezmind/core';

export function buildRepairPrompt(html: string, errs: Violation[], brief: ExpandedBrief): string {
  return `Fix ONLY the violations below in this HTML. Keep everything else byte-for-byte identical. Return the COMPLETE corrected HTML (root <div class="screen">), no markdown.

VIOLATIONS:
${errs.map((e, i) => `${i + 1}. [${e.rule}] ${e.message}${e.id ? ` (node ${e.id})` : ''} -> ${e.fix}`).join('\n')}

REMINDERS: only .row/.col containers; spacing via gap-*/p-*; footers are direct children of .screen after the single .scroll;
icons via <span class="icon" data-icon="..."> (names: ${brief.icons.join(', ')}); no margins, no inline animation, no URLs.

HTML:
${html}`;
}
