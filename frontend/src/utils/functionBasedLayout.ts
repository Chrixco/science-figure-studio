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
 * Project the store's cells into flat render nodes.
 *
 * Geometry is *read*, not recomputed. This function used to hardcode its own
 * livingRadius (0.3), function ring radius (2.5) and cell bounding radius
 * (3.2), discarding everything cellGeneration/geometry had computed. The two
 * disagreed badly: the store spaced cells 4.725 apart for a bounding radius of
 * 2.25, while the renderer drew bounding circles of 3.2 that needed 6.4 --- so
 * cells visibly overlapped even with "Avoid Overlap" enabled, and the cell
 * radius / function weight controls had no effect on what was drawn.
 */
export function generateFunctionBasedLayout(
  cells: Cell[],
  functionLabels: Record<FunctionType, string>,
  functionWeights: Record<FunctionType, number>,
  visible: Record<FunctionType, boolean>
): LayoutNode[] {
  const nodes: LayoutNode[] = [];

  cells.forEach((cell, cellIndex) => {
    nodes.push({
      id: `living-${cell.id}`,
      type: 'cell',
      label: cell.label || `Cell ${cellIndex + 1}`,
      position: cell.position,
      cellId: cell.id,
      radius: cell.livingRadius,
      boundingRadius: cell.radius,
    });

    for (const fn of cell.functions) {
      if (!visible[fn.type]) continue;

      nodes.push({
        id: `function-${cell.id}-${fn.type}`,
        type: 'function',
        label: functionLabels[fn.type] || fn.type,
        position: fn.position,
        functionType: fn.type,
        cellId: cell.id,
        radius: fn.radius * (functionWeights[fn.type] ?? 1),
      });
    }
  });

  return nodes;
}

/**
 * Calculate connections between cells based on shared functions
 * (kept for compatibility, but not used in new multi-cell layout)
 */
export function generateFunctionConnections(
  cells: Cell[],
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
