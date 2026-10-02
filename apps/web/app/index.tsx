/**
 * Home Screen — Project list
 * Features: grid of project cards, search, new project button, settings link.
 * Premium dark design with glassmorphism cards and gradient accents.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, typography, spacing, radii, shadows } from '../design/tokens';
import { useProjectStore } from '../store/useProjectStore';
import type { ProjectMeta } from '@tezmind/core';

// Icons as SVG-style unicode for web (will use Lucide in Phase 2)
const DEVICE_ICONS: Record<string, string> = {
  'mobile-ios': '📱',
  'mobile-android': '📱',
  tablet: '⬜',
  desktop: '🖥️',
  custom: '⚡',
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ProjectCard({ project, onPress, onDelete }: {
  project: ProjectMeta;
  onPress: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      // @ts-expect-error web-only events
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={[styles.card, hovered && styles.cardHovered]}
    >
      {/* Thumbnail */}
      <View style={styles.cardThumb}>
        {project.thumbnail ? (
          <Image source={{ uri: project.thumbnail }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbEmoji}>{DEVICE_ICONS[project.device] ?? '📱'}</Text>
            <Text style={styles.thumbInitials}>
              {project.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        {/* Device badge */}
        <View style={styles.deviceBadge}>
          <Text style={styles.deviceBadgeText}>{project.device.replace('-', ' ')}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{project.description}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{formatDate(project.updatedAt)}</Text>
          {project.defaultProvider && (
            <View style={styles.providerTag}>
              <Text style={styles.providerTagText}>{project.defaultProvider}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Hover actions */}
      {hovered && (
        <View style={styles.cardActions}>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
            style={styles.cardActionBtn}
          >
            <Text style={styles.cardActionText}>🗑</Text>
          </Pressable>
        </View>
      )}

      {/* Gradient overlay */}
      <View style={styles.cardGradient} pointerEvents="none" />
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { projects, loadProjects, deleteProject } = useProjectStore();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = projects.filter(
    (p) =>
      search.length === 0 ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  );

  // Responsive columns
  const cols = width >= 1200 ? 4 : width >= 900 ? 3 : width >= 600 ? 2 : 1;

  const handleDelete = useCallback(async (id: string) => {
    await deleteProject(id);
  }, [deleteProject]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>Tez</Text>
            <Text style={styles.logoAccent}>Mind</Text>
          </View>
          <Text style={styles.tagline}>AI UI Design, Bring Your Own Key</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.headerBtnText}>⚙️ Settings</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}
            onPress={() => router.push('/project/new')}
          >
            <Text style={styles.newBtnText}>+ New Project</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero section when no projects */}
      {projects.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.heroGlow} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEmoji}>✨</Text>
            <Text style={styles.heroTitle}>Design with AI</Text>
            <Text style={styles.heroSubtitle}>
              Describe your app idea. TezMind generates beautiful, editable UI screens{'\n'}
              using your own Claude or Gemini API key. No lock-in. No subscription.
            </Text>
            <View style={styles.heroFeatures}>
              {[
                { icon: '🎨', label: 'AI-generated screens', desc: 'Prompt → pixel-perfect UI' },
                { icon: '✏️', label: 'Visual editor', desc: 'Tap, drag, resize, edit' },
                { icon: '💻', label: 'Export code', desc: 'Flutter & React Native' },
                { icon: '🔒', label: 'Your keys only', desc: 'Never stored on a server' },
              ].map((f) => (
                <View key={f.label} style={styles.featureCard}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.heroBtn, pressed && styles.heroBtnPressed]}
              onPress={() => router.push('/project/new')}
            >
              <Text style={styles.heroBtnText}>Create your first project →</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Search */}
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search projects…"
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Section title */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : `All Projects (${projects.length})`}
            </Text>
          </View>

          {/* Grid */}
          <View style={[styles.grid, { gap: 16 }]}>
            {filtered.map((project) => (
              <View key={project.id} style={{ width: `${100 / cols}%`, padding: 8 }}>
                <ProjectCard
                  project={project}
                  onPress={() => router.push(`/project/${project.id}/editor`)}
                  onDelete={() => handleDelete(project.id)}
                />
              </View>
            ))}
          </View>

          {filtered.length === 0 && search.length > 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No projects match "{search}"</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

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
  headerLeft: { flexDirection: 'column', gap: 2 },
  logo: { flexDirection: 'row', alignItems: 'center' },
  logoText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  logoAccent: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.fontSize.xs,
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  headerRight: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  headerBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerBtnPressed: { opacity: 0.7 },
  headerBtnText: { fontSize: typography.fontSize.sm, color: colors.textSecondary },
  newBtn: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  newBtnPressed: { backgroundColor: colors.primaryDark },
  newBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Empty / Hero
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    minHeight: 600,
  },
  heroGlow: {
    position: 'absolute',
    top: 80,
    width: 500,
    height: 400,
    borderRadius: 250,
    backgroundColor: colors.primary,
    opacity: 0.06,
    alignSelf: 'center',
  },
  heroContent: { alignItems: 'center', maxWidth: 680, gap: spacing[6] },
  heroEmoji: { fontSize: 56 },
  heroTitle: {
    fontSize: typography.fontSize['6xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  heroFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[4],
    justifyContent: 'center',
    width: '100%',
  },
  featureCard: {
    alignItems: 'center',
    padding: spacing[5],
    borderRadius: radii.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    width: 150,
    gap: spacing[1.5],
  },
  featureIcon: { fontSize: 28 },
  featureLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  featureDesc: { fontSize: typography.fontSize.xs, color: colors.textTertiary, textAlign: 'center' },
  heroBtn: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
    marginTop: spacing[2],
  },
  heroBtnPressed: { backgroundColor: colors.primaryDark },
  heroBtnText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Content
  content: { flex: 1 },
  contentInner: { padding: spacing[6], gap: spacing[5] },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    gap: spacing[2],
    maxWidth: 480,
  },
  searchBarFocused: { borderColor: colors.primary },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.text,
  },
  searchClear: { fontSize: 14, color: colors.textTertiary },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -8 },

  // Cards
  card: {
    borderRadius: radii['2xl'],
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  cardHovered: {
    borderColor: colors.borderLight,
    transform: [{ translateY: -2 }],
  },
  cardThumb: {
    height: 160,
    backgroundColor: colors.surface,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    width: '100%',
    height: '100%',
    backgroundColor: colors.bgInput,
  },
  thumbEmoji: { fontSize: 28 },
  thumbInitials: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: 2,
  },
  deviceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceBadgeText: { fontSize: typography.fontSize.xs, color: colors.textSecondary, textTransform: 'capitalize' },
  cardBody: { padding: spacing[4], gap: spacing[1.5] },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  cardDesc: { fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[1] },
  cardDate: { fontSize: typography.fontSize.xs, color: colors.textTertiary },
  providerTag: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
  },
  providerTagText: { fontSize: typography.fontSize.xs, color: colors.primary, textTransform: 'capitalize' },
  cardActions: {
    position: 'absolute',
    top: spacing[2],
    left: spacing[2],
    flexDirection: 'row',
    gap: spacing[1],
  },
  cardActionBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActionText: { fontSize: 14 },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: colors.bgCard,
    opacity: 0.5,
    pointerEvents: 'none',
  },

  // No results
  noResults: { padding: spacing[10], alignItems: 'center' },
  noResultsText: { fontSize: typography.fontSize.md, color: colors.textTertiary },
});
