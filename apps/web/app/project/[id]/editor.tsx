/**
 * Editor Screen — Main design canvas & interactive prompt bar (v2)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, Image, ScrollView, Platform } from 'react-native';
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Clock3, Code, Copy, History as HistoryIcon, Image as ImageIcon, ImagePlus, LockKeyhole, Plus, Redo2, RefreshCw, RotateCcw, Settings, SkipForward, Smartphone, Sparkles, Undo2, UserRound, X, Zap } from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, typography, spacing, radii } from '../../../design/tokens';
import { useProjectStore } from '../../../store/useProjectStore';
import { getDatabase, type ScreenAssetRow } from '../../../host/database';
import { getSecretStorage } from '../../../host/secrets';
import { getHttpBridge } from '../../../host/http';
import {
  GoogleProvider,
  AnthropicProvider,
  FALLBACK_MODELS,
  expand,
  generateFromBrief,
  renderGeneratorPrompt,
  type GenerateRequest,
  type ModelInfo,
  type PipelineEvent,
  type PipelineReport,
  type PipelineDeps,
  type LlmJson,
  getUiKitContext,
  resolveUiKit,
  resolveUiKitAccent,
} from '@tezmind/ai';
import type { ProjectMeta, ScreenRecord, ExpandedBrief, ExpandInput, Violation, Role, HistoryEntry, ScreenActionRecord } from '@tezmind/core';
import { dslToHtml, htmlToDsl, autofix, lint, ROLE_DESC, analyze, nanoid } from '@tezmind/core';
import { HtmlPreview, replayMotion } from '../../../components/HtmlPreview';
import { IdeCodeEditor } from '../../../components/IdeCodeEditor';
import { resolveGeneratedImagesInHtml } from '../../../lib/imageSearch';

type CodeFileTab = 'html' | 'css' | 'js';

type ProviderKey = 'google' | 'anthropic';

interface ModelOption {
  id: string;
  name: string;
  provider: ProviderKey;
}

/** Static fallback used before dynamic load completes */
const STATIC_FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
];

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProject, loadProjects, updateProject } = useProjectStore();
  const [project, setProject] = useState<ProjectMeta | undefined>(undefined);
  const [screensList, setScreensList] = useState<ScreenRecord[]>([]);
  const [screen, setScreen] = useState<ScreenRecord | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic model list
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(STATIC_FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Streaming HTML & selection & live code editor
  const [streamingHtml, setStreamingHtml] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeName, setSelectedNodeName] = useState<string>('');
  const [selectedEditComment, setSelectedEditComment] = useState<string>('');
  const [statusBarColor, setStatusBarColor] = useState('#FFFFFF');
  const [homeIndicatorBackground, setHomeIndicatorBackground] = useState('#FFFFFF');
  const [statusBarTextColor, setStatusBarTextColor] = useState('#202123');
  const targetedEditRef = useRef<{ id: string; name: string; markup: string; parentContext: string; screenHtml: string; path: number[] } | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [screenActions, setScreenActions] = useState<ScreenActionRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const autoStartPromptRef = useRef(new Set<string>());
  const [codeEditorHtml, setCodeEditorHtml] = useState<string>('');
  const [copiedCodeNotice, setCopiedCodeNotice] = useState<boolean>(false);

  // Multi-file code editor (HTML | CSS | JS)
  const [activeCodeFile, setActiveCodeFile] = useState<CodeFileTab>('html');
  const [cssContent, setCssContent] = useState<string>('/* Screen styles */\n\nbody {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n}\n');
  const [jsContent, setJsContent] = useState<string>('// Screen scripts\n\nconsole.log(\'TezMind screen loaded\');\n');

  // Initial prompt & reference image
  const [promptInput, setPromptInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingKeyProvider, setMissingKeyProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'screen' | 'code' | 'layers'>('screen');
  const [screenMode, setScreenMode] = useState<'preview' | 'edit'>('preview');
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(STATIC_FALLBACK_MODELS[0]);

  // Token usage tracking
  const [tokenUsage, setTokenUsage] = useState<{ inputTokens: number; outputTokens: number; cost?: number } | null>(null);

  // Layout lint diagnostics
  const [lintViolationCount, setLintViolationCount] = useState<number | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  // Phase state machine: idle → expanding → reviewing → streaming → recovering → fixing → repairing → done | error
  type Phase = 'idle' | 'expanding' | 'reviewing' | 'streaming' | 'recovering' | 'fixing' | 'repairing' | 'done' | 'error';
  const [phase, setPhase] = useState<Phase>('idle');
  const [expandedBrief, setExpandedBrief] = useState<ExpandedBrief | null>(null);
  const [briefEdits, setBriefEdits] = useState<string>(''); // editable refinedPrompt
  const [pipelineReport, setPipelineReport] = useState<PipelineReport | null>(null);
  const [reviewBriefEnabled, setReviewBriefEnabled] = useState<boolean>(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState<boolean>(true);
  const [promptInputHeight, setPromptInputHeight] = useState(42);

  // Preview replay reference
  const previewDocRef = useRef<Document | null>(null);

  const handlePreviewDocReady = useCallback((doc: Document) => {
    previewDocRef.current = doc;
    const root = doc.querySelector('.screen') as HTMLElement | null;
    if (!root || !doc.defaultView) return;
    const rootStyle = doc.defaultView.getComputedStyle(root);
    const rootBackground = rootStyle.backgroundColor && rootStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? rootStyle.backgroundColor
      : rootStyle.getPropertyValue('--background').trim() || '#FFFFFF';
    const header = root.querySelector<HTMLElement>(':scope > header, :scope > [data-role="app-bar"]')
      || root.querySelector<HTMLElement>('header,[data-role="app-bar"]');
    let headerBackground = rootBackground;
    for (let node: HTMLElement | null = header; node && root.contains(node); node = node.parentElement) {
      const color = doc.defaultView.getComputedStyle(node).backgroundColor;
      const transparent = !color || color === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/i.test(color);
      if (!transparent) {
        headerBackground = color;
        break;
      }
    }
    const background = headerBackground;
    let channels = background.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) {
      const hex = background.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i)?.[1];
      if (hex) {
        const fullHex = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
        channels = [0, 2, 4].map((index) => parseInt(fullHex.slice(index, index + 2), 16));
      }
    }
    const luminance = channels?.length === 3
      ? (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255
      : 1;
    const foreground = luminance > 0.58 ? '#202123' : '#FFFFFF';
    setStatusBarColor((current) => current === background ? current : background);
    setHomeIndicatorBackground((current) => current === rootBackground ? current : rootBackground);
    setStatusBarTextColor((current) => current === foreground ? current : foreground);
  }, []);

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    const node = previewDocRef.current
      ? Array.from(previewDocRef.current.querySelectorAll<HTMLElement>('[data-tz-id]')).find((el) => el.getAttribute('data-tz-id') === nodeId)
      : undefined;
    const name = node?.getAttribute('data-tz-name') || node?.getAttribute('data-role') || 'Selected component';
    setSelectedNodeName(name.replace(/[-_]/g, ' '));
    setSelectedEditComment('');
  }, []);

  const handlePreviewNavigate = useCallback((destination: string) => {
    const key = destination.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key) return;
    const match = screensList.find((item) =>
      item.id === destination || item.name.toLowerCase().replace(/[^a-z0-9]/g, '') === key
    );
    if (match) {
      setScreen(match);
      setSelectedNodeId(null);
    }
  }, [screensList]);

  /** Load models dynamically from the provider API */
  const loadModels = useCallback(async (providerId: ProviderKey, token: string) => {
    setModelsLoading(true);
    try {
      const http = getHttpBridge();
      const provider = providerId === 'google' ? new GoogleProvider() : new AnthropicProvider();
      const fetched: ModelInfo[] = await provider.listModels(token, http);
      if (fetched.length > 0) {
        const opts: ModelOption[] = fetched.map((m) => ({
          id: m.id,
          name: m.name,
          provider: providerId,
        }));
        setAvailableModels(opts);
        // Auto-select first model if current selection isn't in the new list
        setSelectedModel((prev) => {
          const stillValid = opts.find((o) => o.id === prev.id);
          return stillValid ?? opts[0];
        });
      }
    } catch (e) {
      // Keep fallback models on error
      console.warn('[TezMind] loadModels failed:', e);
      const fallback = (FALLBACK_MODELS[providerId] ?? []).map((m): ModelOption => ({
        id: m.id,
        name: m.name,
        provider: providerId,
      }));
      if (fallback.length > 0) setAvailableModels(fallback);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadProjects();
      const p = getProject(id);
      setProject(p);

      if (p) {
        const db = getDatabase();
        // Load screens
        const savedScreens = await db.screens.where('projectId').equals(p.id).toArray();
        const screens: ScreenRecord[] = [];
        for (let index = 0; index < savedScreens.length; index += 1) {
          const saved = savedScreens[index];
          if (/^screen\s+\d+$/i.test(saved.name)) {
            const asset = await db.screenAssets.get(`${saved.id}::index.html`);
            const suggested = asset?.content
              ? inferScreenName(asset.content, index === 0 ? p.name : 'New screen')
              : (index === 0 ? p.name : `Untitled ${index + 1}`);
            const renamed = { ...saved, name: suggested, updatedAt: Date.now() };
            await db.screens.put({ ...renamed, projectId: p.id });
            screens.push(renamed);
          } else {
            screens.push(saved);
          }
        }
        setScreensList(screens);
        if (screens.length > 0) {
          setScreen(screens[0]);
        }

        // Load saved initial prompt & image
        const promptRow = await db.settings.get(`project_${p.id}_initial_prompt`);
        if (promptRow?.value) {
          setPromptInput(promptRow.value);
        }
        const imageRow = await db.settings.get(`project_${p.id}_initial_image`);
        if (imageRow?.value) {
          setAttachedImage(imageRow.value);
        }

        // Load models from the provider API
        const secrets = getSecretStorage();
        const defaultProvider: ProviderKey = (p.defaultProvider as ProviderKey) ?? 'google';
        const token = await secrets.get(`token:${defaultProvider}`);
        if (token) {
          loadModels(defaultProvider, token);
        } else {
          const fallback = (FALLBACK_MODELS[defaultProvider] ?? []).map((m): ModelOption => ({
            id: m.id,
            name: m.name,
            provider: defaultProvider,
          }));
          if (fallback.length > 0) setAvailableModels(fallback);
        }
      }

      setIsLoading(false);
    })();
  }, [id, loadProjects, getProject, loadModels]);

  // Keep code editor HTML in sync with current active screen; also load CSS/JS assets
  useEffect(() => {
    if (!screen) return;
    (async () => {
      const db = getDatabase();
      // First try to load saved raw index.html
      const htmlRow = await db.screenAssets.get(`${screen.id}::index.html`);
      if (htmlRow?.content) {
        // Normalize legacy saved generations too, so layout safety fixes apply
        // when reopening a screen and not only after its next regeneration.
        const normalizedHtml = autofix(htmlRow.content);
        if (normalizedHtml !== htmlRow.content) {
          await db.screenAssets.put({
            ...htmlRow,
            content: normalizedHtml,
            updatedAt: Date.now(),
          });
        }
        setCodeEditorHtml(normalizedHtml);
      } else if (screen.rootJson) {
        try {
          const root = JSON.parse(screen.rootJson);
          const html = dslToHtml({
            id: screen.id,
            name: screen.name,
            width: screen.width,
            height: screen.height,
            schemaVersion: 1,
            root,
          });
          setCodeEditorHtml(html);
        } catch { /* skip */ }
      } else {
        setCodeEditorHtml('');
      }

      const historyRows = await db.history.where('screenId').equals(screen.id).toArray();
      setHistoryEntries(historyRows
        .filter((row) => row.projectId === project?.id)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 40)
        .map(({ projectId: _projectId, screenId: _screenId, ...entry }) => entry));

      const actionRows = await db.screenActions.where('screenId').equals(screen.id).toArray();
      setScreenActions(actionRows
        .filter((row) => row.projectId === project?.id)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 40));

      // Load CSS/JS assets from DB
      const cssRow = await db.screenAssets.get(`${screen.id}::styles.css`);
      if (cssRow) setCssContent(cssRow.content);
      const jsRow = await db.screenAssets.get(`${screen.id}::app.js`);
      if (jsRow) setJsContent(jsRow.content);
    })();
  }, [screen?.id, project?.id]);

  const handleAddScreen = async () => {
    if (!project) return;
    const db = getDatabase();
    const nextNum = screensList.length + 1;
    const screenName = screensList.length ? `Untitled ${nextNum}` : 'Untitled screen';
    const width = screen?.width || 393;
    const height = screen?.height || 852;

    const defaultRootNode = {
      id: 'root',
      type: 'frame',
      name: `${screenName} Root`,
      props: {},
      style: { backgroundColor: '#FFFFFF' },
      sizing: { width: { mode: 'fixed', value: width }, height: { mode: 'fixed', value: height } },
      layout: { direction: 'column', gap: 16, padding: { top: 24, right: 16, bottom: 24, left: 16 }, mainAxis: 'start', crossAxis: 'stretch' },
      children: [
        {
          id: `title_${Date.now()}`,
          type: 'text',
          name: 'Screen Title',
          props: { content: 'Your screen preview will appear here' },
          style: { fontSize: 24, fontWeight: '700', color: '#202123' },
          sizing: { width: { mode: 'hug' }, height: { mode: 'hug' } },
        },
        {
          id: `subtitle_${Date.now()}`,
          type: 'text',
          name: 'Screen Subtitle',
          props: { content: 'Describe a screen below and TezMind will design it for you.' },
          style: { fontSize: 14, fontWeight: '400', color: '#94A3B8' },
          sizing: { width: { mode: 'hug' }, height: { mode: 'hug' } },
        },
      ],
    };

    const newScreenRecord: ScreenRecord = {
      id: `screen_${Date.now()}`,
      name: screenName,
      order: nextNum,
      width,
      height,
      schemaVersion: 1,
      rootJson: JSON.stringify(defaultRootNode),
      updatedAt: Date.now(),
    };

    await db.screens.put({ ...newScreenRecord, projectId: project.id });
    setScreensList((prev) => [...prev, newScreenRecord]);
    setScreen(newScreenRecord);
  };

  const handleCodeEditorChange = async (newHtml: string) => {
    setCodeEditorHtml(newHtml);
    if (!project || !screen) return;

    const db = getDatabase();
    // Persist raw index.html asset
    await db.screenAssets.put({
      id: `${screen.id}::index.html`,
      screenId: screen.id,
      projectId: project.id,
      filename: 'index.html',
      content: newHtml,
      updatedAt: Date.now(),
    });

    const { screens } = htmlToDsl(newHtml, {
      width: screen.width,
      height: screen.height,
      projectName: project.name,
    });

    if (screens && screens.length > 0) {
      const updatedScreenRecord: ScreenRecord = {
        ...screen,
        name: inferScreenName(newHtml, screen.name),
        rootJson: JSON.stringify(screens[0].root),
        updatedAt: Date.now(),
      };
      setScreen(updatedScreenRecord);
      setScreensList((prev) => prev.map((s) => (s.id === screen.id ? updatedScreenRecord : s)));
      await db.screens.put({ ...updatedScreenRecord, projectId: project.id });
    }
  };

  const handleCssChange = async (newCss: string) => {
    setCssContent(newCss);
    if (!project || !screen) return;
    const db = getDatabase();
    const row: ScreenAssetRow = {
      id: `${screen.id}::styles.css`,
      screenId: screen.id,
      projectId: project.id,
      filename: 'styles.css',
      content: newCss,
      updatedAt: Date.now(),
    };
    await db.screenAssets.put(row);
  };

  const handleJsChange = async (newJs: string) => {
    setJsContent(newJs);
    if (!project || !screen) return;
    const db = getDatabase();
    const row: ScreenAssetRow = {
      id: `${screen.id}::app.js`,
      screenId: screen.id,
      projectId: project.id,
      filename: 'app.js',
      content: newJs,
      updatedAt: Date.now(),
    };
    await db.screenAssets.put(row);
  };

  const handleCopyCode = () => {
    const textToCopy = activeCodeFile === 'css' ? cssContent
      : activeCodeFile === 'js' ? jsContent
      : codeEditorHtml;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedCodeNotice(true);
      setTimeout(() => setCopiedCodeNotice(false), 2000);
    }
  };

  const handleFormat = () => {
    // Trigger Monaco format via the iframe postMessage
    const iframe = document.querySelector('iframe[title="TezMind Monaco Code Editor"]') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({ type: 'format' }, '*');
  };

  const handleSelectModel = async (model: ModelOption) => {
    setSelectedModel(model);
    setIsModelPickerOpen(false);
    if (project) {
      const updated = { ...project, defaultModelId: model.id, defaultProvider: model.provider };
      setProject(updated);
      await updateProject(project.id, { defaultModelId: model.id, defaultProvider: model.provider });
      const db = getDatabase();
      await db.projects.put(updated);

      // Reload models for the newly selected provider
      const secrets = getSecretStorage();
      const token = await secrets.get(`token:${model.provider}`);
      if (token) loadModels(model.provider, token);
    }
  };

  const handlePickNewImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              setAttachedImage(ev.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  const getExpandInput = (promptText: string): ExpandInput => {
    const kitId = project?.resolvedUiKitId || project?.uiKitId;
    const uiKit = getUiKitContext(kitId, promptText, project?.idea || project?.description || '');
    const kitKeywords = resolveUiKit(kitId, promptText, project?.idea || project?.description || '').keywords;
    const chosenPalette = project?.chosenPalette;
    const kitFallbackColor = chosenPalette?.colors.primary || (kitId && kitId !== 'auto'
      ? project.brandColor || uiKit.palette.primary
      : uiKit.palette.primary);
    const brand = chosenPalette?.colors.primary || (project?.materialDesign3
      ? resolvePromptAccent(promptText, uiKit.palette.primary)
      : resolveUiKitAccent(promptText, kitFallbackColor));
    const selectedUiKit = chosenPalette
      ? { ...uiKit, mode: chosenPalette.mode, palette: { ...uiKit.palette, background: chosenPalette.colors.background, surface: chosenPalette.colors.surface, text: chosenPalette.colors.text, primary: chosenPalette.colors.primary, secondary: chosenPalette.colors.secondary, accent: chosenPalette.colors.accent }, guidance: `${uiKit.guidance}\nLOCKED PROJECT PALETTE (hard constraint): ${JSON.stringify(chosenPalette.colors)}. Do not change these colors.` }
      : { ...uiKit, palette: { ...uiKit.palette, primary: brand } };
    return {
      prompt: promptText,
      project: {
      name: project?.name || 'TezMind App',
      idea: project?.idea || project?.description || '',
      brand,
      keywords: project?.uiKitId === 'auto' || !project?.uiKitId ? kitKeywords : project?.styleKeywords || kitKeywords,
      materialDesign3: project?.materialDesign3 ?? false,
      uiKit: selectedUiKit,
      },
      device: {
      w: screen?.width || 393,
      h: screen?.height || 852,
      kind: (project?.device && project.device.startsWith('mobile')) ? 'mobile' : (project?.device === 'tablet' ? 'tablet' : 'web'),
      },
      motionLevel: 'subtle',
    };
  };

  const recordScreenAction = async (kind: ScreenActionRecord['kind'], prompt: string, description: string) => {
    if (!screen || !project) return;
    const row: ScreenActionRecord = {
      id: nanoid(),
      projectId: project.id,
      screenId: screen.id,
      timestamp: Date.now(),
      kind,
      prompt,
      description,
    };
    await getDatabase().screenActions.add(row);
    setScreenActions((current) => [row, ...current].slice(0, 40));
  };

  const persistScreen = async (
    html: string,
    requiredRoles: Role[],
    generatedName?: string,
    checkpointDescription?: string,
    screenBrandColor?: string,
    colorScheme?: 'light' | 'dark',
    historyAction: HistoryEntry['action'] = 'undo',
    prompt = '',
    consumeCheckpointId?: string,
    clearRedo = false,
  ) => {
    if (!screen || !project) return;
    const db = getDatabase();
    const previous = await db.screenAssets.get(`${screen.id}::index.html`);
    const previousHtml = previous?.content || codeEditorHtml;
    if (previousHtml && previousHtml !== html) {
      if (clearRedo) {
        const redoRows = await db.history.where('screenId').equals(screen.id).toArray();
        const redoIds = redoRows.filter((row) => row.projectId === project.id && row.action === 'redo').map((row) => row.id);
        if (redoIds.length) await db.history.bulkDelete(redoIds);
      }
      const checkpoint: HistoryEntry = {
        id: nanoid(),
        timestamp: Date.now(),
        patchJson: JSON.stringify({ kind: 'tezmind-html-checkpoint', html: previousHtml, brandColor: screen.brandColor, colorScheme: screen.colorScheme }),
        description: checkpointDescription || 'Before AI update',
        prompt,
        action: historyAction,
      };
      await db.history.add({ ...checkpoint, projectId: project.id, screenId: screen.id });
    }
    if (consumeCheckpointId) await db.history.delete(consumeCheckpointId);
    await db.screenAssets.put({
      id: `${screen.id}::index.html`,
      screenId: screen.id,
      projectId: project.id,
      filename: 'index.html',
      content: html,
      updatedAt: Date.now(),
    });

    const { screens } = htmlToDsl(html, {
      width: screen.width,
      height: screen.height,
      projectName: project.name,
      roles: requiredRoles,
    });
    if (screens && screens.length > 0) {
      const updatedScreenRecord: ScreenRecord = {
        ...screen,
        brandColor: screenBrandColor ?? screen.brandColor,
        colorScheme: colorScheme ?? screen.colorScheme,
        name: generatedName || inferScreenName(html, screen.name),
        rootJson: JSON.stringify(screens[0].root),
        updatedAt: Date.now(),
      };
      await db.screens.put({ ...updatedScreenRecord, projectId: project.id });
      setScreen(updatedScreenRecord);
      setScreensList((prev) => prev.map((s) => (s.id === screen.id ? updatedScreenRecord : s)));
    }
    const rows = await db.history.where('screenId').equals(screen.id).toArray();
    const currentRows = rows.filter((row) => row.projectId === project.id).sort((a, b) => b.timestamp - a.timestamp);
    const expiredIds = currentRows.slice(40).map((row) => row.id);
    if (expiredIds.length) await db.history.bulkDelete(expiredIds);
    setHistoryEntries(currentRows.slice(0, 40).map(({ projectId: _projectId, screenId: _screenId, ...entry }) => entry));
  };

  const restoreCheckpoint = async (entry: HistoryEntry, intent: 'restore' | 'undo' | 'redo' = 'restore') => {
    if (!screen) return;
    try {
      const checkpoint = JSON.parse(entry.patchJson) as { kind?: string; html?: string; brandColor?: string; colorScheme?: 'light' | 'dark' };
      if (checkpoint.kind !== 'tezmind-html-checkpoint' || typeof checkpoint.html !== 'string') {
        throw new Error('Unsupported checkpoint');
      }
      const restoredHtml = autofix(checkpoint.html);
      const inverseAction: HistoryEntry['action'] = intent === 'undo' ? 'redo' : 'undo';
      const actionPrompt = entry.prompt || entry.description || `${intent} checkpoint`;
      await persistScreen(
        restoredHtml,
        [],
        screen.name,
        `Before ${intent === 'restore' ? 'restoring' : intent} ${entry.description || 'checkpoint'}`,
        checkpoint.brandColor || project?.brandColor,
        checkpoint.colorScheme || 'light',
        inverseAction,
        actionPrompt,
        entry.id,
        intent === 'restore',
      );
      await recordScreenAction(intent, actionPrompt, `${intent === 'restore' ? 'Restored' : `${intent[0].toUpperCase()}${intent.slice(1)} to`} ${entry.description || 'saved checkpoint'}`);
      setCodeEditorHtml(restoredHtml);
      setStreamingHtml('');
      setIsHistoryOpen(false);
      setStatusMessage(`${intent === 'restore' ? 'Restored' : `${intent[0].toUpperCase()}${intent.slice(1)} to`} ${entry.description || 'previous version'}`);
    } catch {
      setErrorMessage('This version could not be restored.');
    }
  };

  const runPipeline = async (brief: ExpandedBrief, input: ExpandInput) => {
    if (!project) return;
    const providerId = selectedModel.provider;
    const providerName = providerId === 'google' ? 'Google AI Studio (Gemini)' : providerId === 'anthropic' ? 'Anthropic (Claude)' : providerId;
    const secrets = getSecretStorage();
    const token = await secrets.get(`token:${providerId}`);
    if (!token) {
      setPhase('error');
      setIsGenerating(false);
      setMissingKeyProvider(providerName);
      setErrorMessage(`No API key saved for ${providerName}. Please add your key in Settings.`);
      return;
    }

    const http = getHttpBridge();
    const provider = providerId === 'google' ? new GoogleProvider() : new AnthropicProvider();
    const abortController = new AbortController();
    const targetedEdit = targetedEditRef.current;
    const generationPrompt = targetedEdit ? input.prompt : brief.generatorPrompt;
    const generationBrandColor = targetedEdit
      ? screen?.brandColor || project.brandColor
      : input.project.brand;
    const generationColorScheme = targetedEdit
      ? screen?.colorScheme || 'light'
      : project.chosenPalette?.mode || resolvePromptColorScheme(input.prompt);

    const deps: PipelineDeps = {
      provider,
      token,
      http,
      signal: abortController.signal,
      systemPrompt: '',
      reqBase: {
        mode: attachedImage && !targetedEdit ? 'image_to_design' : 'screen',
        imageBase64: attachedImage && !targetedEdit ? attachedImage.split(',')[1] : undefined,
        imageMimeType: attachedImage && !targetedEdit ? (attachedImage.split(';')[0].split(':')[1] as any) : undefined,
        projectName: project.name,
        projectDescription: project.description,
        projectIdea: project.idea || project.description,
        styleKeywords: input.project.keywords,
        deviceWidth: screen?.width || 393,
        deviceHeight: screen?.height || 852,
        deviceType: project.device,
        materialDesign3: input.project.materialDesign3 ?? project.materialDesign3 ?? false,
        uiKit: input.project.uiKit,
        brandColor: generationBrandColor,
        modelId: selectedModel.id,
        prompt: generationPrompt,
        selectedNodeId: targetedEdit?.id,
        selectedNodeJson: targetedEdit?.markup,
        parentStyleSummary: targetedEdit?.parentContext,
      },
      profile: {
        maxOutput: 16384,
        repairPasses: 2,
        temp: 0.4,
      },
    };

    setIsGenerating(true);
    setStreamingHtml('');
    setErrorMessage(null);

    try {
      const focusedBrief = targetedEdit
        ? { ...brief, requiredRoles: [], generatorPrompt: generationPrompt }
        : brief;
      for await (const ev of generateFromBrief(focusedBrief, deps)) {
        if (ev.type === 'stage') {
          setPhase(ev.stage);
        } else if (ev.type === 'html_chunk') {
          setStreamingHtml(ev.html);
        } else if (ev.type === 'result') {
          const generatedHtml = await resolveGeneratedImagesInHtml(ev.html);
          const resultHtml = targetedEdit
            ? preserveUnselectedComponents(targetedEdit, generatedHtml)
            : generatedHtml;
          setStreamingHtml(resultHtml);
          setCodeEditorHtml(resultHtml);
          setPipelineReport(ev.report);
          setTokenUsage({
            inputTokens: ev.report.usage.input,
            outputTokens: ev.report.usage.output,
          });
          setLintViolationCount(ev.report.errors.length + ev.report.warnings.length);
          if (!targetedEdit && project.uiKitId === 'auto' && !project.resolvedUiKitId && input.project.uiKit) {
            const kitUpdate = {
              resolvedUiKitId: input.project.uiKit.id,
              brandColor: generationBrandColor,
              styleKeywords: input.project.keywords,
            };
            setProject((current) => current ? { ...current, ...kitUpdate } : current);
            await updateProject(project.id, kitUpdate);
          }
          await persistScreen(
            resultHtml,
            targetedEdit ? [] : brief.requiredRoles,
            targetedEdit ? screen?.name : inferScreenName(resultHtml, brief.title),
            targetedEdit ? `Before editing ${targetedEdit.name}` : 'Before AI update',
            generationBrandColor,
            generationColorScheme,
            'undo',
            input.prompt,
            undefined,
            true,
          );
          targetedEditRef.current = null;
        }
      }
      setPhase('done');
    } catch (err) {
      setPhase('error');
      setErrorMessage(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setIsGenerating(false);
      if (targetedEdit) targetedEditRef.current = null;
    }
  };

  const handleStartGenerate = async (promptOverride?: string) => {
    const activePrompt = promptOverride ?? promptInput;
    if (!activePrompt.trim() && !attachedImage) return;
    if (promptOverride === undefined) targetedEditRef.current = null;
    if (!project) return;

    const actionKind: ScreenActionRecord['kind'] = targetedEditRef.current ? 'edit' : 'generate';
    await recordScreenAction(actionKind, activePrompt.trim(), actionKind === 'edit' ? `Edit ${targetedEditRef.current?.name || 'component'}` : 'Generate screen');

    setIsGenerating(true);
    setErrorMessage(null);
    setMissingKeyProvider(null);
    setLintViolationCount(null);
    setPipelineReport(null);
    setPhase('expanding');

    const providerId = selectedModel.provider;
    const providerName = providerId === 'google' ? 'Google AI Studio (Gemini)' : providerId === 'anthropic' ? 'Anthropic (Claude)' : providerId;
    const secrets = getSecretStorage();
    const token = await secrets.get(`token:${providerId}`);
    if (!token) {
      setIsGenerating(false);
      setPhase('idle');
      setMissingKeyProvider(providerName);
      setErrorMessage(`No API key saved for ${providerName}. Please add your key in Settings.`);
      return;
    }

    const input = getExpandInput(activePrompt);
    const http = getHttpBridge();
    const provider = providerId === 'google' ? new GoogleProvider() : new AnthropicProvider();

    // LLM Json adapter for expandPrompt
    const llmJson: LlmJson = {
      generateJson: async ({ system, user, maxOutputTokens, temperature }) => {
        const req: GenerateRequest = {
          mode: 'screen',
          modelId: selectedModel.id,
          projectName: project.name,
          projectDescription: project.description,
          deviceWidth: screen?.width || 393,
          deviceHeight: screen?.height || 852,
          deviceType: project.device,
          prompt: `${system}\n\nUSER REQUEST (JSON):\n${user}`,
          maxOutputTokens,
        };
        let rawText = '';
        for await (const ev of provider.generate(req, token, http)) {
          if (ev.type === 'html_chunk') rawText += ev.html;
        }
        const clean = rawText.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
        return JSON.parse(clean);
      },
    };

    try {
      const brief = await expand(input, llmJson);
      setExpandedBrief(brief);
      setBriefEdits(brief.refinedPrompt);

      if (reviewBriefEnabled && !attachedImage && !targetedEditRef.current) {
        setPhase('reviewing');
        setIsGenerating(false);
      } else {
        await runPipeline(brief, input);
      }
    } catch {
      // Deterministic fallback via analyze
      const a = analyze(activePrompt);
      const fallbackBrief: ExpandedBrief = {
        title: activePrompt.slice(0, 40),
        purpose: activePrompt,
        style: { keywords: project.styleKeywords || ['modern'], density: 'comfortable', radius: 'lg' },
        outline: a.archetype?.outline ?? [{ region: 'body', component: 'main content', notes: activePrompt }],
        sampleContent: {},
        icons: a.archetype?.icons ?? ['circle'],
        imageSlots: [],
        motion: { level: 'subtle', entrance: 'list items fade-up with stagger', interactions: ['buttons press-scale'] },
        refinedPrompt: activePrompt,
        archetypeId: a.archetype?.id ?? null,
        requiredRoles: a.requiredRoles,
        generatorPrompt: renderGeneratorPrompt({
          title: activePrompt.slice(0, 40),
          purpose: activePrompt,
          style: { keywords: project.styleKeywords || ['modern'], density: 'comfortable', radius: 'lg' },
          outline: a.archetype?.outline ?? [{ region: 'body', component: 'main content', notes: activePrompt }],
          sampleContent: {},
          icons: a.archetype?.icons ?? ['circle'],
          imageSlots: [],
          motion: { level: 'subtle', entrance: 'list items fade-up with stagger', interactions: ['buttons press-scale'] },
          refinedPrompt: activePrompt,
          archetypeId: a.archetype?.id ?? null,
          requiredRoles: a.requiredRoles,
          generatorPrompt: '',
        }, input),
      };
      setExpandedBrief(fallbackBrief);
      setBriefEdits(fallbackBrief.refinedPrompt);
      if (reviewBriefEnabled && !attachedImage && !targetedEditRef.current) {
        setPhase('reviewing');
        setIsGenerating(false);
      } else {
        await runPipeline(fallbackBrief, input);
      }
    }
  };

  useEffect(() => {
    if (isLoading || !project || !screen || screen.order !== 0 || !promptInput.trim() || !codeEditorHtml.trim()) return;
    const key = `${project.id}:${screen.id}`;
    if (autoStartPromptRef.current.has(key)) return;
    let cancelled = false;
    void (async () => {
      const db = getDatabase();
      const initialPrompt = await db.settings.get(`project_${project.id}_initial_prompt`);
      if (cancelled || !initialPrompt?.value || initialPrompt.value.trim() !== promptInput.trim()) return;
      const existing = await db.screenAssets.get(`${screen.id}::index.html`);
      if (cancelled) return;
      autoStartPromptRef.current.add(key);
      if (existing?.content) return;
      await handleStartGenerate(initialPrompt.value);
    })();
    return () => { cancelled = true; };
  }, [isLoading, project?.id, screen?.id, screen?.order, promptInput, codeEditorHtml]);

  const undoEntry = historyEntries.find((entry) => entry.action === 'undo' || !entry.action);
  const redoEntry = historyEntries.find((entry) => entry.action === 'redo');
  const handleUndo = () => { if (undoEntry) void restoreCheckpoint(undoEntry, 'undo'); };
  const handleRedo = () => { if (redoEntry) void restoreCheckpoint(redoEntry, 'redo'); };

  const handleConfirmBrief = async () => {
    if (!expandedBrief) return;
    const input = getExpandInput(promptInput);
    const updatedBrief: ExpandedBrief = {
      ...expandedBrief,
      refinedPrompt: briefEdits,
      generatorPrompt: renderGeneratorPrompt(
        { ...expandedBrief, refinedPrompt: briefEdits },
        input,
      ),
    };
    setExpandedBrief(updatedBrief);
    await runPipeline(updatedBrief, input);
  };

  const handleSkipExpand = async () => {
    if (!project) return;
    const input = getExpandInput(promptInput);
    const a = analyze(promptInput);
    const minimalBrief: ExpandedBrief = {
      title: promptInput.slice(0, 40),
      purpose: promptInput,
      style: { keywords: project.styleKeywords || ['modern'], density: 'comfortable', radius: 'lg' },
      outline: a.archetype?.outline ?? [{ region: 'body', component: 'main content', notes: promptInput }],
      sampleContent: {},
      icons: a.archetype?.icons ?? [],
      imageSlots: [],
      motion: { level: 'subtle', entrance: '', interactions: [] },
      refinedPrompt: promptInput,
      archetypeId: a.archetype?.id ?? null,
      requiredRoles: a.requiredRoles,
      generatorPrompt: renderGeneratorPrompt({
        title: promptInput.slice(0, 40),
        purpose: promptInput,
        style: { keywords: project.styleKeywords || ['modern'], density: 'comfortable', radius: 'lg' },
        outline: a.archetype?.outline ?? [{ region: 'body', component: 'main content', notes: promptInput }],
        sampleContent: {},
        icons: a.archetype?.icons ?? [],
        imageSlots: [],
        motion: { level: 'subtle', entrance: '', interactions: [] },
        refinedPrompt: promptInput,
        archetypeId: a.archetype?.id ?? null,
        requiredRoles: a.requiredRoles,
        generatorPrompt: '',
      }, input),
    };
    await runPipeline(minimalBrief, input);
  };

  const handleReexpand = () => {
    handleStartGenerate();
  };

  const handleGenerate = handleStartGenerate;

  const handleEditSelectedComponent = (automatic = false) => {
    if (!selectedNodeId || !previewDocRef.current) return;
    const node = Array.from(previewDocRef.current.querySelectorAll<HTMLElement>('[data-tz-id]'))
      .find((el) => el.getAttribute('data-tz-id') === selectedNodeId);
    if (!node) return;
    const name = node.getAttribute('data-tz-name') || selectedNodeName || 'component';
    const instruction = automatic || !selectedEditComment.trim()
      ? 'Improve the visual polish and usability of this component while keeping it consistent with the screen.'
      : selectedEditComment.trim();
    const screenRoot = node.closest('.screen');
    const path: number[] = [];
    let current: Element = node;
    while (screenRoot && current !== screenRoot && current.parentElement) {
      path.unshift(Array.from(current.parentElement.children).indexOf(current));
      current = current.parentElement;
    }
    targetedEditRef.current = {
      id: selectedNodeId,
      name,
      markup: node.outerHTML,
      parentContext: buildLocalParentContext(node),
      screenHtml: codeEditorHtml,
      path,
    };
    setPromptInput(instruction);
    setSelectedEditComment('');
    setSelectedNodeId(null);
    handleStartGenerate(instruction);
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading TezMind Canvas…</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.error}>
        <AlertTriangle size={30} color="#D97706" strokeWidth={1.8} />
        <Text style={styles.errorTitle}>Project not found</Text>
        <Pressable onPress={() => router.replace('/')} style={styles.backBtn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} color="#666" /><Text style={styles.backBtnText}>Back to Home</Text></View>
        </Pressable>
      </View>
    );
  }

  const dimensionsStr = getDeviceDimensions(project);
  let parsedRoot: any = null;
  if (screen?.rootJson) {
    try {
      parsedRoot = JSON.parse(screen.rootJson);
    } catch { /* skip */ }
  }

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable onPress={() => router.replace('/')} style={styles.homeBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} color={colors.primary} /><Text style={styles.homeBtnText}>TezMind</Text></View>
          </Pressable>
          <View style={styles.titleDivider} />
          <Text style={styles.projectName}>{project.name}</Text>
        </View>

        <View style={styles.topBarCenter}>
          <View style={styles.tabGroup}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'screen' && screenMode === 'preview' && styles.tabBtnActive]}
              onPress={() => { setActiveTab('screen'); setScreenMode('preview'); setSelectedNodeId(null); }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'screen' && screenMode === 'preview' && styles.tabBtnTextActive]}>Preview</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === 'screen' && screenMode === 'edit' && styles.tabBtnActive]}
              onPress={() => { setActiveTab('screen'); setScreenMode('edit'); }}
            >
              <Text style={[styles.tabBtnText, activeTab === 'screen' && screenMode === 'edit' && styles.tabBtnTextActive]}>Edit</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === 'code' && styles.tabBtnActive]}
              onPress={() => { setActiveTab('code'); setSelectedNodeId(null); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Code size={13} color={activeTab === 'code' ? colors.primary : '#777B82'} /><Text style={[styles.tabBtnText, activeTab === 'code' && styles.tabBtnTextActive]}>Code</Text></View>
            </Pressable>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <Pressable onPress={handleUndo} disabled={!undoEntry || isGenerating} style={[styles.settingsHeaderBtn, (!undoEntry || isGenerating) && styles.historyActionDisabled]} accessibilityLabel="Undo last screen change" accessibilityState={{ disabled: !undoEntry || isGenerating }}>
            <Undo2 size={15} color={undoEntry && !isGenerating ? '#555B63' : '#B8BBC1'} />
          </Pressable>
          <Pressable onPress={handleRedo} disabled={!redoEntry || isGenerating} style={[styles.settingsHeaderBtn, (!redoEntry || isGenerating) && styles.historyActionDisabled]} accessibilityLabel="Redo screen change" accessibilityState={{ disabled: !redoEntry || isGenerating }}>
            <Redo2 size={15} color={redoEntry && !isGenerating ? '#555B63' : '#B8BBC1'} />
          </Pressable>
          <Pressable onPress={() => setIsHistoryOpen(true)} style={styles.settingsHeaderBtn} accessibilityLabel="Version history">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><HistoryIcon size={14} color="#555B63" /><Text style={styles.settingsHeaderBtnText}>History</Text></View>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} style={styles.settingsHeaderBtn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Settings size={14} color="#555B63" /><Text style={styles.settingsHeaderBtnText}>Settings</Text></View>
          </Pressable>
          <View style={styles.devicePill}>
            <Text style={styles.devicePillText}>{project.device} ({dimensionsStr})</Text>
          </View>
          <Pressable style={styles.exportHeaderBtn} onPress={() => setActiveTab('code')}>
            <Text style={styles.exportHeaderBtnText}>Export Code</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Studio Area */}
      <View style={styles.main}>
        {/* Left Screens Panel */}
        <View style={styles.screensStrip}>
          <Text style={styles.panelTitle}>Screens ({screensList.length})</Text>
          <ScrollView style={{ maxHeight: 220, marginVertical: spacing[2] }} showsVerticalScrollIndicator={false}>
            {screensList.map((sc) => {
              const isSelected = sc.id === screen?.id;
              return (
                <Pressable
                  key={sc.id}
                  style={[styles.screenThumbSelected, !isSelected && styles.screenThumbUnselected]}
                  onPress={() => setScreen(sc)}
                >
                  <View style={styles.screenMiniCard}>
                    <Smartphone size={19} color="#10A37F" strokeWidth={1.8} />
                  </View>
                  <Text style={[styles.screenThumbLabel, !isSelected && styles.screenThumbLabelUnselected]} numberOfLines={1}>
                    {sc.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.addScreenBtn} onPress={handleAddScreen}>
            <Text style={styles.addScreenBtnText}>+ Add Screen</Text>
          </Pressable>

          {project.styleKeywords && project.styleKeywords.length > 0 && (
            <View style={styles.stylesSection}>
              <Text style={styles.panelTitle}>Styles</Text>
              <View style={styles.tagsContainer}>
                {project.styleKeywords.map((st) => (
                  <View key={st} style={styles.styleBadge}>
                    <Text style={styles.styleBadgeText}>{st}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Center Canvas / Split View Area */}
        {activeTab === 'code' ? (
          <View style={styles.codeExportSplitContainer}>

            {/* ── LEFT: Live Preview ─────────────────────────────────── */}
            <View style={styles.codePreviewHalf}>
              <View style={styles.previewHeader}>
                <View style={styles.previewHeaderLeft}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Smartphone size={16} color="#AAB2C0" /><Text style={styles.previewHeaderTitle}>Live Canvas</Text></View>
                  <Text style={styles.previewHeaderSubtitle}>{screen?.name || 'Screen'} · {dimensionsStr}</Text>
                </View>
              </View>
              <View style={styles.codePreviewCanvasBox}>
                <HtmlPreview
                  html={codeEditorHtml || streamingHtml}
                  brandColor={screen?.brandColor || project.brandColor}
                  materialDesign3={project.materialDesign3}
                  colorScheme={screen?.colorScheme}
                  width={screen?.width || 393}
                  height={screen?.height || 852}
                  isStreaming={false}
                  mode="preview"
                  onNavigate={handlePreviewNavigate}
                  onDocReady={handlePreviewDocReady}
                />
              </View>
            </View>

            {/* ── RIGHT: Monaco IDE Code Editor ──────────────────────── */}
            <View style={styles.codeEditorHalf}>

              {/* VS Code–style title bar */}
              <View style={styles.ideTitleBar}>
                <View style={styles.ideWindowDots}>
                  <View style={[styles.windowDot, { backgroundColor: '#FF5F57' }]} />
                  <View style={[styles.windowDot, { backgroundColor: '#FFBD2E' }]} />
                  <View style={[styles.windowDot, { backgroundColor: '#28C840' }]} />
                </View>

                {/* File tabs */}
                <View style={styles.ideTabRow}>
                  {(['html', 'css', 'js'] as CodeFileTab[]).map((file) => {
                    const labels: Record<CodeFileTab, string> = { html: 'index.html', css: 'styles.css', js: 'app.js' };
                    const isActive = activeCodeFile === file;
                    return (
                      <Pressable
                        key={file}
                        style={[styles.ideTab, isActive && styles.ideTabActive]}
                        onPress={() => setActiveCodeFile(file)}
                      >
                        <Text style={[styles.ideTabText, isActive && styles.ideTabTextActive]}>
                          {labels[file]}
                        </Text>
                        {isActive && <View style={styles.ideTabDot} />}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Actions */}
                <View style={styles.ideActions}>
                  <Pressable style={styles.ideActionBtn} onPress={handleFormat}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Settings size={14} color="#C9D1D9" /><Text style={styles.ideActionBtnText}>Format</Text></View>
                  </Pressable>
                  <Pressable style={styles.ideActionBtn} onPress={handleCopyCode}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{copiedCodeNotice ? <Check size={14} color="#C9D1D9" /> : <Copy size={14} color="#C9D1D9" />}<Text style={styles.ideActionBtnText}>{copiedCodeNotice ? 'Copied' : 'Copy'}</Text></View>
                  </Pressable>
                </View>
              </View>

              {/* Monaco editor body */}
              <View style={styles.ideEditorBody}>
                {Platform.OS === 'web' ? (
                  activeCodeFile === 'html' ? (
                    <IdeCodeEditor
                      key="html"
                      value={codeEditorHtml}
                      onChange={handleCodeEditorChange}
                      language="html"
                    />
                  ) : activeCodeFile === 'css' ? (
                    <IdeCodeEditor
                      key="css"
                      value={cssContent}
                      onChange={handleCssChange}
                      language="css"
                    />
                  ) : (
                    <IdeCodeEditor
                      key="js"
                      value={jsContent}
                      onChange={handleJsChange}
                      language="javascript"
                    />
                  )
                ) : (
                  <TextInput
                    style={styles.codeEditorInput}
                    multiline
                    value={activeCodeFile === 'css' ? cssContent : activeCodeFile === 'js' ? jsContent : codeEditorHtml}
                    onChangeText={activeCodeFile === 'css' ? handleCssChange : activeCodeFile === 'js' ? handleJsChange : handleCodeEditorChange}
                    placeholder={activeCodeFile === 'css' ? '/* CSS here... */' : activeCodeFile === 'js' ? '// JS here...' : '<!-- HTML here... -->'}
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </View>

              {/* VS Code–style status bar */}
              <View style={styles.ideStatusBar}>
                <Text style={styles.ideStatusText}>
                  {activeCodeFile === 'css' ? 'CSS' : activeCodeFile === 'js' ? 'JavaScript' : 'HTML'} · UTF-8 · LF
                </Text>
                <Text style={styles.ideStatusText}>
                  Ln {(activeCodeFile === 'css' ? cssContent : activeCodeFile === 'js' ? jsContent : codeEditorHtml).split('\n').length}
                </Text>
                <Text style={styles.ideStatusText}>TezMind Editor</Text>
              </View>
            </View>

          </View>
        ) : (
          <View style={styles.canvas}>
            <ScrollView
              contentContainerStyle={styles.canvasScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Realistic Smartphone Frame Mockup (Matching Screenshot Frame UI) */}
              <View style={[
                styles.screenFrameContainer,
                { width: (screen?.width || 393) + 16, minHeight: (screen?.height || 852) + 16 }
              ]}>
                {/* Dynamic Island & Status Bar */}
                <View style={[styles.phoneStatusBar, { backgroundColor: statusBarColor }]}>
                  <Text style={[styles.phoneTimeText, { color: statusBarTextColor }]}>9:41</Text>
                  <View style={styles.dynamicIslandPill}>
                    <View style={styles.cameraLensDot} />
                    <View style={styles.sensorDot} />
                  </View>
                  <View style={styles.phoneStatusRight}>
                    <Text style={styles.phoneStatusIcon}>📶</Text>
                    <Text style={[styles.phoneStatusText, { color: statusBarTextColor }]}>5G</Text>
                    <Text style={styles.phoneStatusIcon}>🔋</Text>
                  </View>
                </View>

                {/* Inner Screen Display (Edge-to-Edge) */}
                <View style={[
                  styles.screenCanvasInner,
                  { width: screen?.width || 393, height: (screen?.height || 852) - 44 }
                ]}>
                  {isGenerating ? (
                    <HtmlPreview
                      html={isGenerating && targetedEditRef.current ? codeEditorHtml : streamingHtml}
                      brandColor={screen?.brandColor || project.brandColor}
                      materialDesign3={project.materialDesign3}
                      colorScheme={screen?.colorScheme}
                      width={screen?.width || 393}
                      height={(screen?.height || 852) - 44}
                      flush
                      isStreaming={isGenerating && !targetedEditRef.current}
                      selectedNodeId={selectedNodeId}
                      mode={screenMode}
                      onNavigate={handlePreviewNavigate}
                      onSelectNode={handleSelectNode}
                      onDocReady={handlePreviewDocReady}
                    />
                  ) : codeEditorHtml ? (
                    <HtmlPreview
                      html={codeEditorHtml}
                      brandColor={screen?.brandColor || project.brandColor}
                      materialDesign3={project.materialDesign3}
                      colorScheme={screen?.colorScheme}
                      width={screen?.width || 393}
                      height={(screen?.height || 852) - 44}
                      flush
                      isStreaming={false}
                      selectedNodeId={selectedNodeId}
                      mode="preview"
                      onNavigate={handlePreviewNavigate}
                      onDocReady={handlePreviewDocReady}
                    />
                  ) : parsedRoot ? (
                    <HtmlPreview
                      html={dslToHtml({
                        id: screen?.id || 'screen_1',
                        name: screen?.name || 'Main Screen',
                        width: screen?.width || 393,
                        height: (screen?.height || 852) - 44,
                        schemaVersion: 1,
                        root: parsedRoot,
                      })}
                      brandColor={screen?.brandColor || project.brandColor}
                      materialDesign3={project.materialDesign3}
                      colorScheme={screen?.colorScheme}
                      width={screen?.width || 393}
                      height={(screen?.height || 852) - 44}
                      flush
                      isStreaming={false}
                      selectedNodeId={selectedNodeId}
                      mode={screenMode}
                      onNavigate={handlePreviewNavigate}
                      onSelectNode={handleSelectNode}
                      onDocReady={handlePreviewDocReady}
                    />
                  ) : (
                    <View style={styles.screenEmptyState}>
                      <Sparkles size={30} color="#10A37F" strokeWidth={1.6} />
                      <Text style={styles.emptyTitle}>Your first screen starts here</Text>
                      <Text style={styles.emptySubtitle}>
                        {promptInput
                          ? `Target Prompt: "${promptInput}"`
                          : 'Describe the mobile screen you want in the prompt below.'}
                      </Text>

                      {attachedImage && (
                        <View style={styles.imageRefBox}>
                          <Text style={styles.imageRefLabel}>Attached Reference Image:</Text>
                          <Image source={{ uri: attachedImage }} style={styles.imageRefThumb} resizeMode="contain" />
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Home Indicator Bar */}
                <View style={[styles.phoneHomeBarContainer, { backgroundColor: homeIndicatorBackground }]}>
                  <View style={[styles.phoneHomeBar, { backgroundColor: statusBarTextColor }]} />
                </View>
              </View>
            </ScrollView>

          {activeTab === 'screen' && screenMode === 'edit' && selectedNodeId && (
            <View style={styles.modalLayer}>
              <Pressable style={styles.modalScrim} onPress={() => setSelectedNodeId(null)} />
              <View style={styles.selectionEditCard}>
                <View style={styles.selectionEditHeader}>
                  <View style={styles.selectionEditTitleRow}>
                    <View style={styles.selectionEditDot} />
                    <View>
                      <Text style={styles.selectionEditEyebrow}>SELECTED COMPONENT</Text>
                      <Text style={styles.selectionEditTitle}>{selectedNodeName}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setSelectedNodeId(null)} style={styles.selectionEditClose} accessibilityLabel="Close component editor">
                    <X size={16} color="#666666" strokeWidth={1.8} />
                  </Pressable>
                </View>
                <Text style={styles.selectionEditDescription}>Leave a comment or ask TezMind to improve this part of the screen.</Text>
                <TextInput
                  style={styles.selectionEditInput}
                  value={selectedEditComment}
                  onChangeText={setSelectedEditComment}
                  placeholder="e.g. Make the title clearer and add more spacing"
                  placeholderTextColor="#888888"
                  multiline
                  autoFocus
                />
                <View style={styles.selectionEditActions}>
                  <Pressable onPress={() => handleEditSelectedComponent(true)} disabled={isGenerating} style={[styles.selectionEditAuto, isGenerating && styles.actionSendBtnDisabled]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Sparkles size={14} color="#087F63" strokeWidth={1.8} /><Text style={styles.selectionEditAutoText}>Improve automatically</Text></View>
                  </Pressable>
                  <Pressable onPress={() => handleEditSelectedComponent(false)} disabled={isGenerating} style={[styles.selectionEditApply, isGenerating && styles.actionSendBtnDisabled]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={styles.selectionEditApplyText}>Apply edit</Text><ArrowRight size={14} color="#FFFFFF" strokeWidth={1.8} /></View>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          {isHistoryOpen && (
            <View style={styles.modalLayer}>
              <Pressable style={styles.modalScrim} onPress={() => setIsHistoryOpen(false)} />
              <View style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyHeading}>
                    <View style={styles.historyIcon}><HistoryIcon size={17} color="#087F63" /></View>
                    <View><Text style={styles.historyTitle}>Version history</Text><Text style={styles.historySubtitle}>Restore an earlier screen version</Text></View>
                  </View>
                  <Pressable onPress={() => setIsHistoryOpen(false)} style={styles.selectionEditClose} accessibilityLabel="Close version history"><X size={16} color="#666666" /></Pressable>
                </View>
                {historyEntries.length || screenActions.length ? (
                  <ScrollView style={styles.historyList} contentContainerStyle={{ gap: 8 }}>
                    {!!historyEntries.length && <Text style={styles.historySectionLabel}>CHECKPOINTS</Text>}
                    {historyEntries.map((entry) => (
                      <View key={entry.id} style={styles.historyRow}>
                        <View style={styles.historyEntryCopy}>
                          <Text style={styles.historyEntryTitle}>{entry.description || 'Saved version'}</Text>
                          {!!entry.prompt && <Text style={styles.historyEntryPrompt} numberOfLines={2}>{entry.prompt}</Text>}
                          <Text style={styles.historyEntryDate}>{new Date(entry.timestamp).toLocaleString()}</Text>
                        </View>
                        <Pressable onPress={() => restoreCheckpoint(entry)} style={styles.historyRestoreBtn}>
                          <RotateCcw size={13} color="#087F63" /><Text style={styles.historyRestoreText}>Restore</Text>
                        </Pressable>
                      </View>
                    ))}
                    {!!screenActions.length && <Text style={styles.historySectionLabel}>PROMPTS & ACTIONS · THIS SCREEN</Text>}
                    {screenActions.map((action) => (
                      <View key={action.id} style={styles.actionLogRow}>
                        <View style={styles.actionLogTop}><Text style={styles.actionLogKind}>{action.kind.toUpperCase()}</Text><Text style={styles.historyEntryDate}>{new Date(action.timestamp).toLocaleString()}</Text></View>
                        <Text style={styles.historyEntryTitle}>{action.description}</Text>
                        {!!action.prompt && <Text style={styles.historyEntryPrompt} numberOfLines={3}>{action.prompt}</Text>}
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.historyEmpty}><Clock3 size={22} color="#8A8F98" /><Text style={styles.historyEmptyTitle}>No screen activity yet</Text><Text style={styles.historyEmptyCopy}>Prompts, edits, and checkpoints for this screen will appear here.</Text></View>
                )}
              </View>
            </View>
          )}
          {isGenerating && activeTab === 'screen' && (
            <View style={[styles.modalLayer, styles.progressLayer]}>
              <View style={styles.progressCard}>
                <View style={styles.progressBrandRow}>
                  <View style={styles.progressSparkle}><Sparkles size={16} color="#10A37F" strokeWidth={1.8} /></View>
                  <Text style={styles.progressBrand}>TEZMIND STUDIO</Text>
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 'auto' }} />
                </View>
                <Text style={styles.progressTitle}>Designing your screen</Text>
                <Text style={styles.progressSubtitle}>
                  {phase === 'expanding' ? 'Understanding your idea and planning the layout…'
                    : phase === 'streaming' ? 'Creating the interface and placing each component…'
                    : phase === 'recovering' ? 'Finishing the screen structure…'
                    : phase === 'fixing' ? 'Aligning navigation and screen sections…'
                    : phase === 'repairing' ? 'Polishing spacing and fixing layout details…'
                    : 'Getting your preview ready…'}
                </Text>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${phase === 'expanding' ? 18 : phase === 'streaming' ? 48 : phase === 'recovering' ? 66 : phase === 'fixing' ? 78 : phase === 'repairing' ? 90 : 98}%` }]} /></View>
                <View style={styles.progressSteps}>
                  {['Plan', 'Design', 'Polish'].map((label, index) => {
                    const activeStep = phase === 'expanding' ? 0 : phase === 'streaming' || phase === 'recovering' ? 1 : 2;
                    return <View key={label} style={styles.progressStep}><View style={[styles.progressStepDot, index <= activeStep && styles.progressStepDotActive]} /><Text style={[styles.progressStepText, index <= activeStep && styles.progressStepTextActive]}>{label}</Text></View>;
                  })}
                </View>
              </View>
            </View>
          )}
              {/* Brief Review Card (Contract v2) */}
              {phase === 'reviewing' && expandedBrief && (
                <View style={styles.modalLayer}>
                  <Pressable style={styles.modalScrim} onPress={() => setPhase('idle')} />
                  <View style={styles.briefCard}>
                  <View style={styles.briefHeader}>
                    <View style={styles.briefHeaderLeft}>
                      {expandedBrief.archetypeId && (
                        <View style={styles.briefArchetypeBadge}>
                          <Text style={styles.briefArchetypeText}>
                            {expandedBrief.archetypeId}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.briefTitle}>{expandedBrief.title}</Text>
                    </View>
                    <Pressable onPress={() => setPhase('idle')}>
                      <X size={16} color="#777B82" strokeWidth={1.8} />
                    </Pressable>
                  </View>

                  {/* Editable Refined Design Direction */}
                  <View style={{ gap: 4 }}>
                    <Text style={styles.briefSectionLabel}>Design Direction (Editable):</Text>
                    <TextInput
                      style={styles.briefPromptInput}
                      value={briefEdits}
                      onChangeText={setBriefEdits}
                      multiline
                    />
                  </View>

                  {/* Required Roles Chips (Read-only, Locked) */}
                  {expandedBrief.requiredRoles.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.briefSectionLabel}>Required Elements (Guaranteed):</Text>
                      <View style={styles.requiredRolesRow}>
                        {expandedBrief.requiredRoles.map((role) => (
                          <View key={role} style={styles.requiredRoleChip}>
                            <LockKeyhole size={12} color="#858A93" strokeWidth={1.8} />
                            <Text style={styles.roleChipText}>{role}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.briefActionsRow}>
                    <Pressable style={styles.briefBtnSecondary} onPress={handleSkipExpand}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><SkipForward size={14} color="#555B63" /><Text style={styles.briefBtnSecondaryText}>Skip Expand</Text></View>
                    </Pressable>
                    <Pressable style={styles.briefBtnSecondary} onPress={handleReexpand}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><RefreshCw size={14} color="#555B63" /><Text style={styles.briefBtnSecondaryText}>Re-expand</Text></View>
                    </Pressable>
                    <Pressable style={styles.briefBtnPrimary} onPress={handleConfirmBrief}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Sparkles size={14} color="#FFFFFF" /><Text style={styles.briefBtnPrimaryText}>Generate UI</Text></View>
                    </Pressable>
                  </View>
                  </View>
                </View>
              )}

          {/* Model Selector Popover Modal (Matching Screenshot) */}
          {isModelPickerOpen && (
            <View style={styles.modalLayer}>
              <Pressable style={styles.modalScrim} onPress={() => setIsModelPickerOpen(false)} />
              <View style={styles.modelPopoverContainer}>
              <View style={styles.modelPopoverHeader}>
                <Text style={styles.modelPopoverTitle}>Model</Text>
                <Pressable onPress={() => setIsModelPickerOpen(false)}>
                  <X size={16} color="#777B82" strokeWidth={1.8} />
                </Pressable>
              </View>
              {modelsLoading ? (
                <View style={{ padding: spacing[4], alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>Loading models…</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {availableModels.map((item) => {
                    const isSelected = item.id === selectedModel.id;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.modelMenuItem, isSelected && styles.modelMenuItemSelected]}
                        onPress={() => handleSelectModel(item)}
                      >
                        <Text style={[styles.modelMenuItemText, isSelected && styles.modelMenuItemTextSelected]}>
                          {item.name}
                        </Text>
                        {isSelected && (
                          <Check size={14} color={colors.primary} strokeWidth={2.2} />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              </View>
            </View>
          )}


          {/* ── Bottom Right AI Magic Widget ────────────────────── */}
          {!isPromptExpanded ? (
            <Pressable
              style={styles.floatingAiMagicPill}
              onPress={() => setIsPromptExpanded(true)}
              accessibilityLabel="Open prompt box"
            >
              <View style={styles.floatingSparkleCircle}>
                <Sparkles size={15} color="#D8CCFF" strokeWidth={1.8} />
              </View>
              <Text style={styles.floatingAiMagicText}>Ask TezMind</Text>
              {isGenerating && (
                <ActivityIndicator size="small" color="#A78BFA" style={{ marginLeft: 4 }} />
              )}
            </Pressable>
          ) : (
            <View style={styles.promptBarContainer}>

              {/* Error Banner */}
              {errorMessage && (
                <View style={styles.errorBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }}><AlertTriangle size={14} color="#DC4C4C" /><Text style={styles.errorBannerText}>{errorMessage}</Text></View>
                  {missingKeyProvider && (
                    <Pressable style={styles.openSettingsBtn} onPress={() => router.push('/settings')}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Settings size={13} color="#FFF" /><Text style={styles.openSettingsBtnText}>Open Settings</Text></View>
                    </Pressable>
                  )}
                  {(errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded')) && selectedModel.id !== 'gemini-2.0-flash' && (
                    <Pressable
                      style={styles.openSettingsBtn}
                      onPress={() => {
                        const flash2 = availableModels.find((m) => m.id === 'gemini-2.0-flash') || {
                          id: 'gemini-2.0-flash',
                          name: 'Gemini 2.0 Flash',
                          provider: 'google' as ProviderKey,
                        };
                        setSelectedModel(flash2);
                        setErrorMessage(null);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Zap size={13} color="#FFF" /><Text style={styles.openSettingsBtnText}>Switch to Gemini 2.0 Flash</Text></View>
                    </Pressable>
                  )}
                </View>
              )}


              {/* Main Prompt Bar Box */}
              <View nativeID="tezmind-prompt-box" style={styles.promptBarBox}>
                {/* Header with Title and Close ✕ Button */}
                <View style={styles.promptBarHeader}>
                  <View style={styles.promptBarHeaderLeft}>
                    <View style={styles.promptSparkleIconWrap}>
                      <Sparkles size={14} color="#7659E8" strokeWidth={2} />
                    </View>
                    <Text style={styles.promptBarHeaderTitle}>Ask TezMind</Text>
                    {isGenerating && (
                      <View style={styles.promptGeneratingBadge}>
                        <ActivityIndicator size="small" color="#A78BFA" />
                        <Text style={styles.promptGeneratingText}>Generating…</Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    style={styles.promptCloseIconBtn}
                    onPress={() => setIsPromptExpanded(false)}
                    accessibilityLabel="Close prompt box to view complete screen"
                  >
                    <X size={15} color="#737781" strokeWidth={1.8} />
                  </Pressable>
                </View>

                {attachedImage && (
                  <View style={styles.attachedBadge}>
                    <Image source={{ uri: attachedImage }} style={styles.attachedThumb} />
                    <Text style={styles.attachedText}>Reference Image</Text>
                    <Pressable onPress={() => setAttachedImage(null)}>
                      <X size={14} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                )}

                {/* Upper Text Area */}
                <TextInput
                  placeholder="Type a prompt to build or update this screen..."
                  placeholderTextColor="#7C8092"
                  value={promptInput}
                  onChangeText={(value) => {
                    setPromptInput(value);
                    if (!value.trim()) setPromptInputHeight(42);
                  }}
                  onContentSizeChange={(event) => {
                    if (!promptInput.trim()) {
                      setPromptInputHeight(42);
                      return;
                    }
                    setPromptInputHeight(Math.min(180, Math.max(42, Math.ceil(event.nativeEvent.contentSize.height))));
                  }}
                  style={[styles.promptInputArea, { height: promptInput.trim() ? promptInputHeight : 42 }]}
                  multiline
                />

                {/* Bottom Control Bar */}
                <View style={styles.promptControlsRow}>
                  <View style={styles.promptControlsLeft}>
                    {/* + Button */}
                    <Pressable onPress={handlePickNewImage} style={styles.plusBtn}>
                      <ImagePlus size={18} color="#AEB4C2" strokeWidth={1.8} />
                    </Pressable>

                    {/* Model Selector Pill */}
                    <Pressable
                      style={styles.modelPillBtn}
                      onPress={() => setIsModelPickerOpen(!isModelPickerOpen)}
                    >
                      <Text style={styles.modelPillText}>{selectedModel.name}</Text>
                      <ChevronDown size={13} color="#AEB4C2" strokeWidth={1.8} />
                    </Pressable>
                  </View>

                  <View style={styles.promptControlsRight}>
                    {/* Action Send Button */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionSendBtn,
                        pressed && styles.actionSendBtnPressed,
                        isGenerating && styles.actionSendBtnDisabled,
                      ]}
                      onPress={() => handleGenerate()}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <ArrowUp size={18} color="#FFFFFF" strokeWidth={2.1} />
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

        {/* Right Inspector Panel */}
        <View style={styles.inspector}>
          <Text style={styles.panelTitle}>Inspector</Text>
          <View style={styles.inspectorCard}>
            <Text style={styles.inspectorLabel}>Device Preset</Text>
            <Text style={styles.inspectorValue}>{project.device}</Text>
          </View>
          <View style={styles.inspectorCard}>
            <Text style={styles.inspectorLabel}>Dimensions</Text>
            <Text style={styles.inspectorValue}>{dimensionsStr} px</Text>
          </View>
          <View style={styles.inspectorCard}>
            <Text style={styles.inspectorLabel}>AI Provider</Text>
            <Text style={styles.inspectorValue}>{selectedModel.provider}</Text>
          </View>
          <View style={styles.inspectorCard}>
            <Text style={styles.inspectorLabel}>Active Model</Text>
            <Text style={styles.inspectorValue}>{selectedModel.name}</Text>
          </View>

          {(screen?.brandColor || project.brandColor) && (
            <View style={styles.inspectorCard}>
              <Text style={styles.inspectorLabel}>Brand Accent</Text>
              <View style={styles.brandColorRow}>
                <View style={[styles.colorChip, { backgroundColor: screen?.brandColor || project.brandColor }]} />
                <Text style={styles.inspectorValue}>{screen?.brandColor || project.brandColor}</Text>
              </View>
            </View>
          )}

          {/* ── Token Usage Panel ───────────────────────── */}
          <View style={styles.tokenUsageSection}>
            <View style={styles.tokenUsageHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Zap size={13} color="#7357D9" /><Text style={styles.tokenUsageTitle}>Token Usage</Text></View>
              {isGenerating && (
                <ActivityIndicator size="small" color="#A78BFA" style={{ marginLeft: 6 }} />
              )}
            </View>

            {tokenUsage ? (
              <View style={styles.tokenUsageBody}>
                {/* Input tokens bar */}
                <View style={styles.tokenRow}>
                  <View style={styles.tokenRowLeft}>
                    <View style={[styles.tokenDot, { backgroundColor: '#60A5FA' }]} />
                    <Text style={styles.tokenLabel}>Input</Text>
                  </View>
                  <Text style={styles.tokenCount}>{tokenUsage.inputTokens.toLocaleString()}</Text>
                </View>
                <View style={styles.tokenBarTrack}>
                  <View
                    style={[
                      styles.tokenBarFill,
                      {
                        backgroundColor: '#60A5FA',
                        width: `${Math.min(100, (tokenUsage.inputTokens / Math.max(tokenUsage.inputTokens + tokenUsage.outputTokens, 1)) * 100)}%` as any,
                      },
                    ]}
                  />
                </View>

                {/* Output tokens bar */}
                <View style={[styles.tokenRow, { marginTop: 8 }]}>
                  <View style={styles.tokenRowLeft}>
                    <View style={[styles.tokenDot, { backgroundColor: '#A78BFA' }]} />
                    <Text style={styles.tokenLabel}>Output</Text>
                  </View>
                  <Text style={styles.tokenCount}>{tokenUsage.outputTokens.toLocaleString()}</Text>
                </View>
                <View style={styles.tokenBarTrack}>
                  <View
                    style={[
                      styles.tokenBarFill,
                      {
                        backgroundColor: '#A78BFA',
                        width: `${Math.min(100, (tokenUsage.outputTokens / Math.max(tokenUsage.inputTokens + tokenUsage.outputTokens, 1)) * 100)}%` as any,
                      },
                    ]}
                  />
                </View>

                {/* Total + Cost */}
                <View style={styles.tokenSummaryRow}>
                  <View style={styles.tokenSummaryChip}>
                    <Text style={styles.tokenSummaryLabel}>Total</Text>
                    <Text style={styles.tokenSummaryValue}>
                      {(tokenUsage.inputTokens + tokenUsage.outputTokens).toLocaleString()}
                    </Text>
                  </View>
                  {tokenUsage.cost !== undefined ? (
                    <View style={[styles.tokenSummaryChip, { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.25)' }]}>
                      <Text style={[styles.tokenSummaryLabel, { color: '#087F63' }]}>Cost</Text>
                      <Text style={[styles.tokenSummaryValue, { color: '#34D399' }]}>
                        ${tokenUsage.cost < 0.001 ? tokenUsage.cost.toFixed(6) : tokenUsage.cost.toFixed(4)}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.tokenSummaryChip, { backgroundColor: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.15)' }]}>
                      <Text style={[styles.tokenSummaryLabel, { color: '#087F63' }]}>Est. Cost</Text>
                      <Text style={[styles.tokenSummaryValue, { color: '#34D399' }]}>
                        ~${((tokenUsage.inputTokens * 0.00000015) + (tokenUsage.outputTokens * 0.0000006)).toFixed(5)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.tokenEmptyState}>
                <Text style={styles.tokenEmptyText}>
                  {isGenerating ? 'Counting tokens…' : 'Run a generation to\nsee token usage'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Layout Health Panel ──────────────────────── */}
          <View style={styles.lintHealthSection}>
            <View style={styles.tokenUsageHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Settings size={13} color="#087F63" /><Text style={styles.lintHealthTitle}>Layout Health</Text></View>
              {isRepairing && (
                <ActivityIndicator size="small" color="#FBBF24" style={{ marginLeft: 6 }} />
              )}
            </View>

            {pipelineReport?.recovered && (
              <View style={styles.recoveredBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Zap size={13} color="#087F63" /><Text style={styles.recoveredBadgeText}>Truncation Auto-Recovered</Text></View>
              </View>
            )}

            {expandedBrief && expandedBrief.requiredRoles.length > 0 && (
              <View style={styles.rolesVerifiedBadge}>
                <Text style={styles.rolesVerifiedText}>
                  {expandedBrief.requiredRoles.length} Required Roles Verified
                </Text>
              </View>
            )}

            {lintViolationCount === null ? (
              <View style={styles.tokenEmptyState}>
                <Text style={styles.tokenEmptyText}>
                  {isGenerating ? 'Linting after generation…' : 'Auto-lints after\neach generation'}
                </Text>
              </View>
            ) : lintViolationCount === 0 ? (
              <View style={styles.lintBadgeGreen}>
                <Check size={20} color="#10A37F" strokeWidth={2.2} />
                <Text style={styles.lintBadgeText}>Layout clean</Text>
                <Text style={styles.lintBadgeSubtext}>All rules passed</Text>
              </View>
            ) : lintViolationCount <= 3 ? (
              <View style={styles.lintBadgeAmber}>
                <Zap size={20} color="#D99B13" strokeWidth={1.8} />
                <Text style={styles.lintBadgeText}>{lintViolationCount} issue{lintViolationCount > 1 ? 's' : ''}</Text>
                <Text style={styles.lintBadgeSubtext}>{isRepairing ? 'Auto-repairing…' : 'Minor issues'}</Text>
              </View>
            ) : (
              <View style={styles.lintBadgeRed}>
                <X size={20} color="#DC4C4C" strokeWidth={2} />
                <Text style={styles.lintBadgeText}>{lintViolationCount} issues</Text>
                <Text style={styles.lintBadgeSubtext}>{isRepairing ? 'Auto-repairing…' : 'Auto-repaired'}</Text>
              </View>
            )}

            {pipelineReport && pipelineReport.errors.length > 0 && (
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={styles.violationsListTitle}>Remaining Issues:</Text>
                {pipelineReport.errors.map((err, i) => (
                  <Pressable
                    key={i}
                    onPress={() => err.id && setSelectedNodeId(err.id)}
                    style={styles.violationItem}
                  >
                    <Text style={styles.violationRule}>[{err.rule}]</Text>
                    <Text style={styles.violationMessage} numberOfLines={2}>{err.message}</Text>
                    {err.id && <Text style={styles.violationNodeId}>{err.id}</Text>}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── NODE RENDERER ─────────────────────────────────────────────────────────────

function NodeRenderer({ node, brandColor }: { node: any; brandColor?: string }) {
  if (!node) return null;

  const styleObj: any = {};
  const s = node.style || {};

  if (s.backgroundColor) {
    if (s.backgroundColor === '$primary') styleObj.backgroundColor = brandColor || colors.primary;
    else if (s.backgroundColor === '$background') styleObj.backgroundColor = '#12141D';
    else if (s.backgroundColor === '$surface') styleObj.backgroundColor = '#1C1E2B';
    else styleObj.backgroundColor = s.backgroundColor;
  }
  if (s.color) {
    if (s.color === '$primary') styleObj.color = brandColor || colors.primary;
    else if (s.color === '$text') styleObj.color = '#FFFFFF';
    else if (s.color === '$textSecondary') styleObj.color = '#9BA1B7';
    else styleObj.color = s.color;
  }
  if (s.borderRadius !== undefined) styleObj.borderRadius = s.borderRadius;
  if (s.borderWidth !== undefined) styleObj.borderWidth = s.borderWidth;
  if (s.borderColor) styleObj.borderColor = s.borderColor === '$border' ? colors.border : s.borderColor;
  if (s.fontSize !== undefined) styleObj.fontSize = s.fontSize;
  if (s.fontWeight !== undefined) styleObj.fontWeight = s.fontWeight;
  if (s.padding !== undefined) styleObj.padding = s.padding;

  if (node.sizing?.width?.mode === 'fill') styleObj.flex = 1;
  else if (node.sizing?.width?.mode === 'fixed') styleObj.width = node.sizing.width.value;

  if (node.sizing?.height?.mode === 'fixed') styleObj.height = node.sizing.height.value;

  if (node.layout) {
    styleObj.flexDirection = node.layout.direction || 'column';
    styleObj.gap = node.layout.gap || 0;
    if (node.layout.padding) {
      styleObj.paddingTop = node.layout.padding.top || 0;
      styleObj.paddingRight = node.layout.padding.right || 0;
      styleObj.paddingBottom = node.layout.padding.bottom || 0;
      styleObj.paddingLeft = node.layout.padding.left || 0;
    }
  }

  const props = node.props || {};

  switch (node.type) {
    case 'text':
      return <Text style={[{ fontSize: 14, color: '#30343B' }, styleObj]}>{props.content || 'Text'}</Text>;
    case 'button':
      return (
        <View style={[{ backgroundColor: brandColor || colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, styleObj]}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{props.label || 'Button'}</Text>
        </View>
      );
    case 'input':
      return (
        <View style={[{ backgroundColor: '#1A1D29', borderRadius: 10, borderWidth: 1, borderColor: '#2E3347', paddingHorizontal: 14, paddingVertical: 10 }, styleObj]}>
          <Text style={{ color: '#777B82', fontSize: 13 }}>{props.placeholder || 'Enter text...'}</Text>
        </View>
      );
    case 'icon':
      return <Zap size={props.size || 20} color={styleObj.color || '#94A3B8'} strokeWidth={1.8} />;
    case 'avatar':
      return <View style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#2E3347', alignItems: 'center', justifyContent: 'center' }, styleObj]}><Smartphone size={17} color="#D6DBE5" strokeWidth={1.8} /></View>;
    case 'badge':
    case 'chip':
      return (
        <View style={[{ backgroundColor: '#2E3347', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }, styleObj]}>
          <Text style={{ fontSize: 11, color: colors.primary }}>{props.label || props.content || 'Badge'}</Text>
        </View>
      );
    case 'image':
      return (
        <View style={[{ backgroundColor: '#1E2230', borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 100 }, styleObj]}>
          {props.src && (props.src.startsWith('http') || props.src.startsWith('data:')) ? (
            <Image source={{ uri: props.src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ImageIcon size={14} color="#777B82" /><Text style={{ color: '#777B82', fontSize: 12 }}>Image Placeholder</Text></View>
          )}
        </View>
      );
    default:
      return (
        <View style={styleObj}>
          {(node.children || []).map((child: any) => (
            <NodeRenderer key={child.id} node={child} brandColor={brandColor} />
          ))}
        </View>
      );
  }
}

function inferScreenName(html: string, fallback: string): string {
  let candidate = '';
  if (typeof DOMParser !== 'undefined' && html.trim()) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('.screen') ?? doc.body;
    const title = root.querySelector('[data-role="app-bar"] h1, [data-role="app-bar"] h2, header h1, header h2, h1, h2, h3');
    candidate = title?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }
  if (!candidate) candidate = fallback;
  candidate = candidate.replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
  if (candidate.length > 34) candidate = candidate.slice(0, 31).trimEnd() + '…';
  return candidate || 'New screen';
}

function buildLocalParentContext(node: HTMLElement): string {
  const parent = node.parentElement;
  if (!parent) return 'Selected component is at the screen root.';
  const siblings = Array.from(parent.children)
    .filter((child) => child !== node)
    .slice(0, 6)
    .map((child) => ({
      tag: child.tagName.toLowerCase(),
      classes: Array.from(child.classList).slice(0, 5),
      role: child.getAttribute('data-role') || undefined,
      label: (child.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 72) || undefined,
    }));
  return JSON.stringify({
    parent: {
      tag: parent.tagName.toLowerCase(),
      classes: Array.from(parent.classList).slice(0, 8),
      role: parent.getAttribute('data-role') || undefined,
    },
    selectedPosition: `${Array.from(parent.children).indexOf(node) + 1} of ${parent.children.length}`,
    nearbySiblings: siblings,
  });
}

function preserveUnselectedComponents(
  target: { id: string; name: string; screenHtml: string; path: number[] },
  generatedHtml: string,
): string {
  if (typeof DOMParser === 'undefined') return generatedHtml;
  const parser = new DOMParser();
  const originalDoc = parser.parseFromString(target.screenHtml, 'text/html');
  const generatedDoc = parser.parseFromString(generatedHtml, 'text/html');
  const originalRoot = originalDoc.querySelector('.screen');
  if (!originalRoot) return target.screenHtml;
  const generatedRoot = generatedDoc.querySelector('.screen');

  const findTarget = (root: Element): Element | null => {
    const elements = Array.from(root.querySelectorAll('[data-tz-id], [data-tz-name]'));
    return elements.find((el) => el.getAttribute('data-tz-id') === target.id)
      ?? elements.find((el) => el.getAttribute('data-tz-name') === target.name)
      ?? null;
  };
  const generatedTarget = generatedRoot
    ? findTarget(generatedRoot)
    : generatedDoc.body.firstElementChild;
  if (originalRoot.getAttribute('data-tz-id') === target.id) {
    if (!generatedTarget) return target.screenHtml;
    const replacement = generatedTarget.cloneNode(true) as Element;
    replacement.setAttribute('data-tz-id', target.id);
    return replacement.outerHTML;
  }
  const originalTarget = findTarget(originalRoot);
  let replacementTarget = generatedTarget;
  if (!originalTarget) return target.screenHtml;

  if (!replacementTarget && generatedRoot) {
    let cursor: Element | null = generatedRoot;
    for (const index of target.path) {
      cursor = cursor?.children.item(index) ?? null;
      if (!cursor) break;
    }
    replacementTarget = cursor;
  }
  if (!replacementTarget) return target.screenHtml;

  const replacement = replacementTarget.cloneNode(true) as Element;
  replacement.setAttribute('data-tz-id', target.id);
  originalTarget.replaceWith(replacement);
  return originalRoot.outerHTML;
}

function getDeviceDimensions(project: ProjectMeta): string {
  const dims: Record<string, string> = {
    'mobile-ios': '393×852',
    'mobile-android': '360×800',
    tablet: '820×1180',
    desktop: '1440×900',
  };
  if (project.device === 'custom') {
    return `${project.customWidth ?? 1280}×${project.customHeight ?? 800}`;
  }
  return dims[project.device] ?? '393×852';
}

function resolvePromptAccent(prompt: string, fallback: string): string {
  const hex = prompt.match(/(?:^|\s)(#[\da-f]{3}(?:[\da-f]{3})?)(?=$|\s|[,.;])/i)?.[1];
  if (hex) return hex.toUpperCase();
  const colorsByName: Array<[RegExp, string]> = [
    [/\b(?:indigo|deep blue)\b/i, '#3F51B5'],
    [/\b(?:navy|blue|cyan|sky)\b/i, '#1976D2'],
    [/\b(?:teal|turquoise)\b/i, '#008577'],
    [/\b(?:green|mint|emerald)\b/i, '#2E7D32'],
    [/\b(?:lime|olive)\b/i, '#687F00'],
    [/\b(?:yellow|gold|amber)\b/i, '#9A6700'],
    [/\b(?:orange|coral)\b/i, '#C45100'],
    [/\b(?:red|crimson|maroon)\b/i, '#BA1A1A'],
    [/\b(?:pink|rose|magenta)\b/i, '#B52C68'],
    [/\b(?:purple|violet|lavender)\b/i, '#6750A4'],
    [/\b(?:brown|coffee|terracotta)\b/i, '#795548'],
    [/\b(?:gray|grey|slate|monochrome)\b/i, '#5F6368'],
  ];
  const namedColor = colorsByName.find(([pattern]) => pattern.test(prompt));
  if (namedColor) return namedColor[1];

  // For prompts without an explicit color, use a restrained M3 seed that fits
  // common product domains instead of carrying TezMind's unrelated default.
  const semanticColors: Array<[RegExp, string]> = [
    [/\b(?:bank|finance|payment|wallet|business|productivity|analytics)\b/i, '#35618F'],
    [/\b(?:health|fitness|wellness|nature|garden|eco|sustainab)\b/i, '#386A20'],
    [/\b(?:food|restaurant|recipe|travel|music|event)\b/i, '#9A4C00'],
    [/\b(?:beauty|fashion|creative|art|community|social)\b/i, '#76508F'],
  ];
  return semanticColors.find(([pattern]) => pattern.test(prompt))?.[1] || fallback;
}

function resolvePromptColorScheme(prompt: string): 'light' | 'dark' {
  if (/\b(?:dark mode|dark theme|night mode|midnight|oled|black background)\b/i.test(prompt)) return 'dark';
  return 'light';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  loadingText: { color: colors.textSecondary, fontSize: typography.fontSize.md },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  errorEmoji: { fontSize: 40 },
  errorTitle: { fontSize: typography.fontSize['2xl'], color: colors.text, fontWeight: typography.fontWeight.bold },
  backBtn: { paddingHorizontal: spacing[5], paddingVertical: spacing[2.5], borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backBtnText: { color: colors.textSecondary, fontSize: typography.fontSize.sm },

  // Header
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
    height: 58,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  homeBtn: { paddingHorizontal: spacing[2] },
  homeBtnText: { fontSize: typography.fontSize.sm, color: colors.primary, fontWeight: typography.fontWeight.semibold },
  titleDivider: { width: 1, height: 16, backgroundColor: colors.border },
  projectName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold, color: colors.text },
  topBarCenter: { flexDirection: 'row', alignItems: 'center' },
  tabGroup: { flexDirection: 'row', backgroundColor: colors.bgInput, borderRadius: radii.lg, padding: 3 },
  tabBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radii.md },
  tabBtnActive: { backgroundColor: colors.surface },
  tabBtnText: { fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.medium },
  tabBtnTextActive: { color: colors.text, fontWeight: typography.fontWeight.semibold },
  topBarRight: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  settingsHeaderBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  historyActionDisabled: { opacity: 0.55 },
  settingsHeaderBtnText: { fontSize: typography.fontSize.xs, color: colors.textSecondary },
  devicePill: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radii.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  devicePillText: { fontSize: typography.fontSize.xs, color: colors.textSecondary },
  exportHeaderBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: radii.md, backgroundColor: colors.primary },
  exportHeaderBtnText: { fontSize: typography.fontSize.xs, color: '#fff', fontWeight: typography.fontWeight.semibold },

  // Studio Main
  main: { flex: 1, flexDirection: 'row' },

  // Left Panel
  screensStrip: {
    width: 184, backgroundColor: '#FAFAFA',
    borderRightWidth: 1, borderRightColor: '#E8E8E8',
    padding: spacing[3], gap: spacing[3],
  },
  panelTitle: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  screenThumbSelected: {
    padding: spacing[2.5], borderRadius: radii.xl,
    backgroundColor: colors.primaryMuted, borderWidth: 1.5, borderColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[2],
  },
  screenThumbUnselected: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  screenMiniCard: { width: 28, height: 36, borderRadius: radii.sm, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  screenThumbIcon: { fontSize: 16 },
  screenThumbLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text, flex: 1 },
  screenThumbLabelUnselected: { color: colors.textSecondary, fontWeight: typography.fontWeight.regular },
  addScreenBtn: {
    paddingVertical: spacing[2.5], borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', marginTop: spacing[1],
  },
  addScreenBtnText: { fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium },
  stylesSection: { marginTop: spacing[4], gap: spacing[2] },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  styleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: colors.surface },
  styleBadgeText: { fontSize: 10, color: colors.textSecondary },

  // ── Split Code / IDE Layout ───────────────────────────────────────────────
  codeExportSplitContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#0D1117' },

  // LEFT — live preview panel
  codePreviewHalf: {
    width: '40%', backgroundColor: '#0D1117', flexDirection: 'column',
    borderRightWidth: 1, borderRightColor: '#21262D',
    padding: spacing[3], gap: spacing[2],
  },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: '#21262D',
  },
  previewHeaderLeft: { gap: 2 },
  previewHeaderTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: '#C9D1D9' },
  previewHeaderSubtitle: { fontSize: 11, color: '#8B949E' },
  codePreviewCanvasBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // RIGHT — Monaco IDE panel
  codeEditorHalf: {
    width: '60%', backgroundColor: '#0D1117', flexDirection: 'column',
    borderLeftWidth: 1, borderLeftColor: '#21262D',
  },

  // IDE title bar
  ideTitleBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161B22', borderBottomWidth: 1, borderBottomColor: '#21262D',
    paddingLeft: spacing[3], height: 40, gap: spacing[2],
  },
  ideWindowDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  windowDot: { width: 12, height: 12, borderRadius: 6 },
  // File tabs
  ideTabRow: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  ideTab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[3], height: 40,
    backgroundColor: '#161B22',
    borderRightWidth: 1, borderRightColor: '#21262D',
    borderTopWidth: 2, borderTopColor: 'transparent',
  },
  ideTabActive: {
    backgroundColor: '#0D1117', borderTopColor: '#0078D4',
  },
  ideTabText: { fontSize: 12, color: '#8B949E', fontWeight: '400', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  ideTabTextActive: { color: '#C9D1D9', fontWeight: '500' },
  ideTabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0078D4' },
  // Actions
  ideActions: { flexDirection: 'row', gap: spacing[1.5], paddingHorizontal: spacing[2] },
  ideActionBtn: {
    paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
    borderRadius: radii.sm, backgroundColor: '#21262D',
    borderWidth: 1, borderColor: '#30363D',
  },
  ideActionBtnText: { fontSize: 11, color: '#8B949E', fontWeight: '500' },
  // Editor body
  ideEditorBody: { flex: 1, overflow: 'hidden' },
  codeEditorInput: {
    flex: 1, backgroundColor: '#0D1117', color: '#C9D1D9',
    fontFamily: Platform.OS === 'web' ? 'monospace, Consolas, Courier' : 'monospace',
    fontSize: 13, lineHeight: 22, padding: spacing[3], textAlignVertical: 'top',
  },
  // Status bar (VS Code blue bar at the bottom)
  ideStatusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0078D4', paddingHorizontal: spacing[3], height: 22, gap: spacing[4],
  },
  ideStatusText: { fontSize: 11, color: '#FFFFFF', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },

  // Center Canvas
  canvas: { flex: 1, backgroundColor: '#F7F7F8', position: 'relative' },
  canvasScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  screenFrameContainer: {
    borderRadius: 48,
    backgroundColor: '#000000',
    borderWidth: 6,
    borderColor: '#242735',
    overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08)' as any,
    position: 'relative',
    alignItems: 'center',
  },
  phoneStatusBar: {
    width: '100%',
    height: 44,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
  },
  phoneTimeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dynamicIslandPill: {
    width: 96,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1D202B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraLensDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#121520',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  sensorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0A0C14',
  },
  phoneStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneStatusIcon: {
    fontSize: 12,
  },
  phoneStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  screenCanvasInner: {
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  phoneHomeBarContainer: {
    width: '100%',
    height: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneHomeBar: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  screenEmptyState: { alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[6], paddingVertical: spacing[12] },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: typography.fontSize.xs, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  imageRefBox: { marginTop: spacing[3], alignItems: 'center', gap: spacing[2] },
  imageRefLabel: { fontSize: typography.fontSize.xs, color: colors.primary, fontWeight: typography.fontWeight.semibold },
  imageRefThumb: { width: 180, height: 120, borderRadius: radii.md, backgroundColor: '#000' },

  // Banners
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#EF4444',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
    borderRadius: radii.xl, marginBottom: spacing[2], width: '100%',
    gap: spacing[2],
  },
  errorBannerText: { flex: 1, fontSize: typography.fontSize.xs, color: '#EF4444', fontWeight: typography.fontWeight.semibold },
  openSettingsBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radii.md, backgroundColor: '#EF4444',
  },
  openSettingsBtnText: { fontSize: typography.fontSize.xs, color: '#fff', fontWeight: typography.fontWeight.bold },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radii.xl, marginBottom: spacing[2], width: '100%',
  },
  statusBannerText: { fontSize: typography.fontSize.xs, color: colors.primary, fontWeight: typography.fontWeight.medium },

  // Model Popover Menu (Matching Screenshot)
  modelPopoverContainer: { width: '100%', maxWidth: 380, maxHeight: 440, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E4E4E7', padding: spacing[3], boxShadow: '0 24px 70px rgba(15,23,42,0.2)' as any },
  modelPopoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: '#EEEEF0', marginBottom: spacing[2] },
  modelPopoverTitle: { fontSize: 11, fontWeight: '700', color: '#777B82', textTransform: 'uppercase', letterSpacing: 0.8 },
  closePopoverBtn: { fontSize: 14, color: '#777B82', paddingHorizontal: 4 },
  modelMenuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[2], paddingHorizontal: spacing[2.5], borderRadius: radii.md,
  },
  modelMenuItemSelected: { backgroundColor: '#E8F7F2' },
  modelMenuItemText: { fontSize: 13, color: '#555B63' },
  modelMenuItemTextSelected: { color: '#087F63', fontWeight: '600' },
  modelBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modelBadgePill: { backgroundColor: '#F1F2F3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  modelBadgePillText: { fontSize: 10, color: '#777B82', fontWeight: '500' },
  modelBadgeInfo: { fontSize: 11, color: '#777B82' },

  // ── Floating AI Magic Icon at Bottom Right ──────────────────────────────────
  floatingAiMagicPill: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E212B',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#3D4466',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(108, 92, 231, 0.3)' as any,
    zIndex: 100,
    cursor: 'pointer' as any,
  },
  floatingSparkleCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(108, 92, 231, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingSparkleEmoji: {
    fontSize: 15,
  },
  floatingAiMagicText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  modalLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 300 },
  modalScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15, 23, 42, 0.38)' },
  historyCard: { width: '100%', maxWidth: 520, maxHeight: '82%', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E4E4E7', padding: 20, gap: 16, boxShadow: '0 24px 70px rgba(15,23,42,0.2)' as any },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#E8F7F2', alignItems: 'center', justifyContent: 'center' },
  historyTitle: { color: '#202123', fontSize: 16, fontWeight: '700' },
  historySubtitle: { color: '#697078', fontSize: 12, marginTop: 2 },
  historyList: { flexShrink: 1, minHeight: 80 },
  historySectionLabel: { color: '#8A8F98', fontSize: 10, fontWeight: '700', letterSpacing: 0.9, marginTop: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FCFCFD' },
  historyEntryCopy: { flex: 1, minWidth: 0, gap: 4 },
  historyEntryTitle: { color: '#202123', fontSize: 13, fontWeight: '600' },
  historyEntryPrompt: { color: '#697078', fontSize: 11, lineHeight: 16 },
  historyEntryDate: { color: '#697078', fontSize: 11 },
  historyRestoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: '#E8F7F2' },
  historyRestoreText: { color: '#087F63', fontSize: 12, fontWeight: '600' },
  actionLogRow: { padding: 11, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 11, backgroundColor: '#FCFCFD', gap: 4 },
  actionLogTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionLogKind: { color: '#7252C7', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  historyEmpty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 18 },
  historyEmptyTitle: { color: '#202123', fontSize: 14, fontWeight: '600' },
  historyEmptyCopy: { color: '#697078', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  progressLayer: { zIndex: 310 },
  selectionEditEyebrow: { color: '#8A8F98', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  selectionEditDescription: { color: '#666666', fontSize: 13, lineHeight: 19 },
  selectionEditAuto: { backgroundColor: '#F0F9F6', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 },
  selectionEditAutoText: { color: '#087F63', fontSize: 12, fontWeight: '600' },
  progressCard: { width: '100%', maxWidth: 440, padding: 24, gap: 16, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', boxShadow: '0 24px 70px rgba(15,23,42,0.2)' as any },
  progressBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  progressSparkle: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#E8F7F2', alignItems: 'center', justifyContent: 'center' },
  progressSparkleText: { color: '#10A37F', fontSize: 17 },
  progressBrand: { color: '#697078', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  progressTitle: { color: '#202123', fontSize: 21, fontWeight: '700' },
  progressSubtitle: { color: '#73777F', fontSize: 13, lineHeight: 20 },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#E9ECEF' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#10A37F' },
  progressSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressStepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' },
  progressStepDotActive: { backgroundColor: '#10A37F' },
  progressStepText: { color: '#9AA0A6', fontSize: 11 },
  progressStepTextActive: { color: '#202123', fontWeight: '600' },
  selectionEditCard: {
    width: '100%', maxWidth: 540, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 20,
    padding: spacing[5], gap: spacing[3],
    boxShadow: '0 24px 70px rgba(15,23,42,0.22)' as any,
  },
  selectionEditHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionEditTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectionEditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10A37F' },
  selectionEditTitle: { color: '#202123', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  selectionEditClose: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  selectionEditCloseText: { color: '#666666', fontSize: 20, lineHeight: 22 },
  selectionEditInput: { minHeight: 46, maxHeight: 100, padding: 10, borderRadius: 10, backgroundColor: '#F7F7F8', color: '#202123', fontSize: 13, textAlignVertical: 'top' },
  selectionEditActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  selectionEditHint: { color: '#888888', fontSize: 11, flexShrink: 1 },
  selectionEditApply: { backgroundColor: '#10A37F', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9 },
  selectionEditApplyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // ── Floating Prompt Box at Bottom Right ─────────────────────────────────────
  promptBarContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    zIndex: 100,
  },
  promptBarBox: {
    width: '90%',
    maxWidth: 680,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: spacing[3],
    gap: spacing[2],
    flexGrow: 0,
    boxShadow: '0 10px 34px rgba(32, 34, 52, 0.12)' as any,
  },
  promptBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing[1],
    paddingHorizontal: spacing[1],
  },
  promptBarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promptSparkleIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(108, 92, 231, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptBarHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.2,
  },
  promptGeneratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  promptGeneratingText: {
    fontSize: 11,
    color: '#7357D9',
    fontWeight: '600',
  },
  promptCloseIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A2E3D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: '#272B38', borderRadius: radii.lg, padding: spacing[1.5],
    alignSelf: 'flex-start',
  },
  attachedThumb: { width: 24, height: 24, borderRadius: radii.sm },
  attachedText: { fontSize: typography.fontSize.xs, color: colors.textSecondary },
  attachedRemove: { fontSize: 12, color: colors.textTertiary, paddingHorizontal: 4 },

  promptInputArea: ({
    width: '100%', fontSize: typography.fontSize.sm, color: '#202123',
    paddingHorizontal: spacing[2], minHeight: 42, maxHeight: 180, lineHeight: 21,
    flexGrow: 0, flexShrink: 0, textAlignVertical: 'top', outlineStyle: 'none', resize: 'none', overflowY: 'auto',
  } as any),
  promptControlsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing[1],
  },
  promptControlsLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  plusBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2A2E3D', alignItems: 'center', justifyContent: 'center',
  },
  modelPillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: '#2A2E3D', paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: '#363B4E',
  },
  modelPillText: { fontSize: 12, color: '#D0D5E3', fontWeight: '500' },
  promptControlsRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  actionSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center',
  },
  actionSendBtnPressed: { backgroundColor: '#087F5B' },
  actionSendBtnDisabled: { opacity: 0.5 },

  // Right Panel
  inspector: {
    width: 190, backgroundColor: '#FFFFFF',
    borderLeftWidth: 1, borderLeftColor: '#E8E8E8',
    padding: spacing[4], gap: spacing[3],
    overflowY: 'auto' as any,
  },
  inspectorCard: { gap: 4, paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border },
  inspectorLabel: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  inspectorValue: { fontSize: typography.fontSize.sm, color: colors.text, fontWeight: typography.fontWeight.semibold, textTransform: 'capitalize' },
  brandColorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  colorChip: { width: 14, height: 14, borderRadius: 7 },

  // ── Token Usage styles ──────────────────────────────────────────────────────
  tokenUsageSection: {
    marginTop: spacing[2],
    borderRadius: radii.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing[3],
    gap: spacing[2],
  },
  tokenUsageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  tokenUsageTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#7357D9',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tokenUsageBody: { gap: 4 },
  tokenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tokenRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tokenDot: { width: 8, height: 8, borderRadius: 4 },
  tokenLabel: { fontSize: 11, color: '#777B82', fontWeight: '500' },
  tokenCount: { fontSize: 11, color: '#30343B', fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  tokenBarTrack: {
    height: 4,
    backgroundColor: '#ECEEF0',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  tokenBarFill: {
    height: 4,
    borderRadius: 2,
  },
  tokenSummaryRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  tokenSummaryChip: {
    flex: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    padding: spacing[2],
    alignItems: 'center',
    gap: 2,
  },
  tokenSummaryLabel: {
    fontSize: 9,
    color: '#777B82',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tokenSummaryValue: {
    fontSize: 12,
    color: '#7357D9',
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  tokenEmptyState: {
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  tokenEmptyText: {
    fontSize: 11,
    color: '#777B82',
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Layout Health styles ───────────────────────────────────────────────────
  lintHealthSection: {
    marginTop: spacing[2],
    borderRadius: radii.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing[3],
    gap: spacing[2],
  },
  lintHealthTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#087F63',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lintBadgeGreen: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    padding: spacing[3],
    alignItems: 'center',
    gap: 4,
  },
  lintBadgeAmber: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    padding: spacing[3],
    alignItems: 'center',
    gap: 4,
  },
  lintBadgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: spacing[3],
    alignItems: 'center',
    gap: 4,
  },
  lintBadgeIcon: {
    fontSize: 20,
    color: '#30343B',
  },
  lintBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#30343B',
  },
  lintBadgeSubtext: {
    fontSize: 10,
    color: '#777B82',
    textAlign: 'center',
  },

  // ── Brief Card styles (Contract v2) ────────────────────────────────────────
  briefCard: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: spacing[4],
    marginBottom: spacing[2],
    gap: spacing[3],
    boxShadow: '0 24px 70px rgba(15,23,42,0.2)' as any,
  },
  briefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  briefHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  briefArchetypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: '#F1EDFF',
    borderWidth: 1,
    borderColor: '#D9CCFF',
  },
  briefArchetypeText: {
    fontSize: 11,
    color: '#6849D6',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  briefTitle: {
    fontSize: typography.fontSize.sm,
    color: '#202123',
    fontWeight: typography.fontWeight.bold,
  },
  briefPromptInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#CBD2DC',
    color: '#202123',
    fontSize: 13,
    lineHeight: 20,
    padding: spacing[3],
    minHeight: 112,
    maxHeight: 240,
    textAlignVertical: 'top',
  },
  briefSectionLabel: {
    fontSize: 11,
    color: '#59616D',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  requiredRolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  requiredRoleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F7F7F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  roleLockIcon: {
    fontSize: 10,
  },
  roleChipText: {
    fontSize: 11,
    color: '#555B63',
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  briefActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  briefBtnPrimary: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  briefBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  briefBtnSecondary: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#D9DDE4',
  },
  briefBtnSecondaryText: {
    color: '#424750',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },

  // Layout health extra badges
  recoveredBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  recoveredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93C5FD',
  },
  rolesVerifiedBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  rolesVerifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#34D399',
  },
  violationsListTitle: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  violationItem: {
    backgroundColor: '#1E1520',
    padding: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#3D2028',
    gap: 2,
  },
  violationRule: {
    fontSize: 9,
    color: '#F87171',
    fontWeight: '700',
  },
  violationMessage: {
    fontSize: 11,
    color: '#FECACA',
  },
  violationNodeId: {
    fontSize: 9,
    color: '#777B82',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});
