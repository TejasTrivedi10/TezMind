/**
 * Local CORS proxy — apps/proxy/server/proxy.mjs
 *
 * Binds to 127.0.0.1 ONLY (never externally accessible).
 * Forwards requests to an allowlist of AI provider hosts.
 * Adds CORS headers for the local app origin (http://localhost:8081).
 * Injects the per-request token from the X-Tezmind-Token header.
 * NEVER logs or stores tokens.
 *
 * Run: node server/proxy.mjs
 * Or via npm: npm run start (from apps/proxy)
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3333;
const BIND_ADDRESS = '127.0.0.1';
const ALLOWED_ORIGINS = ['http://localhost:8081', 'http://localhost:4173', 'http://127.0.0.1:8081'];

// Allowlist of provider hosts this proxy will forward to.
// Add the user's custom base URL dynamically via X-Tezmind-Target header.
const ALLOWED_HOSTS = new Set([
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'openrouter.ai',
  'api.figma.com',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access,X-Tezmind-Token,X-Tezmind-Target',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': allowed };
}

function isAllowedHost(hostname) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  // Allow subdomains of allowed hosts
  for (const host of ALLOWED_HOSTS) {
    if (hostname.endsWith('.' + host)) return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  const origin = req.headers['origin'] || ALLOWED_ORIGINS[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  // Determine target URL
  const targetHeader = req.headers['x-tezmind-target'];
  if (!targetHeader || typeof targetHeader !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: 'Missing X-Tezmind-Target header' }));
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(targetHeader);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: 'Invalid X-Tezmind-Target URL' }));
    return;
  }

  if (!isAllowedHost(targetUrl.hostname)) {
    res.writeHead(403, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(JSON.stringify({ error: `Host "${targetUrl.hostname}" is not in the allowlist.` }));
    return;
  }

  // Build forwarded headers (strip proxy-specific headers, inject token)
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders['host'];
  delete forwardHeaders['x-tezmind-target'];

  // Token injection: if X-Tezmind-Token is present, use it as the Authorization header
  const token = forwardHeaders['x-tezmind-token'];
  if (token) {
    delete forwardHeaders['x-tezmind-token'];
    // Don't override if Authorization already set
    if (!forwardHeaders['authorization']) {
      forwardHeaders['authorization'] = `Bearer ${token}`;
    }
  }

  const proxyReq = https.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...forwardHeaders, host: targetUrl.hostname },
    },
    (proxyRes) => {
      const headers = {
        ...corsHeaders(origin),
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      };
      // Forward cache-control and transfer-encoding for SSE
      if (proxyRes.headers['transfer-encoding']) {
        headers['transfer-encoding'] = proxyRes.headers['transfer-encoding'];
      }
      if (proxyRes.headers['cache-control']) {
        headers['cache-control'] = proxyRes.headers['cache-control'];
      }
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, BIND_ADDRESS, () => {
  console.warn(`[TezMind Proxy] Listening on http://${BIND_ADDRESS}:${PORT}`);
  console.warn('[TezMind Proxy] Allowed hosts:', [...ALLOWED_HOSTS].join(', '));
  console.warn('[TezMind Proxy] This proxy runs on localhost ONLY and is not externally accessible.');
});

server.on('error', (err) => {
  console.error('[TezMind Proxy] Server error:', err.message);
  process.exit(1);
});
