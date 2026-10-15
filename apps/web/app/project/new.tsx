import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Sparkles, Smartphone, Palette } from 'lucide-react-native';
import { colors } from '../../design/tokens';
import { useProjectStore } from '../../store/useProjectStore';
import type { DevicePreset, PaletteOption } from '@tezmind/core';
import { UI_KIT_OPTIONS, parseHints, composePaletteOptions, researchPaletteReferences } from '@tezmind/ai';
import type { PaletteResearchResult } from '@tezmind/ai';
import { getSecretStorage } from '../../host/secrets';
import { getHttpBridge } from '../../host/http';
import { getSetting, setSetting } from '../../host/database';

export default function NewProjectScreen() {
  const { createProject } = useProjectStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [userHints, setUserHints] = useState('');
  const [device, setDevice] = useState<DevicePreset>('mobile-ios');
  const [designMode, setDesignMode] = useState<'auto' | 'seed'>('auto');
  const [selectedKitId, setSelectedKitId] = useState<string>(UI_KIT_OPTIONS[0]?.id || 'minimal');
  const [isCreating, setIsCreating] = useState(false);
  const [paletteStep, setPaletteStep] = useState(false);
  const [paletteMode, setPaletteMode] = useState<'light' | 'dark'>('light');
  const [paletteOptions, setPaletteOptions] = useState<PaletteOption[]>([]);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(0);
  const [isPaletteResearching, setIsPaletteResearching] = useState(false);
  const [paletteResearch, setPaletteResearch] = useState<PaletteResearchResult | undefined>();

  const selectedKit = UI_KIT_OPTIONS.find((kit) => kit.id === selectedKitId) || UI_KIT_OPTIONS[0];
  const updatePaletteColor = (role: 'primary' | 'accent', value: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    const updated = value.toUpperCase();
    const contrast = (hexA: string, hexB: string) => {
      const lum = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const [light, dark] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
      return (light + 0.05) / (dark + 0.05);
    };
    setPaletteOptions((current) => current.map((option, index) => index !== selectedPaletteIndex ? option : {
      ...option,
      source: 'hint',
      colors: {
        ...option.colors,
        [role]: updated,
        ...(role === 'primary' ? { onPrimary: contrast('#FFFFFF', updated) >= contrast('#111318', updated) ? '#FFFFFF' : '#111318' } : {}),
      },
    }));
  };

  const create = async (paletteIndex = selectedPaletteIndex) => {
    if (!name.trim() || isCreating) return;
    const parsed = parseHints(`${description} ${userHints}`);
    const provisional = { name: name.trim(), description: description.trim(), idea: description.trim() || undefined, designMode, parsedHints: parsed };
    const paletteModeForProject = parsed?.mode || paletteMode;
    let paletteResult = composePaletteOptions({ project: provisional, prompt: description.trim(), mode: paletteModeForProject, research: paletteStep ? paletteResearch : undefined });
    // In Auto Design, always let the user review the palette when there is an app brief.
    // Explicit colors/mode skip web research, but still produce matching variants to choose from.
    const needsPicker = !!description.trim() && designMode === 'auto';
    if (!paletteStep && needsPicker) {
      setPaletteResearch(undefined);
      setPaletteOptions(paletteResult.options);
      setPaletteStep(true);
      if (paletteResult.needResearch) {
        setIsPaletteResearching(true);
        const detected = paletteResult.domainProfile;
        const cacheKey = `palette_research_v1_${encodeURIComponent(detected.domain)}_${encodeURIComponent(detected.mood.join('-'))}`;
        void (async () => {
          let research: PaletteResearchResult | undefined;
          try {
            const cached = await getSetting(cacheKey);
            if (cached) {
              const parsedCache = JSON.parse(cached) as { savedAt: number; result: PaletteResearchResult };
              if (parsedCache.result?.source === 'grounded' && Date.now() - parsedCache.savedAt < 7 * 24 * 60 * 60 * 1000) research = parsedCache.result;
            }
            if (!research) {
              const token = await getSecretStorage().get('token:google');
              research = await researchPaletteReferences({ domain: detected.domain, mood: detected.mood, token, http: getHttpBridge() });
              if (research.source === 'grounded') await setSetting(cacheKey, JSON.stringify({ savedAt: Date.now(), result: research }));
            }
          } catch {
            // Palette composition remains available when search, storage, or provider access fails.
          }
          setPaletteResearch(research);
          setPaletteOptions(composePaletteOptions({ project: provisional, prompt: description.trim(), mode: paletteModeForProject, research }).options);
          setSelectedPaletteIndex(0);
          setIsPaletteResearching(false);
        })();
      }
      return;
    }
    setIsCreating(true);
    try {
      let chosenPalette = paletteOptions[paletteIndex] || paletteResult.options[0];
      if (designMode === 'seed' && selectedKit) {
        chosenPalette = {
          ...chosenPalette,
          name: selectedKit.name,
          description: selectedKit.vibe,
          source: 'hint',
          colors: {
            ...chosenPalette.colors,
            primary: selectedKit.palette.primary,
            onPrimary: selectedKit.palette.text,
            secondary: selectedKit.palette.secondary,
            background: selectedKit.palette.background,
            surface: selectedKit.palette.surface,
            text: selectedKit.palette.text,
          },
        };
      }
      const project = await createProject({
        name: name.trim(),
        description: description.trim(),
        idea: description.trim() || undefined,
        initialPrompt: description.trim() || undefined,
        device,
        designMode,
        seedKitId: designMode === 'seed' ? selectedKitId : undefined,
        userHints: userHints.trim() || undefined,
        parsedHints: parsed,
        paletteOptions: paletteStep ? paletteOptions : designMode === 'seed' ? [chosenPalette, ...paletteResult.options.slice(1)] : paletteResult.options,
        chosenPalette,
        paletteSource: chosenPalette.source,
        domainProfile: paletteResult.domainProfile,
        brandColor: chosenPalette.colors.primary,
        defaultProvider: 'google',
      });
      router.replace(`/project/${project.id}/editor`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/')} style={styles.back}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={15} color="#666" />
            <Text style={styles.backText}>Projects</Text>
          </View>
        </Pressable>
        <Text style={styles.brand}>TezMind</Text>
        <View style={{ width: 80 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {paletteStep ? (
            <>
              <View style={styles.step}><Text style={styles.stepText}>COLOR DIRECTION</Text></View>
              <Text style={styles.title}>Pick your color direction</Text>
              <Text style={styles.paletteBriefLabel}>Using your app brief{isPaletteResearching ? ' · checking relevant palette references' : ''}</Text>
              <ScrollView style={styles.paletteBrief} contentContainerStyle={styles.paletteBriefContent} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                <Text style={styles.paletteBriefText}>{description.trim()}</Text>
              </ScrollView>
              <View style={styles.modeSwitch}>
                {(['light', 'dark'] as const).map((mode) => <Pressable key={mode} onPress={() => {
                  setPaletteMode(mode);
                  const result = composePaletteOptions({ project: { name, description, idea: description, designMode, parsedHints: parseHints(`${description} ${userHints}`) }, prompt: description, mode, seed: Date.now() % 1000, research: paletteResearch });
                  setPaletteOptions(result.options);
                  setSelectedPaletteIndex(0);
                }} style={[styles.modeOption, paletteMode === mode && styles.modeOptionActive]}><Text style={[styles.modeOptionText, paletteMode === mode && styles.modeOptionTextActive]}>{mode === 'light' ? 'Light' : 'Dark'}</Text></Pressable>)}
              </View>
              <View style={styles.paletteGrid}>
                {paletteOptions.map((option, index) => {
                  const selected = selectedPaletteIndex === index;
                  const c = option.colors;
                  return <Pressable key={option.id} onPress={() => setSelectedPaletteIndex(index)} style={[styles.paletteCard, selected && styles.paletteCardSelected, { backgroundColor: c.surface, borderColor: selected ? c.primary : c.border }]}>
                    {index === 0 && <Text style={[styles.recommended, { color: c.primary }]}>RECOMMENDED</Text>}
                    <Text style={[styles.paletteName, { color: c.text }]}>{option.name}</Text>
                    <Text style={[styles.paletteDescription, { color: c.textMuted }]}>{option.description}</Text>
                    <View style={styles.paletteSwatches}>{[c.primary, c.accent, c.background, c.surfaceAlt, c.text].map((color, swatchIndex) => <View key={`${option.id}-${swatchIndex}`} style={[styles.paletteSwatch, { backgroundColor: color, borderColor: c.border }]} />)}</View>
                    <View style={[styles.paletteMiniCard, { backgroundColor: c.background, borderColor: c.border }]}>
                      <Text style={[styles.paletteMiniTitle, { color: c.text }]}>{option.preview.sampleCardTitle}</Text>
                      <View style={styles.paletteMiniBottom}><Text style={[styles.paletteMiniMuted, { color: c.textMuted }]}>Ready when you are</Text><View style={[styles.paletteMiniButton, { backgroundColor: c.primary }]}><Text style={{ color: c.onPrimary, fontSize: 10, fontWeight: '700' }}>{option.preview.sampleButtonLabel}</Text></View></View>
                    </View>
                    {option.source === 'grounded' && option.references?.[0] ? <Pressable onPress={() => void Linking.openURL(option.references![0]).catch(() => undefined)}><Text style={[styles.paletteSource, { color: c.primary }]}>Search informed · View source</Text></Pressable> : <Text style={[styles.paletteSource, { color: c.textMuted }]}>{option.source === 'knowledge' ? option.basis?.length ? `Matched UI kits: ${option.basis.slice(0, 2).join(', ')}` : 'Composed by TezMind for your app' : 'Based on your color hints'}</Text>}
                    {selected && <View style={[styles.selectedMark, { backgroundColor: c.primary }]}><Check size={11} color={c.onPrimary} strokeWidth={2.5} /></View>}
                  </Pressable>;
                })}
              </View>
              {paletteOptions[selectedPaletteIndex] && <View style={styles.paletteEditRow}>
                <Text style={styles.paletteEditLabel}>Edit selected colors</Text>
                {(['primary', 'accent'] as const).map((role) => <View key={role} style={styles.paletteEditField}><Text style={styles.paletteEditHint}>{role === 'primary' ? 'Primary' : 'Accent'}</Text><TextInput key={`${paletteOptions[selectedPaletteIndex].id}-${role}`} defaultValue={paletteOptions[selectedPaletteIndex].colors[role]} onEndEditing={(event) => updatePaletteColor(role, event.nativeEvent.text)} autoCapitalize="characters" maxLength={7} style={styles.paletteHexInput} /></View>)}
              </View>}
              <View style={styles.paletteActions}>
                <Pressable onPress={() => setPaletteStep(false)} style={styles.paletteBack}><Text style={styles.paletteBackText}>Back</Text></Pressable>
                <Pressable disabled={isCreating || isPaletteResearching} onPress={() => void create(0)} style={styles.paletteBack}><Text style={styles.paletteBackText}>Use recommended</Text></Pressable>
                <Pressable onPress={() => { setSelectedPaletteIndex(0); setPaletteOptions(composePaletteOptions({ project: { name, description, idea: description, designMode, parsedHints: parseHints(`${description} ${userHints}`) }, prompt: description, mode: paletteMode, seed: Date.now() % 1000, research: paletteResearch }).options); }} style={styles.paletteRegenerate}><Sparkles size={14} color="#5B43CA" /><Text style={styles.paletteRegenerateText}>Regenerate options</Text></Pressable>
                <Pressable disabled={isCreating || isPaletteResearching} onPress={() => void create()} style={[styles.primary, (isCreating || isPaletteResearching) && styles.disabled]}><Text style={styles.primaryText}>{isPaletteResearching ? 'Finding palette references…' : isCreating ? 'Creating…' : 'Use selected palette'}</Text><ArrowRight size={16} color="#FFF" /></Pressable>
              </View>
            </>
          ) : <>
          <View style={styles.step}>
            <Text style={styles.stepText}>NEW PROJECT</Text>
          </View>
          <Text style={styles.title}>Create a project</Text>
          <Text style={styles.subtitle}>
            TezMind derives a dedicated design system for your app (colors, typography, spacing, radius, icons) and enforces it deterministically across every screen.
          </Text>

          <Text style={styles.label}>Project name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Taxi Go ride booking"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            autoFocus
          />

          <Text style={styles.label}>
            What should the app do? <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the app idea and the first screen. TezMind will derive the visual direction and build the screen."
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.description]}
            multiline
            scrollEnabled
          />

          {/* Visual direction */}
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color="#7252C7" />
            <Text style={styles.label}>Visual Direction</Text>
          </View>

          <View style={styles.directionTabs}>
            <Pressable
              onPress={() => setDesignMode('auto')}
              style={[styles.directionTab, designMode === 'auto' && styles.directionTabActive]}
            >
              <View style={styles.tabHeader}>
                <Sparkles size={14} color={designMode === 'auto' ? '#7252C7' : '#666'} />
                <Text style={[styles.directionTabTitle, designMode === 'auto' && styles.directionTabTitleActive]}>
                  Auto Design (Recommended)
                </Text>
              </View>
              <Text style={styles.directionTabDesc}>
                Derives an accessible design system directly from your prompt and locks it for consistency.
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDesignMode('seed')}
              style={[styles.directionTab, designMode === 'seed' && styles.directionTabActive]}
            >
              <View style={styles.tabHeader}>
                <Palette size={14} color={designMode === 'seed' ? '#7252C7' : '#666'} />
                <Text style={[styles.directionTabTitle, designMode === 'seed' && styles.directionTabTitleActive]}>
                  Seed from a Kit
                </Text>
              </View>
              <Text style={styles.directionTabDesc}>
                Use an existing aesthetic kit as reference inspiration for your generated design system.
              </Text>
            </Pressable>
          </View>

          {/* Kit selection when seed mode is active */}
          {designMode === 'seed' && (
            <View style={styles.kitGrid}>
              {UI_KIT_OPTIONS.map((kit) => {
                const isSelected = selectedKitId === kit.id;
                return (
                  <Pressable
                    key={kit.id}
                    onPress={() => setSelectedKitId(kit.id)}
                    style={[styles.kitCard, isSelected && styles.kitCardSelected]}
                  >
                    <View style={styles.kitSwatches}>
                      <View style={[styles.kitSwatch, { backgroundColor: kit.palette.background }]} />
                      <View style={[styles.kitSwatch, { backgroundColor: kit.palette.surface }]} />
                      <View style={[styles.kitSwatch, { backgroundColor: kit.palette.primary }]} />
                    </View>
                    <Text style={[styles.kitName, isSelected && styles.kitNameSelected]}>{kit.name}</Text>
                    <Text style={styles.kitDescription} numberOfLines={2}>{kit.vibe}</Text>
                    {isSelected && (
                      <View style={styles.selectedMark}>
                        <Check size={11} color="#FFF" strokeWidth={2.5} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* User design hints */}
          <Text style={styles.label}>
            Anything specific? <Text style={styles.optional}>(optional styling hints)</Text>
          </Text>
          <TextInput
            value={userHints}
            onChangeText={setUserHints}
            placeholder="e.g. dark mode, sharp corners, amber accent, high density"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />

          {/* Device selection */}
          <Text style={styles.label}>Mobile device</Text>
          <View style={styles.deviceRow}>
            {([
              { id: 'mobile-ios' as DevicePreset, label: 'iPhone', detail: '393 × 852' },
              { id: 'mobile-android' as DevicePreset, label: 'Android', detail: '360 × 800' },
            ]).map((option) => {
              const selected = device === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setDevice(option.id)}
                  style={[styles.deviceCard, selected && styles.deviceSelected]}
                >
                  <Smartphone size={21} color={selected ? colors.primary : '#858A93'} strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deviceName, selected && styles.deviceNameSelected]}>{option.label}</Text>
                    <Text style={styles.deviceDetail}>{option.detail}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <Check size={11} color="#FFF" strokeWidth={2.2} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            disabled={!name.trim() || isCreating || isPaletteResearching}
            onPress={() => void create()}
            style={[styles.primary, (!name.trim() || isCreating || isPaletteResearching) && styles.disabled]}
          >
            <Text style={styles.primaryText}>
              {isPaletteResearching ? 'Finding palette references…' : isCreating ? 'Creating…' : description.trim() ? 'Create & generate first screen' : 'Continue to editor'}
            </Text>
            {!isCreating && !isPaletteResearching && <ArrowRight size={16} color="#FFF" />}
          </Pressable>
          <Text style={styles.footnote}>You can customize the design system anytime in the editor.</Text>
          </>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 64, borderBottomWidth: 1, borderBottomColor: '#ECECEC', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  back: { minWidth: 80 },
  backText: { color: '#666', fontSize: 14 },
  brand: { fontSize: 16, fontWeight: '700', color: '#202123' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 520, gap: 12 },
  step: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F2F2F2', marginBottom: 4 },
  stepText: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: '#202123', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 21, color: '#737373', marginBottom: 12 },
  label: { color: '#333', fontWeight: '600', fontSize: 13, marginTop: 4 },
  optional: { color: '#888', fontWeight: '400' },
  input: { borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#202123' },
  description: { height: 140, minHeight: 100, maxHeight: 180, textAlignVertical: 'top' },
  paletteBriefLabel: { fontSize: 12, fontWeight: '600', color: '#676874', marginTop: -5 },
  paletteBrief: { maxHeight: 108, flexGrow: 0, borderWidth: 1, borderColor: '#E4E5EB', borderRadius: 10, backgroundColor: '#F8F8FA' },
  paletteBriefContent: { paddingHorizontal: 12, paddingVertical: 9 },
  paletteBriefText: { color: '#5E606A', fontSize: 12, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  directionTabs: { flexDirection: 'column', gap: 8 },
  directionTab: { borderWidth: 1, borderColor: '#E2E4E8', borderRadius: 12, padding: 12, gap: 4, backgroundColor: '#FFF' },
  directionTabActive: { borderColor: '#7252C7', backgroundColor: '#FAF8FF' },
  tabHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  directionTabTitle: { fontSize: 13, fontWeight: '600', color: '#333' },
  directionTabTitleActive: { color: '#6242B7' },
  directionTabDesc: { fontSize: 11, color: '#737984', lineHeight: 15 },
  kitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  kitCard: { position: 'relative', flexGrow: 1, flexBasis: '42%', maxWidth: '49%', minHeight: 80, borderWidth: 1, borderColor: '#E2E4E8', borderRadius: 10, padding: 10, gap: 4, backgroundColor: '#FFF' },
  kitCardSelected: { borderColor: '#7252C7', backgroundColor: '#FAF8FF' },
  kitSwatches: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
  kitSwatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(20,25,35,0.1)' },
  kitName: { fontSize: 12, fontWeight: '600', color: '#292D35' },
  kitNameSelected: { color: '#6242B7' },
  kitDescription: { color: '#737984', fontSize: 10, lineHeight: 13 },
  selectedMark: { position: 'absolute', right: 7, top: 7, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7252C7' },
  modeSwitch: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: '#F1F1F4', borderRadius: 10, padding: 3 },
  modeOption: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8 },
  modeOptionActive: { backgroundColor: '#FFF', shadowColor: '#111', shadowOpacity: 0.08, shadowRadius: 4 },
  modeOptionText: { fontSize: 12, color: '#6D6D75', textTransform: 'capitalize' },
  modeOptionTextActive: { color: '#27272E', fontWeight: '600' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paletteCard: { position: 'relative', flexGrow: 1, flexBasis: '46%', minWidth: 210, maxWidth: '49%', padding: 12, borderWidth: 1, borderRadius: 14, gap: 5 },
  paletteCardSelected: { borderWidth: 2 },
  recommended: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  paletteName: { fontSize: 14, lineHeight: 18, fontWeight: '700', paddingRight: 12 },
  paletteDescription: { minHeight: 30, fontSize: 11, lineHeight: 15 },
  paletteSwatches: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  paletteSwatch: { width: 22, height: 22, borderWidth: 1, borderRadius: 7 },
  paletteMiniCard: { padding: 9, borderWidth: 1, borderRadius: 10, gap: 8 },
  paletteMiniTitle: { fontSize: 11, fontWeight: '600' },
  paletteMiniBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  paletteMiniMuted: { flex: 1, fontSize: 9 },
  paletteMiniButton: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 7 },
  paletteSource: { fontSize: 9, marginTop: 2 },
  paletteActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  paletteEditRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  paletteEditLabel: { width: '100%', color: '#55565E', fontSize: 12, fontWeight: '600' },
  paletteEditField: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E1E2E6', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  paletteEditHint: { fontSize: 11, color: '#737780', textTransform: 'capitalize' },
  paletteHexInput: { width: 80, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 5, backgroundColor: '#F6F6F8', color: '#25262C', fontSize: 12, fontFamily: 'monospace' },
  paletteBack: { paddingHorizontal: 12, paddingVertical: 12 },
  paletteBackText: { color: '#5F6068', fontSize: 13 },
  paletteRegenerate: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#DDD8EF', paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10 },
  paletteRegenerateText: { color: '#5B43CA', fontSize: 12, fontWeight: '600' },
  deviceRow: { flexDirection: 'row', gap: 12 },
  deviceCard: { flex: 1, minWidth: 0, minHeight: 70, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  deviceSelected: { borderColor: '#10A37F', backgroundColor: '#F2FAF7' },
  deviceName: { fontSize: 14, fontWeight: '600', color: '#333' },
  deviceNameSelected: { color: '#087F5B' },
  deviceDetail: { fontSize: 12, color: '#888', marginTop: 2 },
  radio: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#C8CCD2', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: '#10A37F', borderColor: '#10A37F' },
  primary: { marginTop: 14, minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10A37F', borderRadius: 12 },
  primaryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.48 },
  footnote: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 2 },
});
