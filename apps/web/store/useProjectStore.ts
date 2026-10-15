/**
 * Project store — Zustand store for project list and CRUD.
 * Uses the web HostBridge's ProjectStore (IndexedDB via Dexie).
 * Initialized lazily with the bridge from the host context.
 */

import { create } from 'zustand';
import type { ProjectMeta, DevicePreset } from '@tezmind/core';
import { nanoid } from '@tezmind/core';
import { getDatabase } from '../host/database';

export interface CreateProjectOptions extends Omit<ProjectMeta, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'> {
  initialPrompt?: string;
  initialImageUri?: string;
}

interface ProjectStoreState {
  projects: ProjectMeta[];
  isLoading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  createProject: (data: CreateProjectOptions) => Promise<ProjectMeta>;
  updateProject: (id: string, updates: Partial<ProjectMeta>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<ProjectMeta | null>;
  getProject: (id: string) => ProjectMeta | undefined;
}

function getPresetWidth(device: DevicePreset, customWidth?: number): number {
  switch (device) {
    case 'mobile-ios': return 393;
    case 'mobile-android': return 360;
    case 'tablet': return 820;
    case 'desktop': return 1440;
    case 'custom': return customWidth || 1280;
    default: return 393;
  }
}

function getPresetHeight(device: DevicePreset, customHeight?: number): number {
  switch (device) {
    case 'mobile-ios': return 852;
    case 'mobile-android': return 800;
    case 'tablet': return 1180;
    case 'desktop': return 900;
    case 'custom': return customHeight || 800;
    default: return 852;
  }
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = getDatabase();
      const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
      set({ projects, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Failed to load projects' });
    }
  },

  createProject: async (options) => {
    const { initialPrompt, initialImageUri, ...data } = options;
    const now = Date.now();
    const project: ProjectMeta = {
      ...data,
      id: nanoid(),
      thumbnail: data.thumbnail || initialImageUri,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };

    const db = getDatabase();
    await db.projects.add(project);

    // Automatically create initial Screen 1
    const screenWidth = getPresetWidth(data.device, data.customWidth);
    const screenHeight = getPresetHeight(data.device, data.customHeight);

    const rootNode = {
      id: nanoid(),
      type: 'frame',
      name: 'Screen Root',
      sizing: {
        width: { mode: 'fixed' as const, value: screenWidth },
        height: { mode: 'fixed' as const, value: screenHeight },
      },
      layout: {
        direction: 'column' as const,
        gap: 16,
        padding: { top: 24, right: 16, bottom: 24, left: 16 },
        mainAxis: 'start' as const,
        crossAxis: 'stretch' as const,
      },
      style: { backgroundColor: data.chosenPalette?.colors.background || '#FFFFFF' },
      props: {},
      children: [],
    };

    await db.screens.add({
      id: nanoid(),
      projectId: project.id,
      name: 'Screen 1',
      order: 0,
      width: screenWidth,
      height: screenHeight,
      rootJson: JSON.stringify(rootNode),
      schemaVersion: 1,
      updatedAt: now,
    });

    if (initialPrompt || initialImageUri) {
      // Save initial prompt / image URI to settings or screen metadata for editor initialization
      if (initialPrompt) {
        await db.settings.put({ key: `project_${project.id}_initial_prompt`, value: initialPrompt });
      }
      if (initialImageUri) {
        await db.settings.put({ key: `project_${project.id}_initial_image`, value: initialImageUri });
      }
    }

    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  updateProject: async (id, updates) => {
    const now = Date.now();
    const db = getDatabase();
    await db.projects.update(id, { ...updates, updatedAt: now });
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: now } : p,
      ),
    }));
  },

  deleteProject: async (id) => {
    const db = getDatabase();
    await db.projects.delete(id);
    await db.screens.where('projectId').equals(id).delete();
    await db.history.where('projectId').equals(id).delete();
    await db.screenActions.where('projectId').equals(id).delete();
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  duplicateProject: async (id) => {
    const original = get().projects.find((p) => p.id === id);
    if (!original) return null;
    const now = Date.now();
    const copy: ProjectMeta = {
      ...original,
      id: nanoid(),
      name: `${original.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    const db = getDatabase();
    await db.projects.add(copy);
    // Copy screens
    const screens = await db.screens.where('projectId').equals(id).toArray();
    for (const screen of screens) {
      await db.screens.add({ ...screen, projectId: copy.id, id: nanoid() });
    }
    set((state) => ({ projects: [copy, ...state.projects] }));
    return copy;
  },

  getProject: (id) => get().projects.find((p) => p.id === id),
}));
