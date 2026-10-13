import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, FolderKanban, Plus, Search, Settings, Smartphone, Sparkles, Trash2 } from 'lucide-react-native';
import { useProjectStore } from '../store/useProjectStore';
import type { ProjectMeta } from '@tezmind/core';

function ProjectCard({ project, onOpen, onDelete }: { project: ProjectMeta; onOpen: () => void; onDelete: () => void }) {
  return <Pressable onPress={onOpen} style={({ pressed }) => [styles.projectCard, pressed && styles.projectPressed]}>
    <View style={styles.projectIcon}><Smartphone size={20} color="#10A37F" strokeWidth={1.8} /></View>
    <View style={styles.projectInfo}><Text style={styles.projectTitle} numberOfLines={1}>{project.name}</Text><Text style={styles.projectDescription} numberOfLines={1}>{project.description || 'Mobile app project'}</Text></View>
    <Text style={styles.projectDevice}>{project.device?.includes('android') ? 'Android' : 'iPhone'}</Text>
    <Pressable onPress={(event) => { event.stopPropagation?.(); onDelete(); }} style={styles.deleteButton} accessibilityLabel={`Delete ${project.name}`}><Trash2 size={15} color="#8A8F98" strokeWidth={1.8} /></Pressable>
  </Pressable>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { projects, loadProjects, deleteProject } = useProjectStore();
  const [search, setSearch] = useState('');
  useEffect(() => { loadProjects(); }, [loadProjects]);
  const filtered = projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(search.toLowerCase()));
  const isWide = width > 760;

  return <View style={styles.page}>
    {width > 760 && <View style={styles.sidebar}>
      <Pressable onPress={() => router.replace('/')} style={styles.brandRow}><View style={styles.logo}><Text style={styles.logoText}>T</Text></View><Text style={styles.brand}>TezMind</Text></Pressable>
      <Pressable onPress={() => router.push('/project/new')} style={styles.newProject}><Plus size={15} color="#333333" /><Text style={styles.newProjectText}>New project</Text></Pressable>
      <Text style={styles.sideLabel}>WORKSPACE</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><FolderKanban size={15} color="#555" /><Text style={styles.sideItem}>Projects</Text></View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => router.push('/settings')} style={styles.settings}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Settings size={15} color="#555" /><Text style={styles.sideItem}>Settings</Text></View></Pressable>
      <Text style={styles.version}>TezMind · Mobile UI Studio</Text>
    </View>}
    <View style={styles.main}>
      <View style={styles.topBar}><Text style={styles.breadcrumb}>Workspace  /  Projects</Text><Pressable onPress={() => router.push('/settings')} style={styles.settingsTop}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Settings size={14} color="#666" /><Text style={styles.settingsTopText}>Settings</Text></View></Pressable></View>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.headingRow}><View><Text style={styles.eyebrow}>YOUR WORKSPACE</Text><Text style={styles.title}>Projects</Text><Text style={styles.subtitle}>Pick up where you left off, or start something new.</Text></View><Pressable onPress={() => router.push('/project/new')} style={styles.primary}><Plus size={15} color="#FFF" /><Text style={styles.primaryText}>New project</Text></Pressable></View>
        {projects.length > 0 && <View style={styles.searchRow}><Search size={16} color="#969BA3" strokeWidth={1.8} /><TextInput value={search} onChangeText={setSearch} placeholder="Search projects" placeholderTextColor="#999" style={styles.search} /></View>}
        <Text style={styles.sectionTitle}>{search ? `${filtered.length} results` : 'Recent projects'}</Text>
        {filtered.length > 0 ? <View style={styles.projectList}>{filtered.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => router.push(`/project/${project.id}/editor`)} onDelete={() => deleteProject(project.id)} />)}</View> : projects.length === 0 ? <View style={styles.empty}><View style={styles.emptyMark}><Sparkles size={25} color="#10A37F" strokeWidth={1.7} /></View><Text style={styles.emptyTitle}>What will you design?</Text><Text style={styles.emptySubtitle}>Create a mobile app project, then describe the screen you want to bring to life.</Text><Pressable onPress={() => router.push('/project/new')} style={styles.primary}><Text style={styles.primaryText}>Create your first project</Text><ArrowRight size={15} color="#FFF" /></Pressable></View> : <Text style={styles.noResults}>No matching projects. Try another search.</Text>}
      </ScrollView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', backgroundColor: '#FFFFFF' },
  sidebar: { width: 244, borderRightWidth: 1, borderRightColor: '#ECECEC', padding: 18, paddingTop: 20, backgroundColor: '#FAFAFA' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }, logo: { width: 29, height: 29, borderRadius: 9, backgroundColor: '#10A37F', alignItems: 'center', justifyContent: 'center' }, logoText: { color: 'white', fontSize: 17, fontWeight: '700' }, brand: { color: '#202123', fontWeight: '700', fontSize: 15 },
  newProject: { height: 42, flexDirection: 'row', gap: 7, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', marginBottom: 30 }, newProjectText: { color: '#333', fontSize: 13, fontWeight: '600' },
  sideLabel: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 1, marginBottom: 11, paddingHorizontal: 6 }, sideItem: { color: '#555', fontSize: 13, padding: 9 }, settings: { borderTopWidth: 1, borderTopColor: '#ECECEC', paddingTop: 12 }, version: { color: '#AAA', fontSize: 11, paddingHorizontal: 9, paddingTop: 8 },
  main: { flex: 1, minWidth: 0, backgroundColor: '#FFF' }, topBar: { height: 60, borderBottomWidth: 1, borderBottomColor: '#ECECEC', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30 }, breadcrumb: { fontSize: 12, color: '#858585' }, settingsTop: { padding: 8 }, settingsTopText: { fontSize: 13, color: '#666' },
  content: { width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 46, paddingBottom: 48 }, contentWide: { paddingHorizontal: 42 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 30 }, eyebrow: { fontSize: 10, color: '#999', letterSpacing: 1.1, fontWeight: '700' }, title: { fontSize: 31, fontWeight: '700', color: '#202123', marginTop: 5, letterSpacing: -0.6 }, subtitle: { fontSize: 14, color: '#777', marginTop: 7 },
  searchRow: { height: 43, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10, paddingHorizontal: 13, marginBottom: 28 }, search: { flex: 1, height: 40, padding: 0, fontSize: 13 },
  primary: { backgroundColor: '#10A37F', minHeight: 42, flexDirection: 'row', gap: 7, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#FFF', fontSize: 13, fontWeight: '600' }, sectionTitle: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 12 },
  projectList: { borderTopWidth: 1, borderTopColor: '#ECECEC' }, projectCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: '#ECECEC', paddingHorizontal: 7 }, projectPressed: { backgroundColor: '#FAFAFA' }, projectIcon: { width: 42, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#F8F8F8', alignItems: 'center', justifyContent: 'center' }, projectIconText: { color: '#666', fontSize: 22 }, projectInfo: { flex: 1 }, projectTitle: { color: '#262626', fontSize: 14, fontWeight: '600' }, projectDescription: { color: '#888', fontSize: 12, marginTop: 5 }, projectDevice: { color: '#777', fontSize: 11, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, deleteButton: { padding: 8 }, deleteText: { color: '#999', fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 70, paddingBottom: 50, maxWidth: 420, alignSelf: 'center' }, emptyMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#F1F8F5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, emptyMarkText: { color: '#10A37F', fontSize: 27 }, emptyTitle: { color: '#202123', fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }, emptySubtitle: { color: '#777', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 20 }, noResults: { color: '#777', fontSize: 13, paddingVertical: 24 },
});
