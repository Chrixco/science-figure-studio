import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, LayoutTemplate } from '../types';
import { calculateCellBorderRadius, CANVAS_SCALE } from './geometry';
import {
  calculateBounds,
  getPlacementSpacing,
  generateCells,
  generateRandomLayout,
  generateGridLayout,
  generateCircleLayout,
  generateClusterLayout,
} from './cellGeneration';

const TEMPLATES: LayoutTemplate[] = ['random', 'grid', 'circle', 'cluster'];
const COUNTS = [1, 2, 3, 4, 6, 8, 12, 20, 30];

function defaultSpacing() {
  return getPlacementSpacing(DEFAULT_CONFIG);
}

function defaultBorderRadius() {
  return calculateCellBorderRadius(
    DEFAULT_CONFIG.livingRadius * CANVAS_SCALE,
    DEFAULT_CONFIG.functionRadius * CANVAS_SCALE,
    DEFAULT_CONFIG.functionWeights
  );
}

function minPairDistance(points: { x: number; y: number }[]): number {
  let min = Infinity;
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const dx = points[a].x - points[b].x;
      const dy = points[a].y - points[b].y;
      min = Math.min(min, Math.hypot(dx, dy));
    }
  }
  return min;
}

describe('calculateBounds', () => {
  it('never shrinks below the base canvas for a single cell', () => {
    const bounds = calculateBounds(defaultBorderRadius(), 1, defaultSpacing());
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(CANVAS_SCALE);
  });

  it('grows the domain as the requested count rises', () => {
    const r = defaultBorderRadius();
    const spacing = defaultSpacing();
    const widths = COUNTS.map((n) => {
      const b = calculateBounds(r, n, spacing);
      return b.maxX - b.minX;
    });
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
    expect(widths[widths.length - 1]).toBeGreaterThan(widths[0]);
  });

  // The fixed 10x10 domain gave a 5.5x5.5 usable area against a required
  // separation of 4.725 -- room for two cells, not the six requested.
  it('provides enough area for the requested exclusion discs', () => {
    const r = defaultBorderRadius();
    const spacing = defaultSpacing();
    for (const count of COUNTS) {
      const b = calculateBounds(r, count, spacing);
      const area = (b.maxX - b.minX) * (b.maxY - b.minY);
      const discArea = count * Math.PI * (spacing / 2) ** 2;
      expect(area).toBeGreaterThan(discArea);
    }
  });
});

describe.each(TEMPLATES)('generateCells with the %s template', (template) => {
  it.each(COUNTS)('returns exactly %i cells', (count) => {
    const cells = generateCells({ ...DEFAULT_CONFIG, cellCount: count }, template);
    expect(cells).toHaveLength(count);
  });

  it('gives every cell a distinct id', () => {
    const cells = generateCells({ ...DEFAULT_CONFIG, cellCount: 12 }, template);
    expect(new Set(cells.map((c) => c.id)).size).toBe(12);
  });

  it('produces finite coordinates', () => {
    const cells = generateCells({ ...DEFAULT_CONFIG, cellCount: 12 }, template);
    for (const cell of cells) {
      expect(Number.isFinite(cell.position.x)).toBe(true);
      expect(Number.isFinite(cell.position.y)).toBe(true);
    }
  });
});

describe('layout spacing guarantees', () => {
  const spacing = 4.725;
  const bounds = { minX: 0, maxX: 20, minY: 0, maxY: 20 };

  it.each(COUNTS)('random keeps %i cells at least `spacing` apart', (count) => {
    const points = generateRandomLayout(count, bounds, spacing);
    expect(points).toHaveLength(count);
    if (count > 1) {
      expect(minPairDistance(points)).toBeGreaterThanOrEqual(spacing - 1e-9);
    }
  });

  it.each(COUNTS)('grid keeps %i cells at least `spacing` apart', (count) => {
    const points = generateGridLayout(count, bounds, spacing);
    expect(points).toHaveLength(count);
    if (count > 1) {
      expect(minPairDistance(points)).toBeGreaterThanOrEqual(spacing - 1e-9);
    }
  });

  it.each(COUNTS)('circle keeps %i cells at least `spacing` apart', (count) => {
    const points = generateCircleLayout(count, bounds, spacing);
    expect(points).toHaveLength(count);
    if (count > 1) {
      expect(minPairDistance(points)).toBeGreaterThanOrEqual(spacing - 1e-9);
    }
  });

  it.each(COUNTS)('cluster keeps %i cells at least `spacing` apart', (count) => {
    const points = generateClusterLayout(count, bounds, spacing);
    expect(points).toHaveLength(count);
    if (count > 1) {
      expect(minPairDistance(points)).toBeGreaterThanOrEqual(spacing - 1e-9);
    }
  });
});

describe('overlap avoidance disabled', () => {
  it('still returns the requested count', () => {
    const config = { ...DEFAULT_CONFIG, avoidOverlap: false, cellCount: 15 };
    expect(getPlacementSpacing(config)).toBe(0);
    for (const template of TEMPLATES) {
      expect(generateCells(config, template)).toHaveLength(15);
    }
  });
});
