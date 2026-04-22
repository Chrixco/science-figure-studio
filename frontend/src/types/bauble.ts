import { Point } from './index';

// -----------------------------------------------------------------------
// Layout types
// -----------------------------------------------------------------------
export type BaubleLayoutType = 'circular' | 'random' | 'circlepack' | 'forceatlas2' | 'forcedirected' | 'noverlap' | 'hierarchy' | 'radialhierarchy';

// -----------------------------------------------------------------------
// Node kinds
// -----------------------------------------------------------------------
export type BaubleKind = 'root' | 'mother' | 'child' | 'grandchild';

export interface BaubleNode {
  id: string;            // e.g. "root" | "mother-0" | "child-0-3" | "grandchild-{fileId}-{idx}"
  kind: BaubleKind;
  label: string;         // User-editable label
  position: Point;       // In CANVAS_SCALE (0–10) coordinate space
  radius: number;        // In CANVAS_SCALE units
  color: string;         // Fill colour (hex)
}

export interface BaubleEdge {
  fromId: string;
  toId: string;
  kind: 'root-to-mother' | 'mother-to-child' | 'mother-to-mother' | 'child-to-grandchild';
}

// The full graph ready for rendering
export interface BaubleGraph {
  nodes: BaubleNode[];
  edges: BaubleEdge[];
}

// Per-file state — one per loaded Excel file
export interface LoadedBaubleFile {
  fileId: string;           // uuid
  fileName: string;         // Original file name
  motherLabel: string;      // User-editable
  childNames: string[];     // "Name" column values, one per row
  parentChildNodeId?: string;  // If set, this file's names are grandchildren of this child node (e.g. "child-0-2")
}

// Visual config (style equivalent for Bauble mode)
export interface BaubleConfig {
  rootEnabled: boolean;
  rootLabel: string;
  rootColor: string;
  motherColor: string;
  childColor: string;
  grandchildColor: string;
  edgeColor: string;
  edgeWidth: number;
  showLabels: boolean;
  backgroundColor: string;
  // Layout type and parameters
  layoutType: BaubleLayoutType;
  // Shared parameters (used by most layouts)
  layoutCenter: number;  // Center offset for layout algorithms
  layoutScale: number;   // Scale factor for force-directed algorithms
  // Random layout (uses shared params)
  // Circular layout (uses shared params)
  // CirclePack parameters
  circlePackScale: number;  // Scale for circle pack (typically smaller: 0.5-2)
  // Force Directed parameters
  forceDirectedAttraction: number;
  forceDirectedRepulsion: number;
  forceDirectedGravity: number;
  forceDirectedInertia: number;
  forceDirectedMaxMove: number;
  // ForceAtlas2 parameters
  forceAtlas2Gravity: number;
  forceAtlas2EdgeWeightInfluence: number;
  forceAtlas2ScalingRatio: number;
  forceAtlas2LinLogMode: boolean;
  forceAtlas2AdjustSizes: boolean;
  forceAtlas2BarnesHutOptimize: boolean;
  forceAtlas2StrongGravityMode: boolean;
  forceAtlas2BarnesHutTheta: number;
  forceAtlas2SlowDown: number;
  // Noverlap parameters
  noverlabGridSize: number;
  noverlabMargin: number;
  noverlabExpansion: number;
  noverlabRatio: number;
  noverlabSpeed: number;
  // Hierarchy (Triangular/Tree) parameters
  hierarchyVerticalSpacing: number;  // Space between levels
  hierarchyHorizontalSpacing: number;  // Space between nodes at same level
  hierarchyNodeSpacing: number;  // Compact vs spread (0-1)
  // Radial Hierarchy (Diamond) parameters
  radialHierarchyRadius: number;  // Base radius for spreading
  radialHierarchyAngularSpread: number;  // Angular spread between nodes (0-360)
  radialHierarchyLevelExpansion: number;  // How much each level expands
  // Layout radius constants (in CANVAS_SCALE units)
  rootRadius: number;
  motherRadius: number;
  childRadius: number;
  grandchildRadius: number;
  motherOrbitRadius: number;  // radius of circle on which mothers are placed
  childOrbitRadius: number;   // radius of circle on which children are placed around their mother
  grandchildOrbitRadius: number;  // radius of circle on which grandchildren are placed around their child
  // Connection visibility toggles
  showRootToMotherConnections: boolean;
  showMotherToChildConnections: boolean;
  showMotherToMotherConnections: boolean;
  showChildToGrandchildConnections: boolean;
  // Size customization
  motherRadiusMultiplier: number; // Multiplier for mother node size (0.5-2.0)
  childRadiusMultiplier: number;  // Multiplier for child node size (0.5-2.0)
  grandchildRadiusMultiplier: number;  // Multiplier for grandchild node size (0.5-2.0)
  // Font customization
  rootFontFamily: string;          // Font family for root node
  rootFontSize: number;            // Font size for root node (8-20)
  motherFontFamily: string;       // Font family for mother nodes
  motherFontSize: number;         // Font size for mother nodes (8-20)
  childFontFamily: string;        // Font family for child nodes
  childFontSize: number;          // Font size for child nodes (8-20)
  grandchildFontFamily: string;   // Font family for grandchild nodes
  grandchildFontSize: number;     // Font size for grandchild nodes (8-20)
  // Text position customization
  rootTextPosition: 'top' | 'bottom' | 'left' | 'right';
  motherTextPosition: 'top' | 'bottom' | 'left' | 'right';
  childTextPosition: 'top' | 'bottom' | 'left' | 'right';
  grandchildTextPosition: 'top' | 'bottom' | 'left' | 'right';
}

