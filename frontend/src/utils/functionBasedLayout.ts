import { Cell, FunctionType, Point } from '../types';

interface LayoutNode {
  id: string;
  type: 'function' | 'cell';
  label: string;
  position: Point;
  functionType?: FunctionType;
  cellId?: string;
  radius: number;
}

/**
 * Creates a function-based layout where:
 * - Function nodes are positioned in a circle
 * - Cells are positioned around their function nodes
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
  const centerX = CANVAS_SCALE / 2;
  const centerY = CANVAS_SCALE / 2;

  // Get unique visible function types from all cells
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

  // Position function nodes in a circle around the center
  const functionRadius = 3; // Distance from center
  const functionNodeRadius = 0.6;

  visibleFunctions.forEach((fnType, index) => {
    const angle = (index / functionCount) * Math.PI * 2;
    const x = centerX + functionRadius * Math.cos(angle);
    const y = centerY + functionRadius * Math.sin(angle);

    nodes.push({
      id: `function-${fnType}`,
      type: 'function',
      label: functionLabels[fnType] || fnType,
      position: { x, y },
      functionType: fnType,
      radius: functionNodeRadius * (functionWeights[fnType] || 1),
    });
  });

  // Position cells around their functions
  const cellsByFunction = new Map<FunctionType, Cell[]>();

  // Group cells by their first/primary function
  cells.forEach((cell) => {
    const cellFunctions = cell.functions.filter((fn) => visible[fn.type]);
    if (cellFunctions.length > 0) {
      const primaryFn = cellFunctions[0].type;
      if (!cellsByFunction.has(primaryFn)) {
        cellsByFunction.set(primaryFn, []);
      }
      cellsByFunction.get(primaryFn)!.push(cell);
    }
  });

  // Position cells around their function nodes
  const cellNodeRadius = 0.4;
  const cellCircleRadius = 1.2;

  visibleFunctions.forEach((fnType) => {
    const cellsForFunction = cellsByFunction.get(fnType) || [];
    const functionIndex = visibleFunctions.indexOf(fnType);
    const functionAngle = (functionIndex / functionCount) * Math.PI * 2;
    const functionX = centerX + functionRadius * Math.cos(functionAngle);
    const functionY = centerY + functionRadius * Math.sin(functionAngle);

    cellsForFunction.forEach((cell, cellIndex) => {
      const cellAngle =
        functionAngle +
        (cellIndex / Math.max(cellsForFunction.length, 1)) * (Math.PI / 3);
      const cellX = functionX + cellCircleRadius * Math.cos(cellAngle);
      const cellY = functionY + cellCircleRadius * Math.sin(cellAngle);

      nodes.push({
        id: cell.id,
        type: 'cell',
        label: cell.label,
        position: { x: cellX, y: cellY },
        cellId: cell.id,
        radius: cellNodeRadius,
      });
    });
  });

  return nodes;
}

/**
 * Calculate connections between cells based on shared functions
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
    strength: number; // 0-1, based on number of shared functions
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
