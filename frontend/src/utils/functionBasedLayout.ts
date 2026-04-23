import { Cell, FunctionType, Point } from '../types';

interface LayoutNode {
  id: string;
  type: 'function' | 'cell';
  label: string;
  position: Point;
  functionType?: FunctionType;
  cellId?: string;
  radius: number;
  boundingRadius?: number; // Debug: total space needed for this cell
}

/**
 * Creates a multi-cell layout where:
 * - Multiple complete cells (living circle + functions) are positioned across canvas
 * - Each cell has its own living circle with functions around it
 * - Cells are spaced to avoid overlapping
 */
export function generateFunctionBasedLayout(
  cells: Cell[],
  canvasWidth: number,
  canvasHeight: number,
  functionLabels: Record<FunctionType, string>,
  functionWeights: Record<FunctionType, number>,
  visible: Record<FunctionType, boolean>
): LayoutNode[] {
  const nodes: LayoutNode[] = [];
  const CANVAS_SCALE = 10;

  // Get unique visible function types
  const functionTypesInCells = new Set<FunctionType>();
  cells.forEach((cell) => {
    cell.functions.forEach((fn) => {
      if (visible[fn.type]) {
        functionTypesInCells.add(fn.type);
      }
    });
  });

  const visibleFunctions = Array.from(functionTypesInCells).sort();
  const functionCount = visibleFunctions.length;

  // Cell layout parameters
  const functionRadius = 2.5; // Distance from cell center to function nodes
  const livingRadius = 0.3; // Central living circle radius
  const functionNodeRadius = 0.5; // Function node radius
  const boundingRadius = functionRadius + functionNodeRadius + 0.2; // Total bounding circle radius
  const cellSpacing = boundingRadius * 2 + 0.8; // Space between cell centers (with buffer)

  // Position cells in a grid layout with overlap detection
  const cellCount = cells.length;
  const cols = Math.ceil(Math.sqrt(cellCount));
  const rows = Math.ceil(cellCount / cols);

  // Calculate grid positioning to fit within canvas
  const gridWidth = cols * cellSpacing;
  const gridHeight = rows * cellSpacing;

  // Dynamically adjust spacing if cells don't fit
  let adjustedCellSpacing = cellSpacing;
  if (gridWidth > CANVAS_SCALE || gridHeight > CANVAS_SCALE) {
    // Shrink spacing to fit all cells
    adjustedCellSpacing = Math.min(
      (CANVAS_SCALE - 1) / cols,
      (CANVAS_SCALE - 1) / rows
    );
  }

  const adjustedGridWidth = cols * adjustedCellSpacing;
  const adjustedGridHeight = rows * adjustedCellSpacing;
  const startX = (CANVAS_SCALE - adjustedGridWidth) / 2 + adjustedCellSpacing / 2;
  const startY = (CANVAS_SCALE - adjustedGridHeight) / 2 + adjustedCellSpacing / 2;

  console.log(`Layout: ${cellCount} cells (${cols}x${rows}), spacing=${adjustedCellSpacing.toFixed(2)}, startX=${startX.toFixed(2)}, startY=${startY.toFixed(2)}`);

  // Store cell positions for overlap detection
  const cellPositions: Array<{ id: string; x: number; y: number; radius: number }> = [];

  // Create nodes for each cell
  cells.forEach((cell, cellIndex) => {
    // Use cell position from store, or calculate grid position if not set
    let cellCenterX = cell.position.x;
    let cellCenterY = cell.position.y;

    // If cell position is at origin (not initialized), use grid layout for initial positioning
    if (cellCenterX === 0 && cellCenterY === 0) {
      const gridRow = Math.floor(cellIndex / cols);
      const gridCol = cellIndex % cols;
      cellCenterX = startX + gridCol * adjustedCellSpacing;
      cellCenterY = startY + gridRow * adjustedCellSpacing;
    }

    cellPositions.push({
      id: cell.id,
      x: cellCenterX,
      y: cellCenterY,
      radius: boundingRadius, // Use the calculated bounding radius
    });

    // Add living circle (core of the cell)
    nodes.push({
      id: `living-${cell.id}`,
      type: 'cell',
      label: cell.label || `Cell ${cellIndex + 1}`,
      position: { x: cellCenterX, y: cellCenterY },
      cellId: cell.id,
      radius: livingRadius,
      boundingRadius,
    });

    // Add function nodes around this cell
    visibleFunctions.forEach((fnType, fnIndex) => {
      const angle = (fnIndex / functionCount) * Math.PI * 2;
      const fnX = cellCenterX + functionRadius * Math.cos(angle);
      const fnY = cellCenterY + functionRadius * Math.sin(angle);

      nodes.push({
        id: `function-${cell.id}-${fnType}`,
        type: 'function',
        label: functionLabels[fnType] || fnType,
        position: { x: fnX, y: fnY },
        functionType: fnType,
        radius: 0.5 * (functionWeights[fnType] || 1),
      });
    });
  });

  return nodes;
}

/**
 * Calculate connections between cells based on shared functions
 * (kept for compatibility, but not used in new multi-cell layout)
 */
export function generateFunctionConnections(
  cells: Cell[],
  functionLabels: Record<FunctionType, string>,
  visible: Record<FunctionType, boolean>
) {
  interface Connection {
    fromCellId: string;
    toCellId: string;
    sharedFunctions: FunctionType[];
    strength: number;
  }

  const connections: Connection[] = [];

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];

      const functions1 = new Set(cell1.functions.map((f) => f.type).filter((t) => visible[t]));
      const functions2 = new Set(cell2.functions.map((f) => f.type).filter((t) => visible[t]));

      const sharedFunctions = Array.from(functions1).filter((f) => functions2.has(f));

      if (sharedFunctions.length > 0) {
        connections.push({
          fromCellId: cell1.id,
          toCellId: cell2.id,
          sharedFunctions,
          strength: sharedFunctions.length / Math.max(functions1.size, functions2.size),
        });
      }
    }
  }

  return connections;
}