export const DEFAULT_BAUBLE_CONFIG: BaubleConfig = {
  rootEnabled: false,
  rootLabel: 'Root',
  rootColor: '#d64a9c',
  motherColor: '#5bc5c8',
  childColor: '#4a6fa5',
  grandchildColor: '#7a9e7e',
  edgeColor: '#888888',
  edgeWidth: 1.5,
  showLabels: true,
  backgroundColor: '#1a1a1a',
  layoutType: 'circular',
  layoutCenter: 10,
  layoutScale: 1000,
  circlePackScale: 1.0,
  forceDirectedAttraction: 0.0005,
  forceDirectedRepulsion: 0.1,
  forceDirectedGravity: 0.0001,
  forceDirectedInertia: 0.6,
  forceDirectedMaxMove: 200,
  forceAtlas2Gravity: 1,
  forceAtlas2EdgeWeightInfluence: 1,
  forceAtlas2ScalingRatio: 1,
  forceAtlas2LinLogMode: false,
  forceAtlas2AdjustSizes: false,
  forceAtlas2BarnesHutOptimize: false,
  forceAtlas2StrongGravityMode: false,
  forceAtlas2BarnesHutTheta: 0.5,
  forceAtlas2SlowDown: 1,
  noverlabGridSize: 20,
  noverlabMargin: 5,
  noverlabExpansion: 1.1,
  noverlabRatio: 1,
  noverlabSpeed: 3,
  hierarchyVerticalSpacing: 1.5,
  hierarchyHorizontalSpacing: 0.8,
  hierarchyNodeSpacing: 0.7,
  radialHierarchyRadius: 1.2,
  radialHierarchyAngularSpread: 60,
  radialHierarchyLevelExpansion: 1.5,
  rootRadius: 0.7,
  motherRadius: 0.5,
  childRadius: 0.15,
  grandchildRadius: 0.1,
  motherOrbitRadius: 2.5,
  childOrbitRadius: 1.2,
  grandchildOrbitRadius: 0.8,
  showRootToMotherConnections: true,
  showMotherToChildConnections: true,
  showMotherToMotherConnections: true,
  showChildToGrandchildConnections: true,
  motherRadiusMultiplier: 1.0,
  childRadiusMultiplier: 1.0,
  grandchildRadiusMultiplier: 1.0,
  rootFontFamily: 'Arial',
  rootFontSize: 13,
  motherFontFamily: 'Arial',
  motherFontSize: 11,
  childFontFamily: 'Arial',
  childFontSize: 9,
  grandchildFontFamily: 'Arial',
  grandchildFontSize: 8,
  rootTextPosition: 'bottom',
  motherTextPosition: 'bottom',
  childTextPosition: 'bottom',
  grandchildTextPosition: 'bottom',
};
