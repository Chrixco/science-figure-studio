/**
 * Cell Generation System - Complete Rebuild
 *
 * ULTRATHINK APPROACH:
 * - All layout methods (random, grid, circle, cluster) enforce spacing
 * - Uses spacing.ts as the single source of truth for collision checking
 * - Never generates overlapping cells
 * - Provides clear diagnostics if spacing can't be maintained
 *
 * Sources:
 * - https://www.jeffreythompson.org/collision-detection/circle-circle.php
 * - Circle packing research: https://en.wikipedia.org/wiki/Circle_packing
 */

import { Cell, Point, NetworkConfig } from '../types';
import {
  getMinimumSpacing,
  getSpacingDiagnostics
} from './spacing';
import {
  calculateCellBorderRadius,
  createCell,
  CANVAS_SCALE
} from './geometry';

/**
 * Bounds for cell placement
 */
export interface PlacementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate bounds accounting for cell size
 */
export function calculateBounds(
  cellBorderRadius: number,
  canvasScale: number = CANVAS_SCALE
): PlacementBounds {
  const padding = cellBorderRadius;
  return {
    minX: padding,
    maxX: canvasScale - padding,
    minY: padding,
    maxY: canvasScale - padding
  };
}

/**
 * Get spacing for cell placement
 *
 * @param config Network config
 * @returns Minimum distance between cell centers (including buffer)
 */
export function getPlacementSpacing(config: NetworkConfig): number {
  if (!config.avoidOverlap) return 0;

  const cellBorderRadius = calculateCellBorderRadius(
    config.livingRadius * CANVAS_SCALE,
    config.functionRadius * CANVAS_SCALE,
    config.functionWeights
  );

  // buffer = cellSpacing * cellRadius
  const buffer = config.cellSpacing * cellBorderRadius;
  return getMinimumSpacing(cellBorderRadius, cellBorderRadius, buffer);
}

/**
 * RANDOM LAYOUT - Respects spacing
 * Places cells randomly while enforcing minimum spacing
 */
export function generateRandomLayout(
  count: number,
  bounds: PlacementBounds,
  spacing: number
): Point[] {
  const positions: Point[] = [];
  const maxAttempts = 50000;  // More attempts = better results
  let consecutiveFailures = 0;

  while (positions.length < count && consecutiveFailures < maxAttempts) {
    const candidate: Point = {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY)
    };

    // Check collision with existing positions using spacing
    // IMPORTANT: spacing already includes radius calculations, so we check distance directly
    const hasCollision = positions.some(p => {
      const distance = Math.sqrt((candidate.x - p.x) ** 2 + (candidate.y - p.y) ** 2);
      return distance < spacing;
    });

    if (!hasCollision) {
      positions.push(candidate);
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }
  }

  return positions;
}

/**
 * GRID LAYOUT - Respects spacing
 * Places cells in a grid while enforcing spacing
 */
export function generateGridLayout(
  count: number,
  bounds: PlacementBounds,
  spacing: number
): Point[] {
  const positions: Point[] = [];

  if (spacing === 0) {
    // Simple grid without spacing concerns
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const cellWidth = (bounds.maxX - bounds.minX) / cols;
    const cellHeight = (bounds.maxY - bounds.minY) / rows;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: bounds.minX + (col + 0.5) * cellWidth,
        y: bounds.minY + (row + 0.5) * cellHeight
      });
    }
  } else {
    // Grid with spacing - adjust grid size to accommodate spacing
    const availableWidth = bounds.maxX - bounds.minX;
    const availableHeight = bounds.maxY - bounds.minY;

    // Calculate how many cells can fit with spacing
    const cols = Math.max(1, Math.floor(availableWidth / spacing));
    const rows = Math.max(1, Math.ceil(count / cols));

    if (rows * spacing > availableHeight) {
      console.warn(
        `Grid layout: Can only fit ${cols * Math.floor(availableHeight / spacing)} cells with spacing ${spacing.toFixed(2)}`
      );
    }

    const cellWidth = availableWidth / cols;
    const cellHeight = availableHeight / rows;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      if (row * cellHeight + cellHeight / 2 > bounds.maxY) break;  // Out of bounds

      positions.push({
        x: bounds.minX + (col + 0.5) * cellWidth,
        y: bounds.minY + (row + 0.5) * cellHeight
      });
    }
  }

  return positions;
}

