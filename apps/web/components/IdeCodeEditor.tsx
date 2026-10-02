/**
 * IdeCodeEditor — Powered by Monaco Editor (VS Code engine)
 *
 * Monaco is loaded via the official CDN (cdn.jsdelivr.net/npm/monaco-editor)
 * inside a sandboxed iframe so it works on Expo Web / React Native Web
 * without any Metro bundler changes or native module issues.
 *
 * Communication between React and Monaco uses postMessage:
 *   parent → iframe : { type: 'set-value', value: string }
 *   parent → iframe : { type: 'set-language', language: string }
 *   parent → iframe : { type: 'format' }
 *   iframe → parent : { type: 'ready' }
 *   iframe → parent : { type: 'change', value: string }
 */

import React, { useEffect, useRef, useCallback } from 'react';

export interface IdeCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: 'html' | 'css' | 'javascript' | 'typescript';
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light' | 'hc-black';
  style?: React.CSSProperties;
}

// ─── Build the iframe HTML ────────────────────────────────────────────────────
// The initial value is NOT baked into the HTML — it is sent via postMessage
// after Monaco signals 'ready', so any HTML content is safe.

const MONACO_VERSION = '0.52.0';
const MONACO_CDN = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

function buildMonacoHtml(language: string, theme: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monaco</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #monaco-container {
    width: 100%; height: 100%; overflow: hidden;
    background: #1e1e1e;
  }
  /* Monaco loader overlay */
  #loader {
    position: fixed; inset: 0; display: flex;
    align-items: center; justify-content: center;
    background: #1e1e1e; z-index: 99;
    flex-direction: column; gap: 12px;
  }
  #loader-text {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px; color: #858585;
    letter-spacing: 0.03em;
  }
  .loader-bar {
    width: 160px; height: 2px;
    background: #2d2d2d; border-radius: 1px; overflow: hidden;
  }
  .loader-bar-fill {
    height: 100%; width: 0%;
    background: linear-gradient(90deg, #0078d4, #29b6f6);
    border-radius: 1px;
    animation: load 1.8s ease-in-out infinite;
  }
  @keyframes load {
    0%   { width: 0%;   transform: translateX(0%); }
    50%  { width: 60%;  }
    100% { width: 0%;   transform: translateX(260px); }
  }
</style>
</head>
<body>
<!-- Loading overlay -->
<div id="loader">
  <div id="loader-text">Loading Monaco Editor…</div>
  <div class="loader-bar"><div class="loader-bar-fill"></div></div>
</div>

<div id="monaco-container"></div>

<script>
// ── Config ──────────────────────────────────────────────────────────────────
var LANG  = '${language}';
var THEME = '${theme}';
var pendingValue = null;
var editor = null;
var ignoreNextChange = false;

// ── Load Monaco from CDN ────────────────────────────────────────────────────
var loaderScript = document.createElement('script');
loaderScript.src = '${MONACO_CDN}/vs/loader.js';
loaderScript.onload = function () {
  require.config({
    paths: { vs: '${MONACO_CDN}/vs' }
  });
  require(['vs/editor/editor.main'], function () {
    initMonaco();
  });
};
loaderScript.onerror = function () {
  document.getElementById('loader-text').textContent = 'Failed to load Monaco. Check internet connection.';
};
document.head.appendChild(loaderScript);

function initMonaco() {
  // Remove loader
  var loader = document.getElementById('loader');
  if (loader) loader.remove();

  // Extra HTML language config — auto-close tags
  monaco.languages.html.htmlDefaults.setOptions({
    format: {
      tabSize: 2,
      insertSpaces: true,
      wrapLineLength: 120,
      unformatted: 'wbr',
      contentUnformatted: 'pre,code,textarea',
      indentInnerHtml: true,
      preserveNewLines: true,
      endWithNewline: false,
      extraLiners: 'head, body, /html',
      wrapAttributes: 'auto',
    },
    suggest: { html5: true },
  });

  editor = monaco.editor.create(document.getElementById('monaco-container'), {
    value: pendingValue || '',
    language: LANG,
    theme: THEME,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
    fontLigatures: true,
    lineHeight: 22,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    minimap: { enabled: true, renderCharacters: false, scale: 1 },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'gutter',
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    formatOnPaste: true,
    formatOnType: false,
    autoIndent: 'full',
    folding: true,
    foldingHighlight: true,
    showFoldingControls: 'always',
    colorDecorators: true,
    suggest: {
      showKeywords: true,
      showSnippets: true,
      preview: true,
    },
    quickSuggestions: { other: true, comments: false, strings: true },
    parameterHints: { enabled: true },
    hover: { enabled: true, delay: 300 },
    links: true,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    overviewRulerLanes: 2,
    padding: { top: 8, bottom: 8 },
    renderWhitespace: 'selection',
    accessibilitySupport: 'off',
    fixedOverflowWidgets: true,
    automaticLayout: true,
  });

  pendingValue = null;

  // Listen for content changes → notify parent
  editor.onDidChangeModelContent(function () {
    if (ignoreNextChange) { ignoreNextChange = false; return; }
    window.parent.postMessage({ type: 'change', value: editor.getValue() }, '*');
  });

  // Ready!
  window.parent.postMessage({ type: 'ready' }, '*');
}

// ── Messages from parent ────────────────────────────────────────────────────
window.addEventListener('message', function (e) {
  if (!e.data) return;

  switch (e.data.type) {
    case 'set-value':
      if (!editor) {
        pendingValue = e.data.value;
      } else if (editor.getValue() !== e.data.value) {
        ignoreNextChange = true;
        editor.setValue(e.data.value);
      }
      break;

    case 'set-language':
      if (editor) {
        monaco.editor.setModelLanguage(editor.getModel(), e.data.language);
      }
      break;

    case 'format':
      if (editor) {
        editor.getAction('editor.action.formatDocument').run();
      }
      break;

    case 'set-theme':
      if (e.data.theme) monaco.editor.setTheme(e.data.theme);
      break;
  }
});
</script>
</body>
</html>`;
}

// ─── React Component ──────────────────────────────────────────────────────────

export function IdeCodeEditor({
  value,
  onChange,
  language = 'html',
  readOnly = false,
  theme = 'vs-dark',
  style,
}: IdeCodeEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isReadyRef = useRef(false);
  const pendingValueRef = useRef<string | null>(null);
  // Track the last value we received FROM the editor (to avoid echo)
  const editorValueRef = useRef(value);

  // Build static HTML once per language/theme combo
  const srcDoc = useCallback(
    () => buildMonacoHtml(language, theme),
    [language, theme]
  )();

  // ── Listen for messages from the Monaco iframe ──────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!iframeRef.current) return;
      if (e.source !== iframeRef.current.contentWindow) return;

      if (e.data?.type === 'ready') {
        isReadyRef.current = true;
        // Push the current value (or any buffered pending value) into Monaco
        const toSend = pendingValueRef.current ?? editorValueRef.current;
        iframeRef.current.contentWindow?.postMessage(
          { type: 'set-value', value: toSend },
          '*'
        );
        pendingValueRef.current = null;
      } else if (e.data?.type === 'change') {
        editorValueRef.current = e.data.value;
        onChange?.(e.data.value);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onChange]);

  // ── Push external value changes into Monaco ─────────────────────────────
  useEffect(() => {
    // Skip if the change originated from the editor itself
    if (value === editorValueRef.current) return;
    editorValueRef.current = value;

    if (!isReadyRef.current || !iframeRef.current?.contentWindow) {
      pendingValueRef.current = value;
      return;
    }

    iframeRef.current.contentWindow.postMessage({ type: 'set-value', value }, '*');
  }, [value]);

  // ── When iframe reloads (language/theme change) reset ready state ───────
  const handleLoad = () => {
    isReadyRef.current = false;
  };

  return (
    <iframe
      ref={iframeRef}
      title="TezMind Monaco Code Editor"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
      onLoad={handleLoad}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#1e1e1e',
        display: 'block',
        ...style,
      }}
    />
  );
}
