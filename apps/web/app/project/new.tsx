/**
 * Create Project & Build Screen Page
 * 
 * Features:
 * - Project details input (Name, Description)
 * - Screen size & target device options (Mobile iOS, Mobile Android, Tablet, Desktop, Custom)
 * - Prompt Placer with one-click quick prompt preset chips
 * - Working Image Picker & Dropzone for sketches/wireframes/screenshots
 * - Visual style tags, brand color swatch, and AI model selection
 * - Action button: "Build Screen & Open Editor"
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { colors, typography, spacing, radii, shadows } from '../../design/tokens';
import { useProjectStore } from '../../store/useProjectStore';
import type { DevicePreset } from '@tezmind/core';

const DEVICE_OPTIONS: { id: DevicePreset; label: string; desc: string; emoji: string; w: number; h: number }[] = [
  { id: 'mobile-ios', label: 'Mobile (iOS)', desc: '393 × 852', emoji: '📱', w: 393, h: 852 },
  { id: 'mobile-android', label: 'Mobile (Android)', desc: '360 × 800', emoji: '📱', w: 360, h: 800 },
  { id: 'tablet', label: 'Tablet', desc: '820 × 1180', emoji: '⬜', w: 820, h: 1180 },
  { id: 'desktop', label: 'Desktop', desc: '1440 × 900', emoji: '🖥️', w: 1440, h: 900 },
  { id: 'custom', label: 'Custom', desc: 'Any size', emoji: '⚡', w: 0, h: 0 },
];

const PRESET_PROMPTS = [
  { label: '💳 Crypto Wallet', prompt: 'Crypto wallet home screen with portfolio balance card, quick send/receive action buttons, asset breakdown chart, and recent transaction history list.' },
  { label: '🏃 Fitness Tracker', prompt: 'Fitness tracker dashboard showing daily step count ring, calories burned, active workout summary, and weekly activity progress graphs.' },
  { label: '🛍️ E-Commerce Shop', prompt: 'Modern e-commerce storefront with hero promo banner, category pill filters, featured product grid with price tags, and bottom nav bar.' },
  { label: '🍔 Food Delivery', prompt: 'Food delivery app home screen with top search bar, delivery address header, category icons, top rated restaurant cards, and deal banners.' },
  { label: '📊 SaaS Dashboard', prompt: 'SaaS analytics overview dashboard with sidebar navigation, metric stat cards (MRR, Users, Conversion), and revenue chart widget.' },
];

const STYLE_TAGS = ['Minimalist', 'Dark Mode', 'Glassmorphism', 'Modern Fintech', 'Vibrant Neon', 'Clean Corporate', 'Soft Pastel'];

const PROVIDER_OPTIONS = [
  { id: 'anthropic', label: 'Claude (Anthropic)', emoji: '🤖' },
  { id: 'google', label: 'Gemini (Google)', emoji: '♊' },
  { id: 'openai', label: 'GPT-4o (OpenAI)', emoji: '⚡' },
  { id: 'openrouter', label: 'OpenRouter', emoji: '🔀' },
];

export default function NewProjectScreen() {
  const { width } = useWindowDimensions();
  const { createProject } = useProjectStore();
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [device, setDevice] = useState<DevicePreset>('mobile-ios');
  const [customWidth, setCustomWidth] = useState('1280');
  const [customHeight, setCustomHeight] = useState('800');
  
  // Prompt Placer State
  const [promptText, setPromptText] = useState('');
  
  // Image Picker State
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);

  // Style & Model Options State
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['Dark Mode', 'Minimalist']);
  const [brandColor, setBrandColor] = useState('#7C5CFC');
  const [provider, setProvider] = useState('anthropic');
  const [modelId, setModelId] = useState('');

  // Image Picker Trigger
  const handlePickImage = useCallback(() => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
              setImageUri(result);
              setImageName(file.name);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  }, []);

  const toggleStyleTag = (tag: string) => {
    if (selectedStyles.includes(tag)) {
      setSelectedStyles(selectedStyles.filter((s) => s !== tag));
    } else {
      setSelectedStyles([...selectedStyles, tag]);
    }
  };

  const handleBuildScreen = async () => {
    const finalName = name.trim() || (promptText.trim() ? promptText.trim().slice(0, 30) : 'My New Screen');
    const finalDesc = description.trim() || promptText.trim() || 'AI Generated UI Project';

    setIsCreating(true);
    try {
      const project = await createProject({
        name: finalName,
        description: finalDesc,
        idea: promptText.trim() || undefined,
        device,
        customWidth: device === 'custom' ? Number(customWidth) || 1280 : undefined,
        customHeight: device === 'custom' ? Number(customHeight) || 800 : undefined,
        styleKeywords: selectedStyles,
        brandColor: brandColor.match(/^#[0-9a-fA-F]{6}$/) ? brandColor : '#7C5CFC',
        defaultProvider: provider,
        defaultModelId: modelId.trim() || undefined,
        initialPrompt: promptText.trim() || undefined,
        initialImageUri: imageUri || undefined,
      });

      router.replace(`/project/${project.id}/editor`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Home</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Create Project & Build Screen</Text>
        <View style={styles.keyBadge}>
          <Text style={styles.keyBadgeText}>🔑 BYOK Ready</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator={false}>
        <View style={[styles.mainLayout, width >= 1024 && styles.mainLayoutWide]}>

          {/* Left Column — Prompt Placer & Image Picker */}
          <View style={styles.primaryColumn}>
            
            {/* Prompt Placer Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionIcon}>💬</Text>
                <View>
                  <Text style={styles.sectionTitle}>Prompt Placer</Text>
                  <Text style={styles.sectionSubtitle}>Describe the UI screen you want TezMind to generate</Text>
                </View>
              </View>

              <TextInput
                style={styles.promptInput}
                placeholder="e.g. A sleek crypto wallet dashboard with balance cards, quick send/receive buttons, line charts, and recent transaction history..."
                placeholderTextColor={colors.textTertiary}
                value={promptText}
                onChangeText={setPromptText}
                multiline
                numberOfLines={5}
              />

              {/* Quick Preset Chips */}
              <Text style={styles.presetHeading}>Popular Prompt Ideas (Tap to fill):</Text>
              <View style={styles.presetsRow}>
                {PRESET_PROMPTS.map((p) => (
                  <Pressable
                    key={p.label}
                    style={({ pressed }) => [
                      styles.presetChip,
                      pressed && styles.presetChipPressed,
                      promptText === p.prompt && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      setPromptText(p.prompt);
                      if (!name) setName(p.label.replace(/^[^\s]+\s/, '') + ' App');
                    }}
                  >
                    <Text style={[styles.presetChipText, promptText === p.prompt && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Image Picker / Wireframe Upload Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionIcon}>🖼️</Text>
                <View>
                  <Text style={styles.sectionTitle}>Image Picker & Reference Upload</Text>
                  <Text style={styles.sectionSubtitle}>Upload a sketch, screenshot, or wireframe to guide screen generation</Text>
                </View>
              </View>

              {imageUri ? (
                <View style={styles.imagePreviewBox}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                  <View style={styles.imageMetaRow}>
                    <Text style={styles.imageNameText} numberOfLines={1}>{imageName || 'Uploaded Reference Image'}</Text>
                    <Pressable
                      style={styles.removeImageBtn}
                      onPress={() => { setImageUri(null); setImageName(null); }}
                    >
                      <Text style={styles.removeImageText}>✕ Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
                  onPress={handlePickImage}
                >
                  <Text style={styles.dropzoneIcon}>📁</Text>
                  <Text style={styles.dropzoneTitle}>Click to pick an image or drop file here</Text>
                  <Text style={styles.dropzoneSub}>Supports PNG, JPG, WebP, SVG screenshots or design wireframes</Text>
                </Pressable>
              )}
            </View>

            {/* Project Details Basics Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitleSmall}>Project Details</Text>
              <View style={styles.fieldRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Project Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. FitTrack App"
                    placeholderTextColor={colors.textTertiary}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Brief description..."
                    placeholderTextColor={colors.textTertiary}
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>
              </View>
            </View>

          </View>

          {/* Right Column — Device Presets & Model Options */}
          <View style={styles.secondaryColumn}>

            {/* Target Screen Size Presets */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitleSmall}>📱 Target Screen Size</Text>
              <View style={styles.deviceGrid}>
                {DEVICE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.deviceCard, device === opt.id && styles.deviceCardSelected]}
                    onPress={() => setDevice(opt.id)}
                  >
                    <Text style={styles.deviceEmoji}>{opt.emoji}</Text>
                    <View style={styles.deviceInfo}>
                      <Text style={[styles.deviceLabel, device === opt.id && styles.deviceLabelSelected]}>{opt.label}</Text>
                      <Text style={styles.deviceDesc}>{opt.desc}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              {device === 'custom' && (
                <View style={styles.customRow}>
                  <TextInput
                    style={[styles.input, styles.customInput]}
                    placeholder="Width"
                    placeholderTextColor={colors.textTertiary}
                    value={customWidth}
                    onChangeText={(v) => setCustomWidth(v.replace(/\D/g, ''))}
                    keyboardType="numeric"
                  />
                  <Text style={styles.customX}>×</Text>
                  <TextInput
                    style={[styles.input, styles.customInput]}
                    placeholder="Height"
                    placeholderTextColor={colors.textTertiary}
                    value={customHeight}
                    onChangeText={(v) => setCustomHeight(v.replace(/\D/g, ''))}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>

            {/* Visual Style & Brand Options */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitleSmall}>🎨 Visual Style & Theme</Text>

              <Text style={styles.subLabel}>Style Tags</Text>
              <View style={styles.tagsWrap}>
                {STYLE_TAGS.map((tag) => {
                  const active = selectedStyles.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[styles.styleTag, active && styles.styleTagActive]}
                      onPress={() => toggleStyleTag(tag)}
                    >
                      <Text style={[styles.styleTagText, active && styles.styleTagTextActive]}>
                        {active ? `✓ ${tag}` : tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.fieldRow, { marginTop: spacing[3] }]}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.subLabel}>Brand Accent Color</Text>
                  <View style={styles.colorInputRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: brandColor }]} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="#7C5CFC"
                      placeholderTextColor={colors.textTertiary}
                      value={brandColor}
                      onChangeText={setBrandColor}
                      maxLength={7}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* AI Model Selection */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitleSmall}>🤖 AI Model Provider</Text>
              <View style={styles.providerGrid}>
                {PROVIDER_OPTIONS.map((p) => (
                  <Pressable
                    key={p.id}
                    style={[styles.providerCard, provider === p.id && styles.providerCardSelected]}
                    onPress={() => setProvider(p.id)}
                  >
                    <Text style={styles.providerEmoji}>{p.emoji}</Text>
                    <Text style={[styles.providerLabel, provider === p.id && styles.providerLabelSelected]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={[styles.input, { marginTop: spacing[3] }]}
                placeholder="Model ID (e.g. claude-3-5-sonnet-20241022 or gemini-1.5-flash)"
                placeholderTextColor={colors.textTertiary}
                value={modelId}
                onChangeText={setModelId}
              />
            </View>

            {/* Main Build Action Button */}
            <Pressable
              style={({ pressed }) => [
                styles.buildBtn,
                pressed && styles.buildBtnPressed,
                isCreating && styles.buildBtnDisabled,
              ]}
              onPress={handleBuildScreen}
              disabled={isCreating}
            >
              <Text style={styles.buildBtnText}>
                {isCreating ? 'Creating Project & Screen...' : '⚡ Build Screen & Open Editor →'}
              </Text>
            </Pressable>

          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  backBtn: { paddingVertical: spacing[1], paddingHorizontal: spacing[2] },
  backBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text },
  keyBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  keyBadgeText: { fontSize: typography.fontSize.xs, color: colors.primary, fontWeight: typography.fontWeight.semibold },

  // Layout
  scrollContent: { flex: 1 },
  scrollInner: { padding: spacing[6], maxWidth: 1280, alignSelf: 'center', width: '100%' },
  mainLayout: { flexDirection: 'column', gap: spacing[6] },
  mainLayoutWide: { flexDirection: 'row', alignItems: 'flex-start' },

  primaryColumn: { flex: 1, gap: spacing[5], width: '100%' },
  secondaryColumn: { width: Platform.OS === 'web' ? 380 : '100%', gap: spacing[5] },

  // Section Cards
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[5],
    gap: spacing[4],
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sectionIcon: { fontSize: 28 },
  sectionTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.text },
  sectionSubtitle: { fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  sectionTitleSmall: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.text },

  // Prompt Placer
  promptInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    fontSize: typography.fontSize.base,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  presetHeading: { fontSize: typography.fontSize.xs, color: colors.textTertiary, fontWeight: typography.fontWeight.medium },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  presetChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipPressed: { opacity: 0.8 },
  presetChipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  presetChipText: { fontSize: typography.fontSize.xs, color: colors.textSecondary, fontWeight: typography.fontWeight.medium },
  presetChipTextActive: { color: colors.primary, fontWeight: typography.fontWeight.semibold },

  // Image Picker & Dropzone
  dropzone: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    backgroundColor: colors.bgInput,
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  dropzonePressed: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  dropzoneIcon: { fontSize: 36 },
  dropzoneTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text },
  dropzoneSub: { fontSize: typography.fontSize.xs, color: colors.textTertiary, textAlign: 'center' },
  imagePreviewBox: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
    padding: spacing[3],
  },
  previewImage: { width: '100%', height: 180, borderRadius: radii.lg, backgroundColor: '#000' },
  imageMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[2] },
  imageNameText: { fontSize: typography.fontSize.xs, color: colors.textSecondary, flex: 1, marginRight: spacing[3] },
  removeImageBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  removeImageText: { fontSize: typography.fontSize.xs, color: '#EF4444', fontWeight: typography.fontWeight.semibold },

  // Inputs
  fieldGroup: { gap: spacing[1.5] },
  fieldRow: { flexDirection: 'row', gap: spacing[3] },
  label: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textSecondary },
  subLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textTertiary },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    fontSize: typography.fontSize.sm,
    color: colors.text,
  },

  // Devices
  deviceGrid: { gap: spacing[2] },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  deviceCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  deviceEmoji: { fontSize: 22 },
  deviceInfo: { flex: 1 },
  deviceLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary },
  deviceLabelSelected: { color: colors.primary },
  deviceDesc: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  customInput: { flex: 1, textAlign: 'center' },
  customX: { color: colors.textTertiary, fontSize: 16 },

  // Visual Styles
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  styleTag: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  styleTagActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  styleTagText: { fontSize: typography.fontSize.xs, color: colors.textSecondary },
  styleTagTextActive: { color: colors.primary, fontWeight: typography.fontWeight.semibold },
  colorInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  colorSwatch: { width: 36, height: 36, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },

  // Models
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  providerCard: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.bgInput,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  providerCardSelected: { borderColor: colors.accent, backgroundColor: 'rgba(0,212,170,0.08)' },
  providerEmoji: { fontSize: 18 },
  providerLabel: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium, color: colors.textSecondary },
  providerLabelSelected: { color: colors.accent, fontWeight: typography.fontWeight.semibold },

  // Build Action Button
  buildBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
  },
  buildBtnPressed: { backgroundColor: colors.primaryDark },
  buildBtnDisabled: { opacity: 0.5 },
  buildBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.extrabold,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
