import React, { useEffect, useRef } from 'react';
import { RESET_STYLESHEET, generateTokenCssVariables } from '@tezmind/core';
import type { DesignTokens } from '@tezmind/core';

export interface HtmlPreviewProps {
  html: string;
  tokens?: DesignTokens;
  brandColor?: string;
  width?: number;
  height?: number;
  isStreaming?: boolean;
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

export function HtmlPreview({
  html,
  tokens,
  brandColor,
  width = 393,
  height = 852,
  isStreaming = false,
  onSelectNode,
  selectedNodeId,
}: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const tokenCss = generateTokenCssVariables(tokens, brandColor);
    const fullCss = `${RESET_STYLESHEET}\n${tokenCss}`;

    // Initialize document content if needed
    if (!doc.head || !doc.body || doc.head.children.length === 0) {
      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style id="tz-preview-style">${fullCss}</style>
</head>
<body style="margin:0;padding:0;overflow:auto;background:var(--background,#0F172A);">
  <div id="tz-root-container"></div>
</body>
</html>`);
      doc.close();
    } else {
      const styleEl = doc.getElementById('tz-preview-style');
      if (styleEl) styleEl.textContent = fullCss;
    }

    const container = doc.getElementById('tz-root-container') || doc.body;

    // Update body content
    if (html && html.trim()) {
      container.innerHTML = html;
    } else {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--textMuted,#94A3B8);font-family:sans-serif;font-size:14px;">
        ${isStreaming ? 'Streaming design live…' : 'Canvas empty'}
      </div>`;
    }

    // Update selected attribute
    const prevSelected = doc.querySelectorAll('[data-selected]');
    prevSelected.forEach((el) => el.removeAttribute('data-selected'));

    if (selectedNodeId) {
      const selectedEl = doc.querySelector(`[data-tz-id="${selectedNodeId}"]`);
      if (selectedEl) selectedEl.setAttribute('data-selected', 'true');
    }

    // Handle click selection
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tzEl = target.closest('[data-tz-id]') as HTMLElement | null;
      if (tzEl) {
        const id = tzEl.getAttribute('data-tz-id');
        if (id && onSelectNode) {
          onSelectNode(id);
        }
      }
    };

    doc.addEventListener('click', handleClick);

    // Auto-scroll if streaming and user has not manually scrolled away
    if (isStreaming && !userScrolledRef.current && doc.body) {
      window.requestAnimationFrame(() => {
        doc.documentElement.scrollTop = doc.documentElement.scrollHeight;
      });
    }

    return () => {
      doc.removeEventListener('click', handleClick);
    };
  }, [html, tokens, brandColor, isStreaming, selectedNodeId, onSelectNode]);

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
        border: '1px solid #334155',
        background: '#0F172A',
        position: 'relative',
      }}
    >
      <iframe
        ref={iframeRef}
        title="TezMind HTML Live Preview"
        sandbox="allow-same-origin"
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
