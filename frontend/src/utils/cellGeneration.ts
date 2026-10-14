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
 * Fraction of the placement domain that may be occupied by cell exclusion
 * discs.
 *
 * Random sequential placement of equal discs saturates around 0.547 -- beyond
 * that the sampler rejects far more candidates than it accepts. Sizing the
 * domain for a comfortable 0.45 keeps placement fast and reliable.
 */
const TARGET_PACKING_DENSITY = 0.45;

/**
 * Calculate bounds for cell placement, sized to actually hold `count` cells.
 *
 * This used to return a fixed CANVAS_SCALE box regardless of how many cells
 * were requested. At default settings that gives a 5.5x5.5 usable area while
 * each cell needs 4.725 units of separation -- room for two or three cells, not
 * the six the user asked for. Every layout template then silently returned
 * short, and the UI reported the requested count regardless.
 *
 * The domain now grows with the requested count so the templates can always
 * place every cell. It never shrinks below CANVAS_SCALE, so small networks look
 * exactly as they did before.
 */
export function calculateBounds(
  cellBorderRadius: number,
  count: number = 1,
  spacing: number = 0,
  canvasScale: number = CANVAS_SCALE
): PlacementBounds {
  const padding = cellBorderRadius;

  // Centre-to-centre pitch each cell demands. With overlap avoidance off,
  // spacing is 0 and the cell's own footprint is the only constraint.
  const pitch = Math.max(spacing, cellBorderRadius * 2);

  // Area needed for `count` exclusion discs at the target density, expressed
  // as the side of a square interior.
  const discArea = Math.PI * (pitch / 2) ** 2;
  const interiorSide = Math.sqrt((count * discArea) / TARGET_PACKING_DENSITY);

  const side = Math.max(canvasScale, interiorSide + padding * 2);

  return {
    minX: padding,
    maxX: side - padding,
    minY: padding,
    maxY: side - padding
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
  // Rejection sampling alone can stall even in a domain sized to fit: a few
  // unlucky early placements can wall off the remaining room. When that
  // happens, expand the domain slightly and keep going rather than returning
  // fewer cells than were asked for.
  const ATTEMPTS_PER_ROUND = 5000;
  const MAX_EXPANSIONS = 20;
  const EXPANSION_FACTOR = 1.15;

  const positions: Point[] = [];
  let current = bounds;

  for (let expansion = 0; expansion <= MAX_EXPANSIONS; expansion++) {
    let failures = 0;

    while (positions.length < count && failures < ATTEMPTS_PER_ROUND) {
      const candidate: Point = {
        x: current.minX + Math.random() * (current.maxX - current.minX),
        y: current.minY + Math.random() * (current.maxY - current.minY)
      };

      // `spacing` is already a centre-to-centre distance, so compare directly.
      const hasCollision = positions.some(p => {
        const distance = Math.sqrt((candidate.x - p.x) ** 2 + (candidate.y - p.y) ** 2);
        return distance < spacing;
      });

      if (!hasCollision) {
        positions.push(candidate);
        failures = 0;
      } else {
        failures++;
      }
    }

    if (positions.length >= count) break;
    current = expandBounds(current, EXPANSION_FACTOR);
  }

  return positions;
}

/** Grow bounds about their centre, keeping them square. */
function expandBounds(bounds: PlacementBounds, factor: number): PlacementBounds {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const halfWidth = ((bounds.maxX - bounds.minX) / 2) * factor;
  const halfHeight = ((bounds.maxY - bounds.minY) / 2) * factor;
  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight
  };
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
  if (count <= 0) return [];

  // Choose a grid shape for the requested count, then use whichever pitch is
  // larger: what the bounds allow, or what `spacing` demands. Previously the
  // column count was derived from the bounds, so a domain too small for the
  // requested spacing silently dropped the overflow rows.
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const availableWidth = bounds.maxX - bounds.minX;
  const availableHeight = bounds.maxY - bounds.minY;

  const pitchX = Math.max(spacing, availableWidth / cols);
  const pitchY = Math.max(spacing, availableHeight / rows);

  // Centre the grid on the bounds so growing the pitch expands symmetrically.
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const startX = centerX - ((cols - 1) * pitchX) / 2;
  const startY = centerY - ((rows - 1) * pitchY) / 2;

  const positions: Point[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * pitchX,
      y: startY + row * pitchY
    });
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
  if (count <= 0) return [];

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const boundsRadius =
    (Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2) * 0.8;

  // Chord between neighbours on a ring of radius r is 2r*sin(pi/count). Solve
  // for the r that makes that chord at least `spacing`, and use whichever is
  // larger -- the ring the bounds suggest, or the ring the spacing requires.
  // The old version always used the bounds radius and stepped by a fixed angle,
  // so large counts wrapped past 360 degrees and stacked cells on top of
  // each other.
  const requiredRadius =
    count > 1 && spacing > 0 ? spacing / (2 * Math.sin(Math.PI / count)) : 0;
  const radius = Math.max(boundsRadius, requiredRadius);

  const positions: Point[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
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
  if (count <= 0) return [];

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees

  // Vogel spiral: r = c*sqrt(i). Build it with a provisional scale, measure the
  // tightest pair, then rescale once so that pair sits exactly at `spacing`.
  // Because every distance scales linearly with c, that single correction is
  // exact -- no iteration and no guessed constant.
  //
  // The previous version clamped radii to the bounds and broke out of the loop
  // on the first point that fell outside, so a compact cluster quietly lost
  // most of its cells.
  const offsets: Point[] = [];
  for (let i = 0; i < count; i++) {
    const angle = i * goldenAngle;
    const radius = Math.sqrt(i);
    offsets.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  let scale = spacing > 0 ? spacing / 2 : 0.5;

  if (spacing > 0 && count > 1) {
    let minDistance = Infinity;
    for (let a = 0; a < offsets.length; a++) {
      for (let b = a + 1; b < offsets.length; b++) {
        const dx = offsets[a].x - offsets[b].x;
        const dy = offsets[a].y - offsets[b].y;
        minDistance = Math.min(minDistance, Math.sqrt(dx * dx + dy * dy));
      }
    }
    if (minDistance > 0 && Number.isFinite(minDistance)) {
      scale = spacing / minDistance;
    }
  }

  return offsets.map((offset) => ({
    x: centerX + offset.x * scale,
    y: centerY + offset.y * scale
  }));
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

  const spacing = getPlacementSpacing(config);
  const bounds = calculateBounds(cellBorderRadius, config.cellCount, spacing);

  // Generate positions based on layout type
  let positions: Point[];

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
