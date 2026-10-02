/**
 * Editor Screen — Main design canvas & interactive prompt bar
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, Image, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, typography, spacing, radii } from '../../../design/tokens';
import { useProjectStore } from '../../../store/useProjectStore';
import { getDatabase } from '../../../host/database';
import { getSecretStorage } from '../../../host/secrets';
import { getHttpBridge } from '../../../host/http';
import { GoogleProvider, AnthropicProvider, FALLBACK_MODELS, type GenerateRequest, type ModelInfo } from '@tezmind/ai';
import type { ProjectMeta, ScreenRecord } from '@tezmind/core';

type ProviderKey = 'google' | 'anthropic';

interface ModelOption {
  id: string;
  name: string;
  provider: ProviderKey;
}

/** Static fallback used before dynamic load completes */
const STATIC_FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
];

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getProject, loadProjects, updateProject } = useProjectStore();
  const [project, setProject] = useState<ProjectMeta | undefined>(undefined);
  const [screen, setScreen] = useState<ScreenRecord | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic model list
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(STATIC_FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Initial prompt & reference image
  const [promptInput, setPromptInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingKeyProvider, setMissingKeyProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'screen' | 'code' | 'layers'>('screen');
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(STATIC_FALLBACK_MODELS[0]);

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
        // Load initial screen
        const screens = await db.screens.where('projectId').equals(p.id).toArray();
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
          // Use fallback models for the default provider
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

  const handleGenerate = async () => {
    if (!promptInput.trim() && !attachedImage) return;
    if (!project) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setMissingKeyProvider(null);
    setStatusMessage('Checking API key...');

    try {
      const providerId = selectedModel.provider;
      const providerName = providerId === 'google' ? 'Google AI Studio (Gemini)' : providerId === 'anthropic' ? 'Anthropic (Claude)' : providerId;

      // Read key from secret storage
      const secrets = getSecretStorage();
      const token = await secrets.get(`token:${providerId}`);

      if (!token) {
        setIsGenerating(false);
        setStatusMessage(null);
        setMissingKeyProvider(providerName);
        setErrorMessage(`No API key saved for ${providerName}. Please add your key in Settings.`);
        return;
      }

      setStatusMessage(`Generating UI with ${selectedModel.name}...`);

      const http = getHttpBridge();
      const provider = providerId === 'google' ? new GoogleProvider() : new AnthropicProvider();
      // Pass model ID directly — no transformation needed; resolveGoogleModelId in provider handles it
      const modelId = selectedModel.id;

      const abortController = new AbortController();

      const req: GenerateRequest = {
        prompt: promptInput,
        mode: attachedImage ? 'image_to_design' : 'screen',
        imageBase64: attachedImage ? attachedImage.split(',')[1] : undefined,
        imageMimeType: attachedImage ? (attachedImage.split(';')[0].split(':')[1] as any) : undefined,
        projectName: project.name,
        projectDescription: project.description,
        projectIdea: project.idea,
        styleKeywords: project.styleKeywords,
        brandColor: project.brandColor,
        deviceType: project.device,
        deviceWidth: screen?.width || 393,
        deviceHeight: screen?.height || 852,
        modelId,
      };

      for await (const event of provider.generate(req, token, http, abortController.signal)) {
        if (event.type === 'progress') {
          setStatusMessage(event.message ?? null);
        } else if (event.type === 'screens' && event.screens && event.screens.length > 0) {
          const generatedScreen = event.screens[0];
          if (screen) {
            const updatedScreenRecord: ScreenRecord = {
              ...screen,
              rootJson: JSON.stringify(generatedScreen.root),
              updatedAt: Date.now(),
            };
            const db = getDatabase();
            await db.screens.put({ ...updatedScreenRecord, projectId: project.id });
            setScreen(updatedScreenRecord);
          }
        } else if (event.type === 'error') {
          setErrorMessage(event.message ?? 'Generation failed.');
          if (event.code === 'invalid_token') {
            setMissingKeyProvider(providerName);
          }
        } else if (event.type === 'done') {
          setStatusMessage('Generation complete! ✨');
          setTimeout(() => setStatusMessage(null), 3000);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
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
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Project not found</Text>
        <Pressable onPress={() => router.replace('/')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to Home</Text>
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
            <Text style={styles.homeBtnText}>◀ TezMind</Text>
          </Pressable>
          <View style={styles.titleDivider} />
          <Text style={styles.projectName}>{project.name}</Text>
        </View>

        <View style={styles.topBarCenter}>
          <View style={styles.tabGroup}>
            <Pressable
              style={[styles.tabBtn, activeTab === 'screen' && styles.tabBtnActive]}
              onPress={() => setActiveTab('screen')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'screen' && styles.tabBtnTextActive]}>🎨 Screen</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, activeTab === 'code' && styles.tabBtnActive]}
              onPress={() => setActiveTab('code')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'code' && styles.tabBtnTextActive]}>💻 Code Export</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <Pressable onPress={() => router.push('/settings')} style={styles.settingsHeaderBtn}>
            <Text style={styles.settingsHeaderBtnText}>⚙️ Settings</Text>
          </Pressable>
          <View style={styles.devicePill}>
            <Text style={styles.devicePillText}>{project.device} ({dimensionsStr})</Text>
          </View>
          <Pressable style={styles.exportHeaderBtn}>
            <Text style={styles.exportHeaderBtnText}>Export Code</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Studio Area */}
      <View style={styles.main}>
        {/* Left Screens Panel */}
        <View style={styles.screensStrip}>
          <Text style={styles.panelTitle}>Screens</Text>
          <View style={styles.screenThumbSelected}>
            <View style={styles.screenMiniCard}>
              <Text style={styles.screenThumbIcon}>📱</Text>
            </View>
            <Text style={styles.screenThumbLabel}>{screen?.name || 'Screen 1'}</Text>
          </View>

          <Pressable style={styles.addScreenBtn}>
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

        {/* Center Canvas Area */}
        <View style={styles.canvas}>
          <ScrollView
            contentContainerStyle={styles.canvasScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Screen Frame Mockup */}
            <View style={styles.screenFrameContainer}>
              <View style={styles.deviceMockHeader}>
                <View style={styles.notchDot} />
                <Text style={styles.deviceMockTitle}>{screen?.name || 'Screen 1'} — {dimensionsStr}</Text>
                <View style={styles.statusIcons}>
                  <Text style={styles.statusIconText}>📶 🔋</Text>
                </View>
              </View>

              {/* Inner Screen Display */}
              <View style={styles.screenCanvasInner}>
                {parsedRoot ? (
                  <ScrollView style={{ flex: 1, width: '100%' }}>
                    <NodeRenderer node={parsedRoot} brandColor={project.brandColor} />
                  </ScrollView>
                ) : (
                  <View style={styles.screenEmptyState}>
                    <Text style={styles.emptyEmoji}>✨</Text>
                    <Text style={styles.emptyTitle}>Ready to Build Screen</Text>
                    <Text style={styles.emptySubtitle}>
                      {promptInput
                        ? `Target Prompt: "${promptInput}"`
                        : 'Enter a prompt or select a reference image below to generate your UI.'}
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
            </View>
          </ScrollView>

          {/* Model Selector Popover Modal (Matching Screenshot) */}
          {isModelPickerOpen && (
            <View style={styles.modelPopoverContainer}>
              <View style={styles.modelPopoverHeader}>
                <Text style={styles.modelPopoverTitle}>Model</Text>
                <Pressable onPress={() => setIsModelPickerOpen(false)}>
                  <Text style={styles.closePopoverBtn}>✕</Text>
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
                          <Text style={{ fontSize: 12, color: colors.primary }}>✓</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Floating Prompt Box (Matching Screenshot UI) */}
          <View style={styles.promptBarContainer}>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
                {missingKeyProvider && (
                  <Pressable style={styles.openSettingsBtn} onPress={() => router.push('/settings')}>
                    <Text style={styles.openSettingsBtnText}>Open Settings ⚙️</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Status Progress Banner */}
            {statusMessage && !errorMessage && (
              <View style={styles.statusBanner}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.statusBannerText}>{statusMessage}</Text>
              </View>
            )}

            <View style={styles.promptBarBox}>
              {attachedImage && (
                <View style={styles.attachedBadge}>
                  <Image source={{ uri: attachedImage }} style={styles.attachedThumb} />
                  <Text style={styles.attachedText}>Reference Image</Text>
                  <Pressable onPress={() => setAttachedImage(null)}>
                    <Text style={styles.attachedRemove}>✕</Text>
                  </Pressable>
                </View>
              )}

              {/* Upper Text Area */}
              <TextInput
                style={styles.promptInputArea}
                placeholder="Type a prompt to build or update this screen..."
                placeholderTextColor="#7C8092"
                value={promptInput}
                onChangeText={setPromptInput}
                multiline
              />

              {/* Bottom Control Bar */}
              <View style={styles.promptControlsRow}>
                <View style={styles.promptControlsLeft}>
                  {/* + Button */}
                  <Pressable onPress={handlePickNewImage} style={styles.plusBtn}>
                    <Text style={styles.plusBtnIcon}>+</Text>
                  </Pressable>

                  {/* Model Selector Pill */}
                  <Pressable
                    style={styles.modelPillBtn}
                    onPress={() => setIsModelPickerOpen(!isModelPickerOpen)}
                  >
                    <Text style={styles.modelPillText}>{selectedModel.name}</Text>
                    <Text style={styles.modelPillChevron}>ˆ</Text>
                  </Pressable>
                </View>

                <View style={styles.promptControlsRight}>
                  {/* Mic Button */}
                  <Pressable style={styles.micBtn}>
                    <Text style={styles.micBtnIcon}>🎙️</Text>
                  </Pressable>

                  {/* Action Send Button */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionSendBtn,
                      pressed && styles.actionSendBtnPressed,
                      isGenerating && styles.actionSendBtnDisabled,
                    ]}
                    onPress={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionSendIcon}>→</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

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

          {project.brandColor && (
            <View style={styles.inspectorCard}>
              <Text style={styles.inspectorLabel}>Brand Accent</Text>
              <View style={styles.brandColorRow}>
                <View style={[styles.colorChip, { backgroundColor: project.brandColor }]} />
                <Text style={styles.inspectorValue}>{project.brandColor}</Text>
              </View>
            </View>
          )}
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
      return <Text style={[{ fontSize: 14, color: '#E2E8F0' }, styleObj]}>{props.content || 'Text'}</Text>;
    case 'button':
      return (
        <View style={[{ backgroundColor: brandColor || colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, styleObj]}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{props.label || 'Button'}</Text>
        </View>
      );
    case 'input':
      return (
        <View style={[{ backgroundColor: '#1A1D29', borderRadius: 10, borderWidth: 1, borderColor: '#2E3347', paddingHorizontal: 14, paddingVertical: 10 }, styleObj]}>
          <Text style={{ color: '#64748B', fontSize: 13 }}>{props.placeholder || 'Enter text...'}</Text>
        </View>
      );
    case 'icon':
      return <Text style={[{ fontSize: props.size || 20, color: '#94A3B8' }, styleObj]}>⚡</Text>;
    case 'avatar':
      return <View style={[{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#2E3347', alignItems: 'center', justifyContent: 'center' }, styleObj]}><Text>👤</Text></View>;
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
            <Text style={{ color: '#64748B', fontSize: 12 }}>🖼️ Image Placeholder</Text>
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
    backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border,
    height: 54,
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
    width: 200, backgroundColor: colors.bgElevated,
    borderRightWidth: 1, borderRightColor: colors.border,
    padding: spacing[3], gap: spacing[3],
  },
  panelTitle: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.bold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  screenThumbSelected: {
    padding: spacing[2.5], borderRadius: radii.xl,
    backgroundColor: colors.primaryMuted, borderWidth: 1.5, borderColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
  },
  screenMiniCard: { width: 28, height: 36, borderRadius: radii.sm, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  screenThumbIcon: { fontSize: 16 },
  screenThumbLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text },
  addScreenBtn: {
    paddingVertical: spacing[2.5], borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  addScreenBtnText: { fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium },
  stylesSection: { marginTop: spacing[4], gap: spacing[2] },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  styleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: colors.surface },
  styleBadgeText: { fontSize: 10, color: colors.textSecondary },

  // Center Canvas
  canvas: { flex: 1, backgroundColor: colors.canvasBg, position: 'relative' },
  canvasScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
  screenFrameContainer: {
    width: 360, height: 680,
    borderRadius: radii['3xl'],
    backgroundColor: '#0F111A',
    borderWidth: 2, borderColor: colors.border,
    overflow: 'hidden',
  },
  deviceMockHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
    backgroundColor: '#161926', borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  notchDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  deviceMockTitle: { fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium },
  statusIcons: { flexDirection: 'row' },
  statusIconText: { fontSize: 10 },
  screenCanvasInner: { flex: 1, padding: spacing[4], justifyContent: 'center', alignItems: 'center' },
  screenEmptyState: { alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4] },
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
    borderRadius: radii.xl, marginBottom: spacing[2], width: '100%', maxWidth: 720,
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
    borderRadius: radii.xl, marginBottom: spacing[2],
  },
  statusBannerText: { fontSize: typography.fontSize.xs, color: colors.primary, fontWeight: typography.fontWeight.medium },

  // Model Popover Menu (Matching Screenshot)
  modelPopoverContainer: {
    position: 'absolute', bottom: 120, left: spacing[6],
    width: 280, backgroundColor: '#212431', borderRadius: radii.xl,
    borderWidth: 1, borderColor: '#33384B',
    padding: spacing[3], zIndex: 100, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16,
  },
  modelPopoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: '#2E3345', marginBottom: spacing[2] },
  modelPopoverTitle: { fontSize: 11, fontWeight: '700', color: '#8A8F9E', textTransform: 'uppercase', letterSpacing: 0.8 },
  closePopoverBtn: { fontSize: 14, color: '#8A8F9E', paddingHorizontal: 4 },
  modelMenuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[2], paddingHorizontal: spacing[2.5], borderRadius: radii.md,
  },
  modelMenuItemSelected: { backgroundColor: 'rgba(10, 132, 255, 0.15)' },
  modelMenuItemText: { fontSize: 13, color: '#C5CBD9' },
  modelMenuItemTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  modelBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modelBadgePill: { backgroundColor: '#2D3244', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  modelBadgePillText: { fontSize: 10, color: '#8A8F9E', fontWeight: '500' },
  modelBadgeInfo: { fontSize: 11, color: '#8A8F9E' },

  // Floating Prompt Box (Matching Screenshot UI)
  promptBarContainer: {
    position: 'absolute', bottom: spacing[6], left: spacing[6], right: spacing[6],
    alignItems: 'center',
  },
  promptBarBox: {
    width: '100%', maxWidth: 720,
    backgroundColor: '#1E212B', borderRadius: 24,
    borderWidth: 1.5, borderColor: '#2E3345',
    padding: spacing[3], gap: spacing[2],
  },
  attachedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: '#272B38', borderRadius: radii.lg, padding: spacing[1.5],
    alignSelf: 'flex-start',
  },
  attachedThumb: { width: 24, height: 24, borderRadius: radii.sm },
  attachedText: { fontSize: typography.fontSize.xs, color: colors.textSecondary },
  attachedRemove: { fontSize: 12, color: colors.textTertiary, paddingHorizontal: 4 },

  promptInputArea: {
    width: '100%', fontSize: typography.fontSize.sm, color: '#FFFFFF',
    paddingHorizontal: spacing[2], minHeight: 40, maxHeight: 90,
  },
  promptControlsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: spacing[1],
  },
  promptControlsLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  plusBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2A2E3D', alignItems: 'center', justifyContent: 'center',
  },
  plusBtnIcon: { fontSize: 18, color: '#9DA4B7', fontWeight: '300' },
  modelPillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: '#2A2E3D', paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: '#363B4E',
  },
  modelPillText: { fontSize: 12, color: '#D0D5E3', fontWeight: '500' },
  modelPillChevron: { fontSize: 10, color: '#9DA4B7' },
  promptControlsRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  micBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnIcon: { fontSize: 16 },
  actionSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center',
  },
  actionSendBtnPressed: { backgroundColor: '#0066CC' },
  actionSendBtnDisabled: { opacity: 0.5 },
  actionSendIcon: { fontSize: 16, color: '#FFFFFF', fontWeight: 'bold' },

  // Right Panel
  inspector: {
    width: 220, backgroundColor: colors.bgElevated,
    borderLeftWidth: 1, borderLeftColor: colors.border,
    padding: spacing[4], gap: spacing[3],
  },
  inspectorCard: { gap: 4, paddingBottom: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border },
  inspectorLabel: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  inspectorValue: { fontSize: typography.fontSize.sm, color: colors.text, fontWeight: typography.fontWeight.semibold, textTransform: 'capitalize' },
  brandColorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  colorChip: { width: 14, height: 14, borderRadius: 7 },
});
