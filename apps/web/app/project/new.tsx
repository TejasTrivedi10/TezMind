import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Sparkles, Smartphone } from 'lucide-react-native';
import { colors } from '../../design/tokens';
import { useProjectStore } from '../../store/useProjectStore';
import type { DevicePreset } from '@tezmind/core';
import { UI_KIT_OPTIONS, recommendUiKit, resolveUiKitAccent } from '@tezmind/ai';

export default function NewProjectScreen() {
  const { createProject } = useProjectStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [device, setDevice] = useState<DevicePreset>('mobile-ios');
  const [materialDesign3, setMaterialDesign3] = useState(false);
  const [uiKitId, setUiKitId] = useState('auto');
  const [isCreating, setIsCreating] = useState(false);
  const recommendedKit = recommendUiKit(description, name);
  const selectedKit = uiKitId === 'auto'
    ? recommendedKit
    : UI_KIT_OPTIONS.find((kit) => kit.id === uiKitId) || recommendedKit;

  const create = async () => {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim(),
        idea: description.trim() || undefined,
        initialPrompt: description.trim() || undefined,
        device,
        uiKitId,
        resolvedUiKitId: uiKitId === 'auto' ? undefined : uiKitId,
        styleKeywords: selectedKit.keywords,
        brandColor: resolveUiKitAccent(`${name} ${description}`, selectedKit.palette.primary),
        materialDesign3: materialDesign3 || uiKitId === 'material3' || (uiKitId === 'auto' && recommendedKit.id === 'material3'),
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
        <Pressable onPress={() => router.replace('/')} style={styles.back}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} color="#666" /><Text style={styles.backText}>Projects</Text></View></Pressable>
        <Text style={styles.brand}>TezMind</Text>
        <View style={{ width: 80 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.step}><Text style={styles.stepText}>STEP 1 OF 2</Text></View>
          <Text style={styles.title}>Create a project</Text>
          <Text style={styles.subtitle}>Name your app and choose a visual direction. TezMind will carry its colors, type, and component style across every screen.</Text>

          <Text style={styles.label}>Project name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Daily habit tracker" placeholderTextColor={colors.textTertiary} style={styles.input} autoFocus />

          <Text style={styles.label}>What should the app do? <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="Describe the app and first screen. TezMind will start designing it right away." placeholderTextColor={colors.textTertiary} style={[styles.input, styles.description]} multiline />

          <View style={styles.vibeHeading}>
            <View style={styles.vibeTitleRow}><Sparkles size={15} color="#7252C7" /><Text style={styles.label}>What vibe do you want?</Text></View>
            <Text style={styles.vibeHint}>Choose a kit or let TezMind match your idea.</Text>
          </View>
          <View style={styles.kitGrid}>
            <Pressable
              onPress={() => setUiKitId('auto')}
              accessibilityRole="radio"
              accessibilityState={{ checked: uiKitId === 'auto' }}
              style={[styles.kitCard, uiKitId === 'auto' && styles.kitCardSelected]}
            >
              <View style={styles.kitSwatches}><View style={[styles.kitSwatch, { backgroundColor: recommendedKit.palette.background }]} /><View style={[styles.kitSwatch, { backgroundColor: recommendedKit.palette.primary }]} /></View>
              <Text style={[styles.kitName, uiKitId === 'auto' && styles.kitNameSelected]}>Auto match</Text>
              <Text style={styles.kitDescription}>Best fit: {recommendedKit.name}</Text>
              <View style={styles.recommendedBadge}><Text style={styles.recommendedText}>RECOMMENDED</Text></View>
            </Pressable>
            {UI_KIT_OPTIONS.map((kit) => {
              const selected = uiKitId === kit.id;
              return (
                <Pressable
                  key={kit.id}
                  onPress={() => { setUiKitId(kit.id); if (kit.id === 'material3') setMaterialDesign3(true); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[styles.kitCard, selected && styles.kitCardSelected]}
                >
                  <View style={styles.kitSwatches}>
                    <View style={[styles.kitSwatch, { backgroundColor: kit.palette.background }]} />
                    <View style={[styles.kitSwatch, { backgroundColor: kit.palette.surface }]} />
                    <View style={[styles.kitSwatch, { backgroundColor: kit.palette.primary }]} />
                  </View>
                  <Text style={[styles.kitName, selected && styles.kitNameSelected]}>{kit.name}</Text>
                  <Text style={styles.kitDescription}>{kit.vibe}</Text>
                  {selected && <View style={styles.selectedMark}><Check size={11} color="#FFF" strokeWidth={2.5} /></View>}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.kitSummary}>
            <Text style={styles.kitSummaryTitle}>{uiKitId === 'auto' ? `TezMind will start with ${selectedKit.name}` : `${selectedKit.name} kit selected`}</Text>
            <Text style={styles.kitSummaryText}>{selectedKit.description}</Text>
          </View>

          <View style={[styles.designSystemOption, materialDesign3 && styles.designSystemOptionSelected]}>
            <Pressable onPress={() => setMaterialDesign3((current) => !current)} style={styles.designSystemToggle} accessibilityRole="checkbox" accessibilityState={{ checked: materialDesign3 }}>
              <View style={[styles.designSystemCheck, materialDesign3 && styles.designSystemCheckSelected]}>{materialDesign3 && <Check size={12} color="#FFF" strokeWidth={2.4} />}</View>
              <View style={styles.designSystemCopy}>
                <Text style={styles.designSystemTitle}>Use Material 3 components</Text>
                <Text style={styles.designSystemDescription}>Use real M3 buttons, inputs, and theme roles with this kit's visual direction.</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => Linking.openURL('https://m3.material.io/')} accessibilityLabel="Open Material 3 guidelines">
              <Text style={styles.designSystemLink}>Guidelines ↗</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Mobile device</Text>
          <View style={styles.deviceRow}>
            {([
              { id: 'mobile-ios' as DevicePreset, label: 'iPhone', detail: '393 × 852' },
              { id: 'mobile-android' as DevicePreset, label: 'Android', detail: '360 × 800' },
            ]).map((option) => {
              const selected = device === option.id;
              return <Pressable key={option.id} onPress={() => setDevice(option.id)} style={[styles.deviceCard, selected && styles.deviceSelected]}>
                <Smartphone size={21} color={selected ? colors.primary : '#858A93'} strokeWidth={1.8} /><View style={{ flex: 1 }}><Text style={[styles.deviceName, selected && styles.deviceNameSelected]}>{option.label}</Text><Text style={styles.deviceDetail}>{option.detail}</Text></View><View style={[styles.radio, selected && styles.radioSelected]}>{selected && <Check size={11} color="#FFF" strokeWidth={2.2} />}</View>
              </Pressable>;
            })}
          </View>
          <Pressable disabled={!name.trim() || isCreating} onPress={create} style={[styles.primary, (!name.trim() || isCreating) && styles.disabled]}>
            <Text style={styles.primaryText}>{isCreating ? 'Creating…' : description.trim() ? 'Create & generate first screen' : 'Continue to screen setup'}</Text>{!isCreating && <ArrowRight size={16} color="#FFF" />}
          </Pressable>
          <Text style={styles.footnote}>You can change project details later.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 64, borderBottomWidth: 1, borderBottomColor: '#ECECEC', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  back: { minWidth: 80 }, backText: { color: '#666', fontSize: 14 },
  brand: { fontSize: 16, fontWeight: '700', color: '#202123' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 520, gap: 12 },
  step: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F2F2F2', marginBottom: 4 },
  stepText: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 1 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: '#202123', letterSpacing: -0.6 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#737373', marginBottom: 18 },
  label: { color: '#333', fontWeight: '600', fontSize: 13, marginTop: 8 }, optional: { color: '#888', fontWeight: '400' },
  input: { borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#202123' },
  description: { minHeight: 84, textAlignVertical: 'top' },
  vibeHeading: { gap: 3, marginTop: 8 },
  vibeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  vibeHint: { color: '#777B84', fontSize: 12, lineHeight: 17 },
  kitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 3 },
  kitCard: { position: 'relative', flexGrow: 1, flexBasis: '42%', maxWidth: '49%', minHeight: 98, borderWidth: 1, borderColor: '#E2E4E8', borderRadius: 13, padding: 11, gap: 5, backgroundColor: '#FFF' },
  kitCardSelected: { borderColor: '#7252C7', backgroundColor: '#FAF8FF', boxShadow: '0 0 0 1px rgba(114,82,199,0.12)' as any },
  kitSwatches: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
  kitSwatch: { width: 13, height: 13, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(20,25,35,0.1)' },
  kitName: { fontSize: 13, fontWeight: '650' as any, color: '#292D35' },
  kitNameSelected: { color: '#6242B7' },
  kitDescription: { color: '#737984', fontSize: 10, lineHeight: 14 },
  recommendedBadge: { position: 'absolute', right: 7, top: 7, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, backgroundColor: '#F0EBFF' },
  recommendedText: { color: '#6748BE', fontSize: 7, fontWeight: '700', letterSpacing: 0.35 },
  selectedMark: { position: 'absolute', right: 7, top: 7, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7252C7' },
  kitSummary: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F7F7F9', gap: 3 },
  kitSummaryTitle: { fontSize: 12, color: '#343843', fontWeight: '600' },
  kitSummaryText: { fontSize: 11, color: '#747985', lineHeight: 16 },
  designSystemOption: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 8, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 12, backgroundColor: '#FFF', marginTop: 4 },
  designSystemOptionSelected: { borderColor: '#10A37F', backgroundColor: '#F2FAF7' },
  designSystemToggle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 5 },
  designSystemCheck: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#C8CCD2', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  designSystemCheckSelected: { backgroundColor: '#10A37F', borderColor: '#10A37F' },
  designSystemCopy: { flex: 1, minWidth: 0, gap: 3 },
  designSystemTitle: { color: '#30343B', fontSize: 13, fontWeight: '600' },
  designSystemDescription: { color: '#737373', fontSize: 11, lineHeight: 16 },
  designSystemLink: { color: '#087F63', fontSize: 11, fontWeight: '600' },
  deviceRow: { flexDirection: 'row', gap: 12 },
  deviceCard: { flex: 1, minWidth: 0, minHeight: 76, borderWidth: 1, borderColor: '#D9D9D9', borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  deviceSelected: { borderColor: '#10A37F', backgroundColor: '#F2FAF7' },
  deviceIcon: { fontSize: 23, color: '#555' }, deviceName: { fontSize: 14, fontWeight: '600', color: '#333' }, deviceNameSelected: { color: '#087F5B' }, deviceDetail: { fontSize: 12, color: '#888', marginTop: 3 },
  radio: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#C8CCD2', borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, radioSelected: { backgroundColor: '#10A37F', borderColor: '#10A37F' },
  primary: { marginTop: 14, minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10A37F', borderRadius: 12 },
  primaryText: { color: '#FFF', fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.48 },
  footnote: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 2 },
});
