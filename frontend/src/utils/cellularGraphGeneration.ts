import { Cell, FunctionType, NetworkConfig, ColorScheme } from '../types';
import { BaubleGraph, BaubleNode, BaubleEdge } from '../types/bauble';

/**
 * Generates a hierarchical graph from network cells based on function grouping.
 *
 * Hierarchy:
 * - Root: "Cellular Network"
 * - Mother nodes: Function types (Water, Education, Green, etc.)
 * - Child nodes: Cells that contain those functions
 *
 * @param cells - Array of cells from network
 * @param config - Network config with function settings
 * @param colors - Color scheme with function colors
 * @returns BaubleGraph structure ready for rendering
 */
export function generateCellularGraph(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme
): BaubleGraph {
  const nodes: BaubleNode[] = [];
  const edges: BaubleEdge[] = [];

  // 1. Create root node
  const rootNode: BaubleNode = {
    id: 'root',
    kind: 'root',
    label: 'Cellular Network',
    position: { x: 5, y: 5 },
    radius: 0.4,
    color: colors.living || '#FFD700',
  };
  nodes.push(rootNode);

  // 2. Get unique function types from cells
  const functionTypesInCells = new Set<FunctionType>();
  cells.forEach((cell) => {
    cell.functions.forEach((fn) => {
      functionTypesInCells.add(fn.type);
    });
  });

  // 3. Create mother nodes for each visible function type
  const functionToMotherId = new Map<FunctionType, string>();
  let motherIndex = 0;

  // Ensure we process in a consistent order
  const sortedFunctionTypes = Array.from(functionTypesInCells).sort();

  sortedFunctionTypes.forEach((fnType) => {
    if (config.functionVisible[fnType]) {
      const motherId = `mother-${motherIndex}`;
      functionToMotherId.set(fnType, motherId);

      const motherNode: BaubleNode = {
        id: motherId,
        kind: 'mother',
        label: config.functionLabels[fnType] || fnType,
        position: { x: 5, y: 5 }, // Will be positioned by layout algorithm
        radius: 0.8 * (config.functionWeights[fnType] || 1),
        color: colors.functions[fnType] || '#808080',
      };
      nodes.push(motherNode);

      // Create edge from root to mother
      edges.push({
        fromId: 'root',
        toId: motherId,
        kind: 'root-to-mother',
      });

      motherIndex++;
    }
  });

  // 4. Create child nodes for each cell that has visible functions
  const cellToChildId = new Map<string, string>();
  let childIndex = 0;

  cells.forEach((cell) => {
    // Check if this cell has any visible functions
    const hasFunctions = cell.functions.some((fn) =>
      config.functionVisible[fn.type] && functionToMotherId.has(fn.type)
    );

    if (hasFunctions) {
      const childId = `child-${childIndex}`;
      cellToChildId.set(cell.id, childId);

      const childNode: BaubleNode = {
        id: childId,
        kind: 'child',
        label: cell.label,
        position: { x: 5, y: 5 }, // Will be positioned by layout algorithm
        radius: 0.6 * Math.sqrt(cell.functions.length), // Size based on function count
        color: colors.living || '#A9A9A9',
      };
      nodes.push(childNode);

      // Create edges from function mothers to this child
      const uniqueFunctionTypes = new Set<FunctionType>();
      cell.functions.forEach((fn) => {
        uniqueFunctionTypes.add(fn.type);
      });

      uniqueFunctionTypes.forEach((fnType) => {
        const motherId = functionToMotherId.get(fnType);
        if (motherId) {
          edges.push({
            fromId: motherId,
            toId: childId,
            kind: 'mother-to-child',
          });
        }
      });

      childIndex++;
    }
  });

  return {
    nodes,
    edges,
  };
}

/**
 * Updates a Bauble store with cellular graph data.
 * This bridges the network store data to the bauble visualization.
 */
export function generateCellularGraphConfig(cells: Cell[], config: NetworkConfig, colors: ColorScheme) {
  return {
    graph: generateCellularGraph(cells, config, colors),
    layout: 'hierarchy' as const,
  };
}
