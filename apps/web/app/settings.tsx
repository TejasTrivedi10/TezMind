/**
 * Settings Screen — API token management per provider
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Bot, Check, ExternalLink, GitBranch, Sparkles, ShieldCheck, Zap } from 'lucide-react-native';
import { colors, typography, spacing, radii } from '../design/tokens';
import { getSecretStorage } from '../host/secrets';
import { redactToken } from '@tezmind/ai';

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    subtitle: 'Claude (Opus, Sonnet, Haiku)',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api03-…',
    corsNote: 'Direct browser calls supported (anthropic-dangerous-direct-browser-access header).',
  },
  {
    id: 'google',
    name: 'Google AI Studio',
    subtitle: 'Gemini (Pro, Flash, Ultra)',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIzaSy…',
    corsNote: 'Direct browser calls supported.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    subtitle: 'GPT-4o, GPT-4o Mini, o1',
    docsUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-proj-…',
    corsNote: 'CORS blocked — recommend enabling the local proxy (Settings → Proxy).',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    subtitle: 'Access 100+ models via one key',
    docsUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-…',
    corsNote: 'Uses the local proxy for CORS.',
  },
];

function ProviderRow({ provider }: { provider: typeof PROVIDERS[number] }) {
  const ProviderIcon = provider.id === 'anthropic' ? Bot : provider.id === 'google' ? Sparkles : provider.id === 'openai' ? Zap : GitBranch;
  const [token, setToken] = useState('');
  const [savedRedacted, setSavedRedacted] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    (async () => {
      const secrets = getSecretStorage();
      const stored = await secrets.get(`token:${provider.id}`);
      const redacted = await secrets.get(`token:${provider.id}:redacted`);
      if (stored) setSavedRedacted(redacted ?? '••••••••');
    })();
  }, [provider.id]);

  const handleSave = async () => {
    if (!token.trim()) return;
    setIsSaving(true);
    try {
      const secrets = getSecretStorage();
      await secrets.set(`token:${provider.id}`, token.trim());
      await secrets.set(`token:${provider.id}:redacted`, redactToken(token.trim()));
      setSavedRedacted(redactToken(token.trim()));
      setToken('');
      setIsEditing(false);
      setStatus('ok');
      setStatusMsg('Key saved');
      setTimeout(() => setStatus('idle'), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    const secrets = getSecretStorage();
    await secrets.delete(`token:${provider.id}`);
    await secrets.delete(`token:${provider.id}:redacted`);
    setSavedRedacted(null);
    setStatus('idle');
  };

  return (
    <View style={styles.providerRow}>
      <View style={styles.providerHeader}>
        <View style={styles.providerIcon}>
          <ProviderIcon size={19} color="#10A37F" strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.providerName}>{provider.name}</Text>
          <Text style={styles.providerSub}>{provider.subtitle}</Text>
        </View>
        {savedRedacted && !isEditing && (
          <View style={styles.savedBadge}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Check size={12} color="#087F63" /><Text style={styles.savedBadgeText}>Set</Text></View>
          </View>
        )}
      </View>

      <Text style={styles.corsNote}>{provider.corsNote}</Text>

      {savedRedacted && !isEditing ? (
        <View style={styles.tokenRow}>
          <View style={styles.maskedToken}>
            <Text style={styles.maskedTokenText}>{savedRedacted}</Text>
          </View>
          <Pressable style={styles.editBtn} onPress={() => setIsEditing(true)}>
            <Text style={styles.editBtnText}>Update</Text>
          </Pressable>
          <Pressable style={styles.removeBtn} onPress={handleRemove}>
            <Text style={styles.removeBtnText}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.tokenInputRow}>
          <TextInput
            style={[styles.tokenInput]}
            placeholder={provider.placeholder}
            placeholderTextColor={colors.textTertiary}
            value={token}
            onChangeText={setToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.saveBtn, (!token.trim() || isSaving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!token.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </Pressable>
          {isEditing && (
            <Pressable style={styles.cancelBtn} onPress={() => { setIsEditing(false); setToken(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      )}

      {status !== 'idle' && (
        <Text style={[styles.statusText, status === 'ok' ? styles.statusOk : styles.statusError]}>
          {statusMsg}
        </Text>
      )}

      <Pressable onPress={() => {/* open docs */ }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text style={styles.docsLink}>Get API key</Text><ExternalLink size={13} color="#10A37F" /></View>
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} color="#666" /><Text style={styles.backBtnText}>Back</Text></View>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Privacy notice */}
        <View style={styles.privacyBanner}>
          <View style={styles.privacyIcon}><ShieldCheck size={20} color="#10A37F" strokeWidth={1.8} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Your keys, your data</Text>
            <Text style={styles.privacyText}>
              API keys are encrypted with WebCrypto AES-GCM and stored only in this browser's local storage.
              They are sent directly to the AI provider you choose, and to no other server.
              TezMind has no backend — there's nothing to leak.
            </Text>
          </View>
        </View>

        {/* Provider section */}
        <Text style={styles.sectionLabel}>AI Providers</Text>
        <View style={styles.card}>
          {PROVIDERS.map((p, i) => (
            <View key={p.id}>
              <ProviderRow provider={p} />
              {i < PROVIDERS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Proxy section */}
        <Text style={styles.sectionLabel}>Local Proxy</Text>
        <View style={styles.card}>
          <View style={styles.proxyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.proxyTitle}>Local CORS Proxy</Text>
              <Text style={styles.proxyDesc}>
                Run <Text style={styles.code}>npm run proxy</Text> in a second terminal to start the proxy on localhost:3333.
                Enable this if a provider blocks direct browser calls (CORS).
                The proxy only runs on 127.0.0.1 and is never accessible externally.
              </Text>
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <Text style={styles.aboutText}>
            TezMind v0.1.0 — Open-source AI UI design tool.{'\n'}
            <Text style={styles.link}>github.com/TejasTrivedi10/TezMind</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  backBtn: { paddingVertical: spacing[1] },
  backBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  headerTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text },

  content: { flex: 1 },
  contentInner: { padding: spacing[6], gap: spacing[5], maxWidth: 700, alignSelf: 'center', width: '100%' },

  privacyBanner: {
    flexDirection: 'row', gap: spacing[4], padding: spacing[5],
    borderRadius: radii.xl, backgroundColor: 'rgba(0, 212, 170, 0.06)',
    borderWidth: 1, borderColor: 'rgba(0, 212, 170, 0.2)', alignItems: 'flex-start',
  },
  privacyIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  privacyTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.accent, marginBottom: spacing[1] },
  privacyText: { fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 20 },

  sectionLabel: {
    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary, letterSpacing: 1, textTransform: 'uppercase',
  },
  card: {
    borderRadius: radii['2xl'], backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing[5] },

  // Provider row
  providerRow: { padding: spacing[5], gap: spacing[3] },
  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  providerIcon: {
    width: 40, height: 40, borderRadius: radii.lg,
    backgroundColor: colors.bgInput, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  providerEmoji: { fontSize: 20 },
  providerName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.text },
  providerSub: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  savedBadge: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
    borderRadius: radii.full, backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  savedBadgeText: { fontSize: typography.fontSize.xs, color: colors.success, fontWeight: typography.fontWeight.semibold },
  corsNote: { fontSize: typography.fontSize.xs, color: colors.textTertiary },

  tokenRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  maskedToken: {
    flex: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radii.md, backgroundColor: colors.bgInput,
    borderWidth: 1, borderColor: colors.border,
  },
  maskedTokenText: { fontSize: typography.fontSize.sm, color: colors.textTertiary, fontFamily: 'monospace' },
  editBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radii.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  editBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  removeBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radii.md, backgroundColor: colors.errorLight,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  removeBtnText: { fontSize: typography.fontSize.sm, color: colors.error },

  tokenInputRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  tokenInput: {
    flex: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
    borderRadius: radii.lg, backgroundColor: colors.bgInput,
    borderWidth: 1, borderColor: colors.border,
    fontSize: typography.fontSize.sm, color: colors.text,
    // @ts-expect-error web
    outlineStyle: 'none', fontFamily: 'monospace',
  },
  saveBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2.5],
    borderRadius: radii.lg, backgroundColor: colors.primary,
    alignItems: 'center', minWidth: 70,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: typography.fontSize.sm, color: '#fff', fontWeight: typography.fontWeight.semibold },
  cancelBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
    borderRadius: radii.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  statusText: { fontSize: typography.fontSize.xs },
  statusOk: { color: colors.success },
  statusError: { color: colors.error },
  docsLink: { fontSize: typography.fontSize.xs, color: colors.primary },

  // Proxy
  proxyRow: { padding: spacing[5], flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  proxyTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.text, marginBottom: spacing[1.5] },
  proxyDesc: { fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  code: { fontFamily: 'monospace', backgroundColor: colors.bgInput, color: colors.accent },

  // About
  aboutText: { padding: spacing[5], fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 22 },
  link: { color: colors.primary },
});
