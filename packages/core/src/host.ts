/**
 * HostBridge — the single interface through which the editor and AI packages
 * interact with the outside world (network, secrets, storage, filesystem, UI).
 *
 * Rules:
 * - ALL I/O must go through HostBridge. No direct fetch, localStorage,
 *   SecretStorage, fs, or platform API calls in packages/core, ai, codegen-*, figma.
 * - The web app implements this with browser APIs (Dexie, WebCrypto, fetch/proxy).
 * - The future VS Code extension will implement it with extension-host APIs.
 * - Tests implement it with mocks.
 *
 * PURE TYPESCRIPT — no React, React Native, Expo, Node built-ins, or DOM types.
 * This file is the contract; do not import anything from host-specific runtimes.
 */

// ─── HTTP ────────────────────────────────────────────────────────────────────

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** If provided, the response will be returned as an AsyncIterable (streaming). */
  stream?: boolean;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface HttpBridge {
  /**
   * Performs an HTTP request.
   * When `req.stream` is true, returns an AsyncIterable<Uint8Array> for SSE/streaming.
   * When `req.stream` is false/undefined, returns a full HttpResponse.
   */
  fetch(
    req: HttpRequest,
    signal?: AbortSignal,
  ): Promise<HttpResponse | AsyncIterable<Uint8Array>>;
}

// ─── SECRETS ─────────────────────────────────────────────────────────────────

export interface SecretsBridge {
  /** Get a stored secret by key. Returns undefined if not found. */
  get(key: string): Promise<string | undefined>;
  /** Store a secret. The bridge decides how to encrypt/protect it. */
  set(key: string, value: string): Promise<void>;
  /** Delete a stored secret. */
  delete(key: string): Promise<void>;
}

// ─── PROJECT STORE ────────────────────────────────────────────────────────────

export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  idea?: string;
  device: DevicePreset;
  customWidth?: number;
  customHeight?: number;
  styleKeywords?: string[];
  brandColor?: string;
  defaultProvider?: string;
  defaultModelId?: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  /** Base64-encoded PNG thumbnail of the first screen. */
  thumbnail?: string;
}

export type DevicePreset =
  | 'mobile-ios'
  | 'mobile-android'
  | 'tablet'
  | 'desktop'
  | 'custom';

export interface ProjectStore {
  listProjects(): Promise<ProjectMeta[]>;
  getProject(id: string): Promise<ProjectMeta | undefined>;
  saveProject(project: ProjectMeta): Promise<void>;
  deleteProject(id: string): Promise<void>;

  listScreens(projectId: string): Promise<ScreenMeta[]>;
  getScreen(projectId: string, screenId: string): Promise<ScreenRecord | undefined>;
  saveScreen(projectId: string, screen: ScreenRecord): Promise<void>;
  deleteScreen(projectId: string, screenId: string): Promise<void>;

  listComponents(projectId: string): Promise<ComponentRecord[]>;
  getComponent(projectId: string, componentId: string): Promise<ComponentRecord | undefined>;
  saveComponent(projectId: string, component: ComponentRecord): Promise<void>;
  deleteComponent(projectId: string, componentId: string): Promise<void>;

  getAsset(projectId: string, assetId: string): Promise<AssetRecord | undefined>;
  saveAsset(projectId: string, asset: AssetRecord): Promise<void>;
  deleteAsset(projectId: string, assetId: string): Promise<void>;

  /** History (patches) for undo/redo persistence. */
  appendHistory(projectId: string, screenId: string, entry: HistoryEntry): Promise<void>;
  getHistory(projectId: string, screenId: string, limit?: number): Promise<HistoryEntry[]>;
  clearHistory(projectId: string, screenId: string): Promise<void>;
}

export interface ScreenMeta {
  id: string;
  name: string;
  order: number;
  updatedAt: number;
}

export interface ScreenRecord extends ScreenMeta {
  width: number;
  height: number;
  /** Serialized DesignNode tree (JSON string for storage-efficiency). */
  rootJson: string;
  schemaVersion: number;
}

export interface ComponentRecord {
  id: string;
  name: string;
  /** Serialized DesignNode subtree. */
  rootJson: string;
  updatedAt: number;
  schemaVersion: number;
}

export interface AssetRecord {
  id: string;
  name: string;
  mimeType: string;
  /** base64-encoded content */
  data: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  /** Serialized patch operations. */
  patchJson: string;
  description?: string;
}

// ─── FILES ───────────────────────────────────────────────────────────────────

export interface ImageData {
  /** base64-encoded image data */
  data: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  width?: number;
  height?: number;
}

export interface FilesBridge {
  /**
   * Write an exported file. On web: triggers download. On extension: writes to workspace.
   * The path is relative and interpreted by the host.
   */
  writeExport(path: string, content: string | Uint8Array): Promise<void>;
  /** Opens a picker and returns the selected image, or undefined if cancelled. */
  pickImage(): Promise<ImageData | undefined>;
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export interface UIBridge {
  notify(message: string, level: 'info' | 'warn' | 'error'): void;
  confirm(message: string): Promise<boolean>;
}

// ─── CLOCK ───────────────────────────────────────────────────────────────────

export interface ClockBridge {
  now(): number;
}

// ─── HOST BRIDGE (COMPOSITE) ─────────────────────────────────────────────────

/**
 * The complete HostBridge. Passed as a dependency to the editor and AI layers.
 * No feature may bypass this interface.
 */
export interface HostBridge {
  http: HttpBridge;
  secrets: SecretsBridge;
  projects: ProjectStore;
  files: FilesBridge;
  ui: UIBridge;
  clock: ClockBridge;
}
