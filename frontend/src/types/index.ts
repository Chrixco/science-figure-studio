// Core types for the Circle Network visualization

export interface Point {
  x: number;
  y: number;
}

export interface FunctionNode {
  id: string;
  type: FunctionType;
  position: Point;
  radius: number;
}

export type FunctionType =
  | 'water'
  | 'education'
  | 'green'
  | 'work'
  | 'streets'
  | 'tree'
  | 'temperature'
  | 'biodiversity'
  | 'pollution';

export const FUNCTION_TYPES: FunctionType[] = [
  'water',
  'education',
  'green',
  'work',
  'streets',
  'tree',
  'temperature',
  'biodiversity',
  'pollution'
];

export interface Cell {
  id: string;
  label: string; // Custom label for the cell (e.g., "District A")
  position: Point;
  radius: number;
  livingRadius: number;
  functions: FunctionNode[];
}

export interface Connection {
  from: Point;
  to: Point;
  color: string;
  isInternal: boolean;
}

export interface ColorScheme {
  functions: Record<FunctionType, string>;
  functionText: Record<FunctionType, string>;
  functionBackground: Record<FunctionType, string>; // Background color for function circles
  living: string;
  livingOutline: string;
  livingText: string;
  cellBorder: string;
  background: string;
  text: string;
  grid: string; // Grid line color
  gridMajor: string; // Major grid line color (every 5th line)
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface NetworkConfig {
  cellCount: number;
  cellRadius: number;
  livingRadius: number;
  functionRadius: number;
  functionWeights: Record<FunctionType, number>; // Weight/size multiplier for each function (0.5-2.0)
  cellSpacing: number;
  lineWidth: number;
  lineWidthJitter: number;
  lineWidthByWeight: boolean; // Connection thickness based on function weight
  lineStyle: LineStyle; // Connection line style
  lineOpacity: number; // Opacity for lines not overlapping circles (0-1)
  lineOverlapOpacity: number; // Opacity for lines overlapping circles (0-1)
  livingFontSize: number;
  functionFontSize: number;
  livingOutlineWidth: number;
  livingOutlineStyle: LineStyle;
  functionOutlineWidth: number;
  functionOutlineStyle: LineStyle;
  cellOutlineWidth: number;
  cellOutlineStyle: LineStyle;
  showExternalConnections: boolean;
  avoidOverlap: boolean;
  linesOnTop: boolean;
  livingLabel: string;
  functionLabels: Record<FunctionType, string>;
  functionVisible: Record<FunctionType, boolean>;
  connectionFilter: FunctionType | 'all'; // Filter to show only specific function connections
  animationDuration: number; // in seconds
  showGrid: boolean; // Show grid overlay
  snapToGrid: boolean;
  gridSize: number;
  theme: 'dark' | 'light';
}

export type LayoutTemplate = 'random' | 'grid' | 'circle' | 'cluster';

export interface Preset {
  id: string;
  name: string;
  cells: Cell[];
  config: NetworkConfig;
  colors: ColorScheme;
  createdAt: number;
}

export interface NetworkState {
  cells: Cell[];
  config: NetworkConfig;
  colors: ColorScheme;
  selectedCellId: string | null;
  isDragging: boolean;
}

export const DEFAULT_COLORS: ColorScheme = {
  functions: {
    water: '#5bc5c8',       // Cyan/turquoise
    education: '#d64a9c',   // Pink/magenta
    green: '#4a9a8c',       // Teal
    work: '#4a6fa5',        // Blue
    streets: '#e5c653',     // Yellow/gold
    tree: '#5bc5c8',        // Cyan
    temperature: '#6b5b95', // Purple
    biodiversity: '#4a9a8c',// Teal
    pollution: '#5a5a5a'    // Gray
  },
  functionText: {
    water: '#1a1a1a',
    education: '#1a1a1a',
    green: '#1a1a1a',
    work: '#1a1a1a',
    streets: '#1a1a1a',
    tree: '#1a1a1a',
    temperature: '#1a1a1a',
    biodiversity: '#1a1a1a',
    pollution: '#1a1a1a'
  },
  functionBackground: {
    water: '#ffffff',
    education: '#ffffff',
    green: '#ffffff',
    work: '#ffffff',
    streets: '#ffffff',
    tree: '#ffffff',
    temperature: '#ffffff',
    biodiversity: '#ffffff',
    pollution: '#ffffff'
  },
  living: '#d64a9c',        // Pink/magenta
  livingOutline: '#5bc5c8', // Cyan
  livingText: '#1a1a1a',    // Dark text for living
  cellBorder: '#5a5a5a',    // Gray
  background: '#000000',    // Black
  text: '#f5f5f5',          // Light/white
  grid: 'rgba(255, 255, 255, 0.08)',       // Subtle white grid for dark mode
  gridMajor: 'rgba(255, 255, 255, 0.15)'   // Slightly brighter major grid lines
};

export const DEFAULT_CONFIG: NetworkConfig = {
  cellCount: 6,
  cellRadius: 0.22,
  livingRadius: 0.10,
  functionRadius: 0.05,
  cellSpacing: 0.1, // Small gap between cells when avoiding overlap
  lineWidth: 1.6,
  lineWidthJitter: 0,
  lineWidthByWeight: false,
  lineStyle: 'solid',
  lineOpacity: 1.0,
  lineOverlapOpacity: 0.25,
  livingFontSize: 12,
  functionFontSize: 9,
  livingOutlineWidth: 3,
  livingOutlineStyle: 'solid',
  functionOutlineWidth: 2,
  functionOutlineStyle: 'solid',
  cellOutlineWidth: 2,
  cellOutlineStyle: 'dashed',
  showExternalConnections: true,
  avoidOverlap: true,
  linesOnTop: false,
  livingLabel: 'living',
  functionLabels: {
    water: 'water',
    education: 'education',
    green: 'green',
    work: 'work',
    streets: 'streets',
    tree: 'tree',
    temperature: 'temperature',
    biodiversity: 'biodiversity',
    pollution: 'pollution'
  },
  functionVisible: {
    water: true,
    education: true,
    green: true,
    work: true,
    streets: true,
    tree: true,
    temperature: true,
    biodiversity: true,
    pollution: true
  },
  functionWeights: {
    water: 1.0,
    education: 1.0,
    green: 1.0,
    work: 1.0,
    streets: 1.0,
    tree: 1.0,
    temperature: 1.0,
    biodiversity: 1.0,
    pollution: 1.0
  },
  connectionFilter: 'all',
  animationDuration: 3,
  showGrid: false,
  snapToGrid: false,
  gridSize: 0.5,
  theme: 'dark'
};

// Light theme colors
export const LIGHT_COLORS: ColorScheme = {
  functions: {
    water: '#0088cc',
    education: '#cc0066',
    green: '#2d8f6f',
    work: '#3366aa',
    streets: '#cc9900',
    tree: '#0088cc',
    temperature: '#8844aa',
    biodiversity: '#2d8f6f',
    pollution: '#666666'
  },
  functionText: {
    water: '#1a1a1a',
    education: '#1a1a1a',
    green: '#1a1a1a',
    work: '#1a1a1a',
    streets: '#1a1a1a',
    tree: '#1a1a1a',
    temperature: '#1a1a1a',
    biodiversity: '#1a1a1a',
    pollution: '#1a1a1a'
  },
  functionBackground: {
    water: '#ffffff',
    education: '#ffffff',
    green: '#ffffff',
    work: '#ffffff',
    streets: '#ffffff',
    tree: '#ffffff',
    temperature: '#ffffff',
    biodiversity: '#ffffff',
    pollution: '#ffffff'
  },
  living: '#cc0066',
  livingOutline: '#0088cc',
  livingText: '#1a1a1a',
  cellBorder: '#999999',
  background: '#ffffff',
  text: '#1a1a1a',
  grid: 'rgba(0, 0, 0, 0.08)',        // Subtle black grid for light mode
  gridMajor: 'rgba(0, 0, 0, 0.18)'    // Slightly darker major grid lines
};

export const FUNCTION_LABELS: Record<FunctionType, string> = {
  water: 'Water',
  education: 'Education',
  green: 'Green',
  work: 'Work',
  streets: 'Streets',
  tree: 'Tree',
  temperature: 'Temperature',
  biodiversity: 'Biodiversity',
  pollution: 'Pollution'
};
