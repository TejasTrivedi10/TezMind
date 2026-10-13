/**
 * HtmlPreview — Live HTML preview component (v2)
 *
 * Renders model-generated HTML in a sandboxed iframe with:
 * - Auto-Layout CSS (resetCss + AutoLayout stylesheet)
 * - Icon hydration (inline SVG for data-icon)
 * - Avatar hydration (initials + color)
 * - Image placeholder hydration (gradient + glyph)
 * - Motion stagger hydration
 * - Streaming-safe animation lifecycle (.tz-streaming → .tz-play)
 *
 * Motion lifecycle:
 *   1. While isStreaming: root has .tz-streaming (animations disabled, content visible)
 *   2. When stream completes: .tz-streaming removed, .tz-play added → entrance plays ONCE
 *   3. Replay button: removes then re-adds .tz-play to replay animations
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { RESET_STYLESHEET, AUTO_LAYOUT_STYLESHEET, generateTokenCssVariables, hydrate } from '@tezmind/core';
import type { DesignTokens, Palette } from '@tezmind/core';
import { resolveGeneratedImages } from '../lib/imageSearch';

export interface HtmlPreviewProps {
  html: string;
  tokens?: DesignTokens;
  brandColor?: string;
  materialDesign3?: boolean;
  colorScheme?: 'light' | 'dark';
  width?: number;
  height?: number;
  isStreaming?: boolean;
  mode?: 'preview' | 'edit';
  onNavigate?: (destination: string) => void;
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  /** Called with the iframe doc when the preview is ready — for external Replay button */
  onDocReady?: (doc: Document) => void;
  /** Render flush against a device frame that owns the screen bezel. */
  flush?: boolean;
}

