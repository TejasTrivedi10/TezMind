/**
 * Completeness, fence stripping, tag-depth detection, and continuation joining
 */

const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);

export function stripFences(s: string): string {
  return s.replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

/** >0 means unclosed tags, -1 means cut mid-tag. 0 = structurally complete. */
export function openTagDepth(html: string): number {
  if (/<[^>]*$/.test(html)) return -1; // ends inside an unclosed tag

  const re = /<\/?([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g;
  let depth = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    const [full, tag, selfClose] = m;
    if (VOID.has(tag.toLowerCase()) || selfClose === '/') continue;
    depth += full.startsWith('</') ? -1 : 1;
  }

  return depth;
}

/** Remove duplicated overlap when a continuation repeats the tail of what we already have. */
export function joinContinuation(prev: string, next: string): string {
  const max = Math.min(300, prev.length, next.length);
  for (let n = max; n >= 20; n--) {
    if (prev.endsWith(next.slice(0, n))) {
      return prev + next.slice(n);
    }
  }
  return prev + next;
}
