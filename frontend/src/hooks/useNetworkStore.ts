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
import { generateNetwork, updateCellPosition, randomColor, createCell, CANVAS_SCALE, generateNetworkWithTemplate, recalculateCellGeometry } from '../utils/geometry';

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

  /**
   * Bumped whenever cells are replaced wholesale (regenerate, template,
   * count change, import, preset load, reset) but never when a cell is merely
   * dragged. Views use it to decide when to re-frame the canvas without
   * yanking the viewport around mid-edit.
   */
  layoutVersion: number;

  // 3D Mode
  renderMode: '2d' | '3d';

  // Undo/Redo.
  //
  // Two stacks rather than an index into a single list: `past` holds the
  // states preceding each checkpoint, `future` the ones stepped back over.
  // The previous index-based version advanced redo by two and mutated the
  // history array during undo, so anything beyond a single step desynchronised.
  past: HistoryEntry[];
  future: HistoryEntry[];
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

  // Rendering
  setRenderMode: (mode: '2d' | '3d') => void;

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
  importFromExcel: (file: File) => Promise<{ success: boolean; errors: string[] }>;
  reset: () => void;
}

const MAX_HISTORY = 50;

/** Deep copy of the undoable slice of state. */
const snapshot = (state: {
  cells: Cell[];
  config: NetworkConfig;
  colors: ColorScheme;
}): HistoryEntry => ({
  cells: structuredClone(state.cells),
  config: structuredClone(state.config),
  colors: structuredClone(state.colors),
});

/** Deep copy back out, so a history entry is never aliased by live state. */
const restore = (entry: HistoryEntry) => ({
  cells: structuredClone(entry.cells),
  config: structuredClone(entry.config),
  colors: structuredClone(entry.colors),
});

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
  layoutVersion: 0,
  renderMode: '2d',
  past: [],
  future: [],
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

  setFunctionVisible: (fn, visible) => set((state) => {
    const newConfig = {
      ...state.config,
      functionVisible: { ...state.config.functionVisible, [fn]: visible }
    };

    // Recalculate all cell geometry when visibility changes
    const updatedCells = state.cells.map(cell =>
      recalculateCellGeometry(cell, newConfig)
    );

    return {
      config: newConfig,
      cells: updatedCells
    };
  }),

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
      cells: generateNetwork(state.config),
      layoutVersion: state.layoutVersion + 1
    }));
  },

  applyTemplate: (template) => {
    get().saveToHistory();
    set((state) => ({
      cells: generateNetworkWithTemplate(state.config, template),
      layoutVersion: state.layoutVersion + 1
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

      // Regenerate the whole network so spacing stays consistent across all
      // cells rather than slicing/appending onto an existing layout.
      //
      // Pass the config through unscaled: generateCells() applies CANVAS_SCALE
      // to livingRadius/functionRadius itself. Pre-scaling here double-scaled
      // every radius by 100x, which earlier code papered over by firing a
      // second regenerateLayout() on a setTimeout.
      const newConfig = { ...state.config, cellCount: count };
      const newCells = generateNetwork(newConfig);

      return {
        cells: newCells,
        config: newConfig,
        layoutVersion: state.layoutVersion + 1
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

  setRenderMode: (mode) => set({ renderMode: mode }),

  /**
   * Record a checkpoint of the current state.
   *
   * Callers invoke this immediately *before* a change, so the entry captures
   * what to return to. Checkpoints are explicit rather than automatic on every
   * `set`, which keeps a drag from pushing one entry per mouse move.
   */
  saveToHistory: () => set((state) => {
    const entry = snapshot(state);
    const past = [...state.past, entry];

    // Drop the oldest entries once the log is full.
    if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);

    return {
      past,
      // A fresh edit invalidates anything that was undone.
      future: [],
      canUndo: true,
      canRedo: false,
    };
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;

    const past = [...state.past];
    const entry = past.pop()!;
    const future = [...state.future, snapshot(state)];

    return {
      ...restore(entry),
      past,
      future,
      canUndo: past.length > 0,
      canRedo: true,
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;

    const future = [...state.future];
    const entry = future.pop()!;
    const past = [...state.past, snapshot(state)];

    return {
      ...restore(entry),
      past,
      future,
      canUndo: true,
      canRedo: future.length > 0,
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
      set((prev) => ({
        cells: JSON.parse(JSON.stringify(preset.cells)),
        config: JSON.parse(JSON.stringify(preset.config)),
        colors: JSON.parse(JSON.stringify(preset.colors)),
        layoutVersion: prev.layoutVersion + 1
      }));
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
    set((state) => ({ cells, config, colors, layoutVersion: state.layoutVersion + 1 }));
  },

  importFromJSON: (json) => {
    try {
      const data = JSON.parse(json);
      if (data.cells && data.config && data.colors) {
        get().saveToHistory();
        set((state) => ({
          cells: data.cells,
          config: { ...DEFAULT_CONFIG, ...data.config },
          colors: { ...DEFAULT_COLORS, ...data.colors },
          layoutVersion: state.layoutVersion + 1
        }));
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
        set((prev) => ({
          cells: newCells,
          config: { ...prev.config, cellCount: newCells.length },
          layoutVersion: prev.layoutVersion + 1
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  importFromExcel: async (file) => {
    try {
      const { parseExcelFile } = await import('../utils/excelImport');
      const state = get();
      const result = await parseExcelFile(file, state.config);

      if (result.errors.length > 0 && result.cells.length === 0) {
        return { success: false, errors: result.errors };
      }

      // Save to history before making changes
      get().saveToHistory();

      // Update cells
      set((prev) => ({
        cells: result.cells,
        config: { ...prev.config, cellCount: result.cells.length },
        layoutVersion: prev.layoutVersion + 1
      }));

      return { success: true, errors: result.errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, errors: [`Failed to import Excel file: ${message}`] };
    }
  },

  reset: () => {
    get().saveToHistory();
    set((state) => ({
      cells: generateNetwork(DEFAULT_CONFIG),
      config: DEFAULT_CONFIG,
      colors: DEFAULT_COLORS,
      selectedCellIds: [],
      isDragging: false,
      layoutVersion: state.layoutVersion + 1
    }));
  }
}));
