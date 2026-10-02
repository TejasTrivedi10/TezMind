# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.x (pre-release) | ✅ |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Send a private report to: security@[maintainer-email] (or use GitHub's private vulnerability reporting feature).

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We will acknowledge receipt within 72 hours and aim to resolve within 14 days.

## Security Model

TezMind is a local-first application with no backend server.

**API Keys:**
- Stored encrypted with WebCrypto AES-GCM in browser localStorage
- Never transmitted to any server other than the chosen AI provider
- Never included in project exports, crash reports, or URLs
- Redacted in all error messages

**AI Output:**
- All AI responses are parsed as JSON — never `eval`'d
- Image URLs from AI output must be `https://` or `data:` URIs only
- `javascript:` and `file:` URLs are rejected
- Node count and tree depth are limited (400 nodes, 12 depth)

**Local Proxy:**
- Binds to `127.0.0.1` only — never accessible externally
- Forwards only to an allowlist of known provider hosts
- Does not log or store tokens

**Scope:**
- This application runs on localhost. It is not a web service.
- XSS is less of a concern but all untrusted data is still treated as untrusted.
