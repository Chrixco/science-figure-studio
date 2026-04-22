import { create } from 'zustand';
import {
  BaubleGraph,
  LoadedBaubleFile,
  BaubleConfig,
  DEFAULT_BAUBLE_CONFIG,
} from '../types/bauble';
import { buildBaubleGraph, regenerateBaubleLayout } from '../utils/baubleLayout';
import { Point } from '../types/index';

const MAX_HISTORY = 50;

interface HistoryEntry {
  files: LoadedBaubleFile[];
  config: BaubleConfig;
  nodeColors: Record<string, string>;
  nodePositions: Record<string, { x: number; y: number }>;
}

interface BaubleStore {
  // --- Data
  files: LoadedBaubleFile[];
  graph: BaubleGraph;
  config: BaubleConfig;

  // --- Selection / drag
  selectedNodeId: string | null;
  isDragging: boolean;

  // --- History
  history: HistoryEntry[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // --- Actions: file management
  addFile: (file: LoadedBaubleFile) => void;
  removeFile: (fileId: string) => void;
  renameMotherLabel: (fileId: string, label: string) => void;
  deleteAllFiles: () => void;

  // --- Actions: root node
  setRootEnabled: (enabled: boolean) => void;
  setRootLabel: (label: string) => void;

  // --- Actions: layout
  regenerateLayout: () => void;

  // --- Actions: drag
  setSelectedNode: (id: string | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  moveNode: (nodeId: string, newPosition: Point) => void;
  setNodeColor: (nodeId: string, color: string) => void;

  // --- Actions: config
  setConfig: (patch: Partial<BaubleConfig>) => void;

  // --- Actions: import/export
  loadFromExport: (
    files: LoadedBaubleFile[],
    config: BaubleConfig,
    nodeColors: Record<string, string>,
    nodePositions?: Record<string, { x: number; y: number }>
  ) => void;

  // --- Actions: undo/redo
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;

  // --- Actions: reset
  reset: () => void;
}

export const useBaubleStore = create<BaubleStore>((set) => ({
  files: [],
  graph: { nodes: [], edges: [] },
  config: DEFAULT_BAUBLE_CONFIG,
  selectedNodeId: null,
  isDragging: false,
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  // --- File management
  addFile: (file: LoadedBaubleFile) =>
    set((state) => {
      const newFiles = [...state.files, file];
      const newGraph = buildBaubleGraph(newFiles, state.config);
      return { files: newFiles, graph: newGraph };
    }),

  removeFile: (fileId: string) =>
    set((state) => {
      const newFiles = state.files.filter((f) => f.fileId !== fileId);
      const newGraph = buildBaubleGraph(newFiles, state.config);
      return { files: newFiles, graph: newGraph };
    }),

  renameMotherLabel: (fileId: string, label: string) =>
    set((state) => {
      // Update in files
      const newFiles = state.files.map((f) =>
        f.fileId === fileId ? { ...f, motherLabel: label } : f
      );

      // Update in graph nodes
      const newGraph = {
        ...state.graph,
        nodes: state.graph.nodes.map((node) => {
          if (node.id === `mother-${state.files.findIndex((f) => f.fileId === fileId)}`) {
            return { ...node, label };
          }
          return node;
        }),
      };

      return { files: newFiles, graph: newGraph };
    }),

  deleteAllFiles: () =>
    set((state) => {
      const newGraph = buildBaubleGraph([], state.config);
      return { files: [], graph: newGraph };
    }),

  // --- Root node
  setRootEnabled: (enabled: boolean) =>
    set((state) => {
      const newConfig = { ...state.config, rootEnabled: enabled };
      const newGraph = buildBaubleGraph(state.files, newConfig);
      return { config: newConfig, graph: newGraph };
    }),

  setRootLabel: (label: string) =>
    set((state) => {
      const newConfig = { ...state.config, rootLabel: label };
      const newGraph = {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === 'root' ? { ...node, label } : node
        ),
      };
      return { config: newConfig, graph: newGraph };
    }),

  // --- Layout
  regenerateLayout: () =>
    set((state) => {
      const newGraph = regenerateBaubleLayout(state.files, state.config);
      return { graph: newGraph };
    }),

  // --- Drag
  setSelectedNode: (id: string | null) =>
    set(() => ({
      selectedNodeId: id,
    })),

  setIsDragging: (isDragging: boolean) =>
    set(() => ({
      isDragging,
    })),

  moveNode: (nodeId: string, newPosition: Point) =>
    set((state) => {
      const newGraph = {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, position: newPosition } : node
        ),
      };
      return { graph: newGraph };
    }),

  setNodeColor: (nodeId: string, color: string) =>
    set((state) => {
      const newGraph = {
        ...state.graph,
        nodes: state.graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, color } : node
        ),
      };
      return { graph: newGraph };
    }),

  // --- Config
  setConfig: (patch: Partial<BaubleConfig>) =>
    set((state) => {
      const newConfig = { ...state.config, ...patch };
      // Rebuild graph if root enabled or radius multipliers changed
      const needsRebuild = patch.rootEnabled !== undefined || patch.motherRadiusMultiplier !== undefined || patch.childRadiusMultiplier !== undefined || patch.grandchildRadiusMultiplier !== undefined;
      const newGraph = needsRebuild ? buildBaubleGraph(state.files, newConfig) : state.graph;
      return { config: newConfig, graph: newGraph };
    }),

  loadFromExport: (
    files: LoadedBaubleFile[],
    config: BaubleConfig,
    nodeColors: Record<string, string>,
    nodePositions: Record<string, { x: number; y: number }> = {}
  ) =>
    set(() => {
      // Build graph from imported files
      const newGraph = buildBaubleGraph(files, config);

      // Apply custom node colors and positions
      const coloredAndPositionedNodes = newGraph.nodes.map((node) => ({
        ...node,
        color: nodeColors[node.id] || node.color,
        position: nodePositions[node.id] || node.position,
      }));

      return {
        files,
        graph: { ...newGraph, nodes: coloredAndPositionedNodes },
        config,
        selectedNodeId: null,
        isDragging: false,
      };
    }),

  // --- History/Undo/Redo
  saveToHistory: () =>
    set((state) => {
      const entry: HistoryEntry = {
        files: JSON.parse(JSON.stringify(state.files)),
        config: JSON.parse(JSON.stringify(state.config)),
        nodeColors: Object.fromEntries(state.graph.nodes.map(n => [n.id, n.color])),
        nodePositions: Object.fromEntries(state.graph.nodes.map(n => [n.id, { x: n.position.x, y: n.position.y }])),
      };

      // Remove any redo history when making a new change
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(entry);

      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }

      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
        canUndo: true,
        canRedo: false,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex < 0) return state;

      // Save current state for redo if this is the first undo
      let history = state.history;
      let newIndex = state.historyIndex;

      if (state.historyIndex === state.history.length - 1) {
        // Save current state
        const currentEntry: HistoryEntry = {
          files: JSON.parse(JSON.stringify(state.files)),
          config: JSON.parse(JSON.stringify(state.config)),
          nodeColors: Object.fromEntries(state.graph.nodes.map(n => [n.id, n.color])),
          nodePositions: Object.fromEntries(state.graph.nodes.map(n => [n.id, { x: n.position.x, y: n.position.y }])),
        };
        history = [...state.history, currentEntry];
      }

      newIndex = Math.max(0, newIndex - 1);
      const entry = history[newIndex];
      const newGraph = buildBaubleGraph(entry.files, entry.config);

      return {
        files: JSON.parse(JSON.stringify(entry.files)),
        graph: {
          ...newGraph,
          nodes: newGraph.nodes.map(n => ({ ...n, color: entry.nodeColors[n.id] || n.color })),
        },
        config: JSON.parse(JSON.stringify(entry.config)),
        history,
        historyIndex: newIndex,
        canUndo: newIndex >= 0,
        canRedo: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 2) return state;

      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];
      const newGraph = buildBaubleGraph(entry.files, entry.config);

      return {
        files: JSON.parse(JSON.stringify(entry.files)),
        graph: {
          ...newGraph,
          nodes: newGraph.nodes.map(n => ({ ...n, color: entry.nodeColors[n.id] || n.color })),
        },
        config: JSON.parse(JSON.stringify(entry.config)),
        historyIndex: newIndex,
        canUndo: true,
        canRedo: newIndex < state.history.length - 1,
      };
    }),

  // --- Reset
  reset: () =>
    set(() => ({
      files: [],
      graph: { nodes: [], edges: [] },
      config: DEFAULT_BAUBLE_CONFIG,
      selectedNodeId: null,
      isDragging: false,
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
    })),
}));
