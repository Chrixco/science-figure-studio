import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, FUNCTION_TYPES, FunctionType, Cell } from '../types';
import { generateCells } from './cellGeneration';
import { generateFunctionBasedLayout, generateFunctionConnections } from './functionBasedLayout';

function allVisible(): Record<FunctionType, boolean> {
  return Object.fromEntries(FUNCTION_TYPES.map((t) => [t, true])) as Record<FunctionType, boolean>;
}

function labels(): Record<FunctionType, string> {
  return DEFAULT_CONFIG.functionLabels;
}

function makeCells(count = 4): Cell[] {
  return generateCells({ ...DEFAULT_CONFIG, cellCount: count }, 'grid');
}

describe('generateFunctionBasedLayout', () => {
  // Regression: this function used to hardcode livingRadius 0.3 / ring 2.5 /
  // boundingRadius 3.2 and ignore the store entirely, so the renderer drew
  // cells at a different scale than the one placement had reserved space for.
  it('renders the radii the store computed, not its own constants', () => {
    const cells = makeCells(3);
    const nodes = generateFunctionBasedLayout(
      cells,
      labels(),
      DEFAULT_CONFIG.functionWeights,
      allVisible()
    );

    for (const cell of cells) {
      const node = nodes.find((n) => n.type === 'cell' && n.cellId === cell.id)!;
      expect(node.radius).toBe(cell.livingRadius);
      expect(node.boundingRadius).toBe(cell.radius);
      expect(node.position).toEqual(cell.position);
    }
  });

  it('renders function nodes at the positions the store computed', () => {
    const cells = makeCells(2);
    const nodes = generateFunctionBasedLayout(
      cells,
      labels(),
      DEFAULT_CONFIG.functionWeights,
      allVisible()
    );

    for (const cell of cells) {
      for (const fn of cell.functions) {
        const node = nodes.find((n) => n.id === `function-${cell.id}-${fn.type}`)!;
        expect(node.position).toEqual(fn.position);
      }
    }
  });

  it('scales function radius by its weight', () => {
    const cells = makeCells(1);
    const weights = { ...DEFAULT_CONFIG.functionWeights, water: 2 };
    const nodes = generateFunctionBasedLayout(cells, labels(), weights, allVisible());

    const water = nodes.find((n) => n.functionType === 'water')!;
    const green = nodes.find((n) => n.functionType === 'green')!;
    expect(water.radius).toBeCloseTo(green.radius * 2, 6);
  });

  it('omits hidden function types', () => {
    const cells = makeCells(2);
    const visible = { ...allVisible(), water: false, pollution: false };
    const nodes = generateFunctionBasedLayout(
      cells,
      labels(),
      DEFAULT_CONFIG.functionWeights,
      visible
    );

    expect(nodes.some((n) => n.functionType === 'water')).toBe(false);
    expect(nodes.some((n) => n.functionType === 'pollution')).toBe(false);
    expect(nodes.some((n) => n.functionType === 'green')).toBe(true);
  });

  it('emits one node per cell plus one per visible function', () => {
    const cells = makeCells(3);
    const visible = { ...allVisible(), water: false };
    const nodes = generateFunctionBasedLayout(
      cells,
      labels(),
      DEFAULT_CONFIG.functionWeights,
      visible
    );
    expect(nodes).toHaveLength(3 + 3 * (FUNCTION_TYPES.length - 1));
  });

  it('gives every node a unique id', () => {
    const nodes = generateFunctionBasedLayout(
      makeCells(6),
      labels(),
      DEFAULT_CONFIG.functionWeights,
      allVisible()
    );
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
  });

  it('tags function nodes with their parent cell so drags select correctly', () => {
    const cells = makeCells(2);
    const nodes = generateFunctionBasedLayout(
      cells,
      labels(),
      DEFAULT_CONFIG.functionWeights,
      allVisible()
    );
    const ids = new Set(cells.map((c) => c.id));
    for (const node of nodes.filter((n) => n.type === 'function')) {
      expect(ids.has(node.cellId!)).toBe(true);
    }
  });

  it('returns nothing for an empty network', () => {
    expect(
      generateFunctionBasedLayout([], labels(), DEFAULT_CONFIG.functionWeights, allVisible())
    ).toEqual([]);
  });
});

describe('generateFunctionConnections', () => {
  it('links every pair sharing a visible function', () => {
    const cells = makeCells(3);
    const connections = generateFunctionConnections(cells, allVisible());
    // Every cell carries all nine functions, so all pairs are connected.
    expect(connections).toHaveLength(3);
  });

  it('drops pairs once their shared functions are hidden', () => {
    const cells = makeCells(3);
    const noneVisible = Object.fromEntries(
      FUNCTION_TYPES.map((t) => [t, false])
    ) as Record<FunctionType, boolean>;
    expect(generateFunctionConnections(cells, noneVisible)).toHaveLength(0);
  });
});
