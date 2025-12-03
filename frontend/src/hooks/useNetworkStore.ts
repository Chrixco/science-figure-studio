import { create } from 'zustand';
import {
  Cell,
  NetworkConfig,
  ColorScheme,
  FunctionType,
  DEFAULT_CONFIG,
  DEFAULT_COLORS,
  LIGHT_COLORS,
  FUNCTION_TYPES,
  Preset,
  LayoutTemplate
} from '../types';
import { generateNetwork, updateCellPosition, randomColor, createCell, generateCellPositions, CANVAS_SCALE, generateNetworkWithTemplate, calculateMinSpacing, calculateCellBorderRadius, recalculateCellGeometry } from '../utils/geometry';

// History entry for undo/redo
interface HistoryEntry {
  cells: Cell[];
  config: NetworkConfig;
  colors: ColorScheme;
}

interface NetworkStore {
  cells: Cell[];
  config: NetworkConfig;
  colors: ColorScheme;
  selectedCellIds: string[]; // Changed to array for multi-select
  isDragging: boolean;
  presets: Preset[];

  // Undo/Redo
  history: HistoryEntry[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setCells: (cells: Cell[]) => void;
  setConfig: (config: Partial<NetworkConfig>) => void;
  setColors: (colors: Partial<ColorScheme>) => void;
  setFunctionColor: (fn: FunctionType, color: string) => void;
  setFunctionTextColor: (fn: FunctionType, color: string) => void;
  setFunctionBackgroundColor: (fn: FunctionType, color: string) => void;
  setFunctionLabel: (fn: FunctionType, label: string) => void;
  setFunctionVisible: (fn: FunctionType, visible: boolean) => void;
  setFunctionWeight: (fn: FunctionType, weight: number) => void;
  setSelectedCell: (id: string | null) => void;
  setSelectedCells: (ids: string[]) => void;
  toggleCellSelection: (id: string) => void;
  setIsDragging: (isDragging: boolean) => void;
  setCellLabel: (cellId: string, label: string) => void;

  // Cell operations
  moveCell: (cellId: string, newPosition: { x: number; y: number }) => void;
  moveSelectedCells: (dx: number, dy: number) => void;
  regenerateLayout: () => void;
  applyTemplate: (template: LayoutTemplate) => void;
  randomizeColors: () => void;
  updateCellCount: (count: number) => void;

  // Theme
  toggleTheme: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;

  // Presets
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  loadPresetsFromStorage: () => void;

  // Import/Export
  loadState: (cells: Cell[], config: NetworkConfig, colors: ColorScheme) => void;
  importFromJSON: (json: string) => boolean;
  importFromCSV: (csv: string) => boolean;
  reset: () => void;
}

const MAX_HISTORY = 50;

// Helper to save presets to localStorage
const savePresetsToStorage = (presets: Preset[]) => {
  try {
    localStorage.setItem('circle-network-presets', JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets:', e);
  }
};

// Helper to load presets from localStorage
const loadPresetsFromLocalStorage = (): Preset[] => {
  try {
    const data = localStorage.getItem('circle-network-presets');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load presets:', e);
    return [];
  }
};

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  cells: generateNetwork(DEFAULT_CONFIG),
  config: DEFAULT_CONFIG,
  colors: DEFAULT_COLORS,
  selectedCellIds: [],
  isDragging: false,
  presets: loadPresetsFromLocalStorage(),
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  setCells: (cells) => set({ cells }),

  setConfig: (newConfig) => set((state) => ({
    config: { ...state.config, ...newConfig }
  })),

  setColors: (newColors) => set((state) => ({
    colors: { ...state.colors, ...newColors }
  })),

  setFunctionColor: (fn, color) => set((state) => ({
    colors: {
      ...state.colors,
      functions: { ...state.colors.functions, [fn]: color }
    }
  })),

  setFunctionTextColor: (fn, color) => set((state) => ({
    colors: {
      ...state.colors,
      functionText: { ...state.colors.functionText, [fn]: color }
    }
  })),

  setFunctionBackgroundColor: (fn, color) => set((state) => ({
    colors: {
      ...state.colors,
      functionBackground: { ...state.colors.functionBackground, [fn]: color }
    }
  })),

  setFunctionLabel: (fn, label) => set((state) => ({
    config: {
      ...state.config,
      functionLabels: { ...state.config.functionLabels, [fn]: label }
    }
  })),

  setFunctionVisible: (fn, visible) => set((state) => ({
    config: {
      ...state.config,
      functionVisible: { ...state.config.functionVisible, [fn]: visible }
    }
  })),

  setFunctionWeight: (fn, weight) => set((state) => {
    const newConfig = {
      ...state.config,
      functionWeights: { ...state.config.functionWeights, [fn]: weight }
    };

    // Recalculate all cell geometry when weights change
    const updatedCells = state.cells.map(cell =>
      recalculateCellGeometry(cell, newConfig)
    );

    return {
      config: newConfig,
      cells: updatedCells
    };
  }),

  setSelectedCell: (id) => set({ selectedCellIds: id ? [id] : [] }),

  setSelectedCells: (ids) => set({ selectedCellIds: ids }),

  toggleCellSelection: (id) => set((state) => {
    const isSelected = state.selectedCellIds.includes(id);
    return {
      selectedCellIds: isSelected
        ? state.selectedCellIds.filter(i => i !== id)
        : [...state.selectedCellIds, id]
    };
  }),

  setIsDragging: (isDragging) => set({ isDragging }),

  setCellLabel: (cellId, label) => set((state) => ({
    cells: state.cells.map(cell =>
      cell.id === cellId ? { ...cell, label } : cell
    )
  })),

  moveCell: (cellId, newPosition) => {
    const state = get();
    // Apply grid snap if enabled
    let finalPosition = newPosition;
    if (state.config.snapToGrid) {
      const gridSize = state.config.gridSize * CANVAS_SCALE;
      finalPosition = {
        x: Math.round(newPosition.x / gridSize) * gridSize,
        y: Math.round(newPosition.y / gridSize) * gridSize
      };
    }
    set({
      cells: state.cells.map(cell =>
        cell.id === cellId ? updateCellPosition(cell, finalPosition) : cell
      )
    });
  },

  moveSelectedCells: (dx, dy) => set((state) => {
    const gridSize = state.config.snapToGrid ? state.config.gridSize * CANVAS_SCALE : 0;
    return {
      cells: state.cells.map(cell => {
        if (!state.selectedCellIds.includes(cell.id)) return cell;
        let newPos = {
          x: cell.position.x + dx,
          y: cell.position.y + dy
        };
        if (gridSize > 0) {
          newPos = {
            x: Math.round(newPos.x / gridSize) * gridSize,
            y: Math.round(newPos.y / gridSize) * gridSize
          };
        }
        return updateCellPosition(cell, newPos);
      })
    };
  }),

  regenerateLayout: () => {
    get().saveToHistory();
    set((state) => ({
      cells: generateNetwork(state.config)
    }));
  },

  applyTemplate: (template) => {
    get().saveToHistory();
    set((state) => ({
      cells: generateNetworkWithTemplate(state.config, template)
    }));
  },

  randomizeColors: () => set((state) => {
    const newFunctionColors = {} as Record<FunctionType, string>;
    FUNCTION_TYPES.forEach(fn => {
      newFunctionColors[fn] = randomColor();
    });

    return {
      colors: {
        ...state.colors,
        functions: newFunctionColors,
        livingOutline: randomColor(),
        cellBorder: randomColor()
      }
    };
  }),

  updateCellCount: (count) => {
    get().saveToHistory();
    set((state) => {
      const currentCount = state.cells.length;

      if (count === currentCount) return state;

      if (count < currentCount) {
        return {
          cells: state.cells.slice(0, count),
          config: { ...state.config, cellCount: count }
        };
      }

      // Calculate cell border radius for bounds and spacing
      const cellBorderRadius = calculateCellBorderRadius(
        state.config.livingRadius * CANVAS_SCALE,
        state.config.functionRadius * CANVAS_SCALE,
        state.config.functionWeights
      );

      const edgePadding = cellBorderRadius * 1.15;
      const bounds = {
        minX: edgePadding,
        maxX: CANVAS_SCALE - edgePadding,
        minY: edgePadding,
        maxY: CANVAS_SCALE - edgePadding
      };

      // Use consistent spacing calculation (uses dynamic cell radius internally)
      const minSpacing = state.config.avoidOverlap
        ? calculateMinSpacing(state.config, true)
        : 0;

      // Get existing cell positions to avoid collisions with them
      const existingPositions = state.cells.map(cell => cell.position);

      const newPositions = generateCellPositions(
        count - currentCount,
        minSpacing,
        bounds,
        existingPositions
      );

      // Create cells with scaled config - createCell will calculate dynamic radius
      const scaledConfig = {
        ...state.config,
        livingRadius: state.config.livingRadius * CANVAS_SCALE,
        functionRadius: state.config.functionRadius * CANVAS_SCALE
      };

      const newCells = newPositions.map((pos, i) => createCell(pos, scaledConfig, currentCount + i));

      return {
        cells: [...state.cells, ...newCells],
        config: { ...state.config, cellCount: count }
      };
    });
  },

  toggleTheme: () => set((state) => {
    const newTheme = state.config.theme === 'dark' ? 'light' : 'dark';
    const newColors = newTheme === 'dark' ? DEFAULT_COLORS : LIGHT_COLORS;
    return {
      config: { ...state.config, theme: newTheme },
      colors: newColors
    };
  }),

  saveToHistory: () => set((state) => {
    const entry: HistoryEntry = {
      cells: JSON.parse(JSON.stringify(state.cells)),
      config: JSON.parse(JSON.stringify(state.config)),
      colors: JSON.parse(JSON.stringify(state.colors))
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
      canRedo: false
    };
  }),

  undo: () => set((state) => {
    if (state.historyIndex < 0) return state;

    // Save current state for redo if this is the first undo
    let history = state.history;
    let newIndex = state.historyIndex;

    if (state.historyIndex === state.history.length - 1) {
      // Save current state
      const currentEntry: HistoryEntry = {
        cells: JSON.parse(JSON.stringify(state.cells)),
        config: JSON.parse(JSON.stringify(state.config)),
        colors: JSON.parse(JSON.stringify(state.colors))
      };
      history = [...state.history, currentEntry];
    }

    const entry = history[newIndex];
    newIndex--;

    return {
      cells: JSON.parse(JSON.stringify(entry.cells)),
      config: JSON.parse(JSON.stringify(entry.config)),
      colors: JSON.parse(JSON.stringify(entry.colors)),
      history,
      historyIndex: newIndex,
      canUndo: newIndex >= 0,
      canRedo: true
    };
  }),

  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 2) return state;

