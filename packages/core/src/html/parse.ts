/**
 * DOM parsing and serialization for browser, Jest (jsdom), and Node/VS Code environments.
 */

declare const require: any;

export function parseScreen(html: string): Document {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  }
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    return new window.DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseHTML } = require('linkedom');
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  return document as unknown as Document;
}
