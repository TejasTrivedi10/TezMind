/**
 * WebHttpBridge — browser fetch implementation of HttpBridge for @tezmind/core.
 * Supports standard HTTP requests and streaming SSE responses.
 *
 * For streaming requests, error status codes are returned as a standard
 * HttpResponse (non-iterable) so that callers can handle HTTP errors correctly
 * before attempting to read the stream.
 */

import type { HttpBridge, HttpRequest, HttpResponse } from '@tezmind/core';

export class WebHttpBridge implements HttpBridge {
  async fetch(
    req: HttpRequest,
    signal?: AbortSignal,
  ): Promise<HttpResponse | AsyncIterable<Uint8Array>> {
    const response = await fetch(req.url, {
      method: req.method || 'GET',
      headers: req.headers,
      body: req.body as BodyInit | undefined,
      signal,
    });

    // For streaming requests: if the response is NOT ok (e.g. 400, 403, 404),
    // return it as a regular HttpResponse so callers can inspect the status.
    if (req.stream && response.ok && response.body) {
      const reader = response.body.getReader();
      return {
        async *[Symbol.asyncIterator]() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) yield value;
            }
          } finally {
            reader.releaseLock();
          }
        },
      };
    }

    const bodyText = await response.text();
    const headersObj: Record<string, string> = {};
    response.headers.forEach((val: string, key: string) => {
      headersObj[key] = val;
    });

    return {
      status: response.status,
      headers: headersObj,
      body: bodyText,
    };
  }
}

let _httpInstance: WebHttpBridge | null = null;

export function getHttpBridge(): HttpBridge {
  if (!_httpInstance) {
    _httpInstance = new WebHttpBridge();
  }
  return _httpInstance;
}