    const newIndex = state.historyIndex + 2;
    const entry = state.history[newIndex];

    return {
      cells: JSON.parse(JSON.stringify(entry.cells)),
      config: JSON.parse(JSON.stringify(entry.config)),
      colors: JSON.parse(JSON.stringify(entry.colors)),
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < state.history.length - 1
    };
  }),

  savePreset: (name) => {
    const state = get();
    const preset: Preset = {
      id: Math.random().toString(36).substring(2, 11),
      name,
      cells: JSON.parse(JSON.stringify(state.cells)),
      config: JSON.parse(JSON.stringify(state.config)),
      colors: JSON.parse(JSON.stringify(state.colors)),
      createdAt: Date.now()
    };
    const newPresets = [...state.presets, preset];
    savePresetsToStorage(newPresets);
    set({ presets: newPresets });
  },

  loadPreset: (id) => {
    const state = get();
    const preset = state.presets.find(p => p.id === id);
    if (preset) {
      state.saveToHistory();
      set({
        cells: JSON.parse(JSON.stringify(preset.cells)),
        config: JSON.parse(JSON.stringify(preset.config)),
        colors: JSON.parse(JSON.stringify(preset.colors))
      });
    }
  },

  deletePreset: (id) => {
    const state = get();
    const newPresets = state.presets.filter(p => p.id !== id);
    savePresetsToStorage(newPresets);
    set({ presets: newPresets });
  },

  loadPresetsFromStorage: () => {
    set({ presets: loadPresetsFromLocalStorage() });
  },

  loadState: (cells, config, colors) => {
    get().saveToHistory();
    set({ cells, config, colors });
  },

  importFromJSON: (json) => {
    try {
      const data = JSON.parse(json);
      if (data.cells && data.config && data.colors) {
        get().saveToHistory();
        set({
          cells: data.cells,
          config: { ...DEFAULT_CONFIG, ...data.config },
          colors: { ...DEFAULT_COLORS, ...data.colors }
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  importFromCSV: (csv) => {
    try {
      const lines = csv.trim().split('\n');
      if (lines.length < 2) return false;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const labelIndex = headers.indexOf('label');
      const xIndex = headers.indexOf('x');
      const yIndex = headers.indexOf('y');

      if (xIndex === -1 || yIndex === -1) return false;

      const state = get();
      const scaledConfig = {
        ...state.config,
        cellRadius: state.config.cellRadius * CANVAS_SCALE,
        livingRadius: state.config.livingRadius * CANVAS_SCALE,
        functionRadius: state.config.functionRadius * CANVAS_SCALE
      };

      const newCells: Cell[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const x = parseFloat(values[xIndex]) * CANVAS_SCALE;
        const y = parseFloat(values[yIndex]) * CANVAS_SCALE;
        const label = labelIndex >= 0 ? values[labelIndex] : `Cell ${i}`;

        if (!isNaN(x) && !isNaN(y)) {
          const cell = createCell({ x, y }, scaledConfig, i - 1);
          cell.label = label;
          newCells.push(cell);
        }
      }

      if (newCells.length > 0) {
        get().saveToHistory();
        set({
          cells: newCells,
          config: { ...state.config, cellCount: newCells.length }
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  reset: () => {
    get().saveToHistory();
    set({
      cells: generateNetwork(DEFAULT_CONFIG),
      config: DEFAULT_CONFIG,
      colors: DEFAULT_COLORS,
      selectedCellIds: [],
      isDragging: false
    });
  }
}));