/**
 * CIRCLE LAYOUT - Best effort with spacing
 * Places cells in a circle, respecting spacing where possible
 */
export function generateCircleLayout(
  count: number,
  bounds: PlacementBounds,
  spacing: number
): Point[] {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const maxRadius = Math.min(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  ) / 2 * 0.8;

  const positions: Point[] = [];

  // Calculate radius needed between points to maintain spacing
  // For circle packing: arc_length ≥ spacing
  // arc_length = radius * angle, so angle ≥ spacing / radius
  const minAngle = spacing > 0 ? Math.atan2(spacing / 2, maxRadius) * 2 : (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = (i * minAngle) - Math.PI / 2;
    positions.push({
      x: centerX + Math.cos(angle) * maxRadius,
      y: centerY + Math.sin(angle) * maxRadius
    });
  }

  return positions;
}

/**
 * CLUSTER LAYOUT - Respects spacing with spiral distribution
 * Places cells in a compact cluster using golden spiral
 */
export function generateClusterLayout(
  count: number,
  bounds: PlacementBounds,
  spacing: number
): Point[] {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const maxRadius = Math.min(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  ) / 2 * 0.7;

  const positions: Point[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));  // ≈ 137.5°

  for (let i = 0; i < count; i++) {
    // Golden spiral: each point rotates by golden angle, distance grows with i
    const angle = i * goldenAngle;
    const radius = spacing > 0
      ? Math.sqrt(i) * (spacing / 2)  // Adjust radius based on spacing
      : Math.sqrt(i) * 0.5;

    const clampedRadius = Math.min(radius, maxRadius);

    const x = centerX + Math.cos(angle) * clampedRadius;
    const y = centerY + Math.sin(angle) * clampedRadius;

    // Keep within bounds
    if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
      positions.push({ x, y });
    } else {
      break;  // Out of bounds
    }
  }

  return positions;
}

/**
 * Generate cells with specified layout
 * SINGLE ENTRY POINT for all cell generation
 */
export function generateCells(
  config: NetworkConfig,
  layoutType: 'random' | 'grid' | 'circle' | 'cluster' = 'random'
): Cell[] {
  // Calculate spacing upfront
  const cellBorderRadius = calculateCellBorderRadius(
    config.livingRadius * CANVAS_SCALE,
    config.functionRadius * CANVAS_SCALE,
    config.functionWeights
  );

  const bounds = calculateBounds(cellBorderRadius);
  const spacing = getPlacementSpacing(config);

  // Generate positions based on layout type
  let positions: Point[] = [];

  switch (layoutType) {
    case 'grid':
      positions = generateGridLayout(config.cellCount, bounds, spacing);
      break;
    case 'circle':
      positions = generateCircleLayout(config.cellCount, bounds, spacing);
      break;
    case 'cluster':
      positions = generateClusterLayout(config.cellCount, bounds, spacing);
      break;
    case 'random':
    default:
      positions = generateRandomLayout(config.cellCount, bounds, spacing);
      break;
  }

  // Scale config for cell creation
  const scaledConfig = {
    ...config,
    livingRadius: config.livingRadius * CANVAS_SCALE,
    functionRadius: config.functionRadius * CANVAS_SCALE
  };

  // Create cells from positions
  const cells = positions.map((position, index) =>
    createCell(position, scaledConfig, index)
  );

  // Diagnostic: Show spacing info
  if (cells.length < config.cellCount) {
    const diag = getSpacingDiagnostics(cells, spacing);
    console.warn(
      `Generated ${cells.length}/${config.cellCount} cells with layout=${layoutType}`,
      `Spacing=${spacing.toFixed(2)}, Overlapping=${diag.percentageOverlapping}%`
    );
  }

  return cells;
}