export function HtmlPreview({
  html,
  tokens,
  brandColor,
  materialDesign3 = false,
  colorScheme = 'light',
  width = 393,
  height = 852,
  isStreaming = false,
  mode = 'preview',
  onNavigate,
  onSelectNode,
  selectedNodeId,
  onDocReady,
  flush = false,
}: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameReadyRevision, setFrameReadyRevision] = useState(0);
  const lastHtmlRef = useRef<string>('');
  const rafRef = useRef<number | null>(null);
  const wasStreamingRef = useRef<boolean>(false);

  // Build the CSS once per token/brand change
  const getFullCss = useCallback((tokenCss: string) => {
    const containerCss = `
#tz-root-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden !important;
}
*, *::before, *::after { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
.screen {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  overflow: hidden;
}`;
    const materialCss = materialDesign3 ? `
md-filled-button, md-filled-tonal-button, md-outlined-button, md-text-button, md-icon-button { max-width: 100%; flex: 0 0 auto; }
[data-m3-control][data-tz-id]:is(md-filled-button, md-filled-tonal-button, md-outlined-button, md-text-button, md-icon-button) { display: inline-flex; flex-direction: row; align-items: center; justify-content: center; }
[data-m3-control][data-tz-id]:is(.nav-item, [role="tab"]) { display: flex; flex: 1 1 0; flex-direction: column; align-items: center; justify-content: center; min-width: 0; min-height: 48px; max-width: 100%; padding: 6px 2px; text-align: center; white-space: normal; }
[data-m3-control][data-tz-id]:is(md-outlined-text-field, md-filled-text-field, md-checkbox, md-radio, md-switch) { display: inline-flex; flex-direction: row; align-items: center; }
md-outlined-text-field, md-filled-text-field { display: block; max-width: 100%; min-width: 0; }
md-outlined-text-field.fill, md-filled-text-field.fill { flex: 1 1 0; width: 100%; }
` : '';
    return `${RESET_STYLESHEET}\n${AUTO_LAYOUT_STYLESHEET}\n${containerCss}\n${materialCss}\n${tokenCss}`;
  }, [materialDesign3]);

  // Initialize the iframe document (called once)
  const initDoc = useCallback(
    (doc: Document, tokenCss: string) => {
      const fullCss = getFullCss(tokenCss);
      doc.open();
      doc.write(`<!DOCTYPE html>
<html style="width:100%;height:100%;margin:0;padding:0;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style id="tz-preview-style">${fullCss}</style>
  ${materialDesign3 ? '<script src="/material3.js"></script>' : ''}
</head>
<body style="margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:var(--background,#FFFFFF);">
  <div id="tz-root-container"></div>
</body>
</html>`);
      doc.close();
    },
    [getFullCss, materialDesign3],
  );

  // Apply hydration + motion classes after DOM update
  const hydrateAndAnimate = useCallback(
    (container: HTMLElement, doc: Document, streaming: boolean, becameComplete: boolean) => {
      const palette: Palette = {
        primary: brandColor || '#6C5CE7',
  background: tokens?.colors?.background || (colorScheme === 'light' ? '#FFFFFF' : '#0F172A'),
  surface: tokens?.colors?.surface || (colorScheme === 'light' ? '#F7F7F8' : '#1E293B'),
  text: tokens?.colors?.text || (colorScheme === 'light' ? '#202123' : '#F8FAFC'),
  border: tokens?.colors?.border || (colorScheme === 'light' ? '#E5E7EB' : '#334155'),
      };

      // Hydrate icons, avatars, images, stagger
      hydrate(container, { palette, materialDesign3 });

      // Motion lifecycle
      const screen = container.querySelector('.screen') as HTMLElement | null;
      const root = screen ?? container;

      if (streaming) {
        // While streaming: disable animations, keep content visible
        root.classList.add('tz-streaming');
        root.classList.remove('tz-play');
      } else if (becameComplete) {
        // Stream just finished: play entrance sequence once
        root.classList.remove('tz-streaming');
        // Force reflow so CSS transitions pick up the class addition
        void root.offsetHeight;
        root.classList.add('tz-play');
      }
    },
    [brandColor, tokens, materialDesign3, colorScheme],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const tokenCss = generateTokenCssVariables(tokens, brandColor, materialDesign3, colorScheme);

    // Initialize document if needed
    if (!doc.head || !doc.body || !doc.getElementById('tz-root-container')) {
      initDoc(doc, tokenCss);
    } else {
      // Just update styles
      const styleEl = doc.getElementById('tz-preview-style');
      if (styleEl) styleEl.textContent = getFullCss(tokenCss);
    }

    const container = ensurePreviewContainer(doc);
    if (!container || iframeRef.current?.contentDocument !== doc) return;

    // Track streaming state transition
    const wasStreaming = wasStreamingRef.current;
    const becameComplete = wasStreaming && !isStreaming;
    wasStreamingRef.current = isStreaming;

    // Update HTML content if changed
    const htmlChanged = html !== lastHtmlRef.current;
    if (htmlChanged) {
      lastHtmlRef.current = html;
      if (html && html.trim()) {
        container.innerHTML = html;
      } else {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--textMuted,#94A3B8);font-family:var(--font-sans,sans-serif);font-size:14px;text-align:center;padding:24px;">
          ${isStreaming ? 'Designing your screen…' : 'Canvas empty — enter a prompt to generate'}
        </div>`;
      }
    }

    // Update selected element
    doc.querySelectorAll('[data-selected]').forEach((el) => el.removeAttribute('data-selected'));
    if (selectedNodeId) {
      const selectedEl = doc.querySelector(`[data-tz-id="${selectedNodeId}"]`);
      if (selectedEl) selectedEl.setAttribute('data-selected', 'true');
    }

    // Hydrate + animate (RAF for performance)
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (iframeRef.current?.contentDocument !== doc || !container.isConnected) return;
      hydrateAndAnimate(container, doc, isStreaming, becameComplete || (!isStreaming && htmlChanged && !wasStreaming));
      if (!isStreaming && htmlChanged) void resolveGeneratedImages(container);
      onDocReady?.(doc);
    });

    // Preview mode runs lightweight prototype interactions; edit mode selects components.
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (mode === 'edit') {
        const selected = target.closest<HTMLElement>('[data-tz-id]');
        const id = selected?.getAttribute('data-tz-id');
        if (id) {
          e.preventDefault();
          onSelectNode?.(id);
        }
        return;
      }
      const control = target.closest<HTMLElement>('button,a,md-filled-button,md-filled-tonal-button,md-outlined-button,md-text-button,md-icon-button,[role="button"],[role="tab"],[data-press],input[type="checkbox"],input[type="radio"],md-checkbox,md-switch,md-radio');
      if (!control) return;
      if (control.matches('md-checkbox,md-switch,md-radio')) {
        control.dispatchEvent(new CustomEvent('tezmind:preview-action', { bubbles: true, detail: { label: control.getAttribute('aria-label') || control.textContent?.trim() } }));
        return;
      }
      if (control.hasAttribute('data-img-credit')) {
        const href = control.getAttribute('href');
        if (href?.startsWith('https://')) doc.defaultView?.open(href, '_blank', 'noopener,noreferrer');
        e.preventDefault();
        return;
      }
      e.preventDefault();

      const navItem = control.closest<HTMLElement>('[data-role="bottom-nav"] .nav-item, nav .nav-item, [role="tab"]');
      if (navItem) {
        const nav = navItem.closest('[data-role="bottom-nav"], nav, [role="tablist"]');
        nav?.querySelectorAll('.nav-item,[role="tab"]').forEach((item) => {
          item.removeAttribute('data-active');
          item.removeAttribute('aria-current');
          item.classList.remove('active');
        });
        navItem.setAttribute('data-active', 'true');
        navItem.setAttribute('aria-current', 'page');
        navItem.classList.add('active');
        const destination = navItem.getAttribute('data-screen-target')
          || navItem.getAttribute('data-route')
          || navItem.getAttribute('data-target')
          || navItem.getAttribute('aria-label')
          || navItem.textContent?.trim();
        if (destination) onNavigate?.(destination);
        return;
      }

      const href = control.getAttribute('href');
      const route = control.getAttribute('data-screen-target') || control.getAttribute('data-route');
      if (route) onNavigate?.(route);
      else if (href?.startsWith('#')) {
        const destination = doc.getElementById(href.slice(1));
        destination?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      const targetSelector = control.getAttribute('aria-controls') || control.getAttribute('data-popup-target') || control.getAttribute('data-toggle-target');
      if (targetSelector) {
        let destination: Element | null = doc.getElementById(targetSelector.replace(/^#/, ''));
        if (!destination) {
          try { destination = doc.querySelector(targetSelector); } catch { /* Ignore malformed generated selectors. */ }
        }
        if (destination) {
          const expanded = control.getAttribute('aria-expanded') === 'true';
          (destination as HTMLElement).hidden = expanded;
          control.setAttribute('aria-expanded', String(!expanded));
        }
      }

      if (control.hasAttribute('aria-pressed')) {
        control.setAttribute('aria-pressed', String(control.getAttribute('aria-pressed') !== 'true'));
      }
      if (control.getAttribute('role') === 'switch') {
        const checked = control.getAttribute('aria-checked') !== 'true';
        control.setAttribute('aria-checked', String(checked));
        control.setAttribute('data-checked', String(checked));
      }
      control.dispatchEvent(new CustomEvent('tezmind:preview-action', { bubbles: true, detail: { label: control.getAttribute('aria-label') || control.textContent?.trim() } }));
    };

    doc.addEventListener('click', handleClick);
    return () => {
      doc.removeEventListener('click', handleClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [html, tokens, brandColor, materialDesign3, colorScheme, isStreaming, mode, selectedNodeId, onNavigate, onSelectNode, onDocReady, initDoc, getFullCss, hydrateAndAnimate, frameReadyRevision]);

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: flush ? 0 : '16px',
        overflow: 'hidden',
        boxShadow: flush ? 'none' : '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
        border: flush ? 'none' : '1px solid #334155',
        background: '#FFFFFF',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <iframe
        ref={iframeRef}
        title="TezMind HTML Live Preview"
        src="about:blank"
        onLoad={() => setFrameReadyRevision((revision) => revision + 1)}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
        }}
      />
    </div>
  );
}

function ensurePreviewContainer(doc: Document): HTMLElement | null {
  let html = doc.documentElement;
  if (!html) {
    html = doc.createElement('html');
    doc.appendChild(html);
  }
  if (!doc.head) {
    const head = doc.createElement('head');
    html.insertBefore(head, html.firstChild);
  }
  let body = doc.body;
  if (!body) {
    body = doc.createElement('body');
    html.appendChild(body);
  }
  let container = doc.getElementById('tz-root-container') as HTMLElement | null;
  if (!container) {
    container = doc.createElement('div');
    container.id = 'tz-root-container';
    body.appendChild(container);
  }
  return container;
}

/**
 * Replay animations in an iframe document.
 * Removes then re-adds .tz-play with a forced reflow in between.
 */
export function replayMotion(doc: Document): void {
  const container = doc.getElementById('tz-root-container') || doc.body;
  const screen = container.querySelector('.screen') as HTMLElement | null;
  const root = screen ?? container;

  root.classList.remove('tz-play');
  void root.offsetHeight; // force reflow
  root.classList.add('tz-play');
}
