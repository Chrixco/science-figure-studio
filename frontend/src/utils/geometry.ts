import { Point, Cell, FunctionNode, FUNCTION_TYPES, NetworkConfig, LayoutTemplate } from '../types';
import { generateCells } from './cellGeneration';

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Distance between two points
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Check if two circles overlap
export function circlesOverlap(c1: Point, r1: number, c2: Point, r2: number): boolean {
  return distance(c1, c2) < r1 + r2;
}

// Line-circle intersection for smart line drawing
// Returns array of [t, entering] pairs where t is parameter along line and entering indicates entry/exit
export function lineCircleIntersections(
  p1: Point,
  p2: Point,
  center: Point,
  radius: number
): Array<{ t: number; entering: boolean }> {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return [];
  }

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);

  const intersections: Array<{ t: number; entering: boolean }> = [];

  if (t1 >= 0 && t1 <= 1) {
    intersections.push({ t: t1, entering: true });
  }
  if (t2 >= 0 && t2 <= 1) {
    intersections.push({ t: t2, entering: false });
  }

  return intersections;
}

// Get point along line at parameter t
export function pointOnLine(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
}

// Calculate segments for smart line rendering
export interface LineSegment {
  start: Point;
  end: Point;
  opacity: number;
  lineWidth: number;
}

export function calculateSmartLineSegments(
  p1: Point,
  p2: Point,
  circles: Array<{ center: Point; radius: number }>,
  baseLineWidth: number
): LineSegment[] {
  // Collect all intersection events
  const events: Array<{ t: number; delta: number }> = [];

  for (const circle of circles) {
    const intersections = lineCircleIntersections(p1, p2, circle.center, circle.radius);
    for (const { t, entering } of intersections) {
      events.push({ t, delta: entering ? 1 : -1 });
    }
  }

  // Check if start point is inside any circle
  let insideCount = circles.filter(c => distance(p1, c.center) < c.radius).length;

  // Sort events by t
  events.sort((a, b) => a.t - b.t);

  // Build segments
  const segments: LineSegment[] = [];
  let lastT = 0;

  for (const event of events) {
    if (event.t > lastT) {
      const isInside = insideCount > 0;
      segments.push({
        start: pointOnLine(p1, p2, lastT),
        end: pointOnLine(p1, p2, event.t),
        opacity: isInside ? 0.25 : 1.0,
        lineWidth: isInside ? baseLineWidth * 0.75 : baseLineWidth
      });
    }
    insideCount += event.delta;
    lastT = event.t;
  }

  // Final segment
  if (lastT < 1) {
    const isInside = insideCount > 0;
    segments.push({
      start: pointOnLine(p1, p2, lastT),
      end: p2,
      opacity: isInside ? 0.25 : 1.0,
      lineWidth: isInside ? baseLineWidth * 0.75 : baseLineWidth
    });
  }

  return segments;
}

// =============================================================================
// CELL GEOMETRY CALCULATIONS
// =============================================================================
//
// Cell Structure (from center outward):
// 1. Living circle (center) - radius: livingRadius
// 2. Function circles - positioned on a ring around living, each with radius: functionRadius * weight
// 3. Cell border (outer dashed circle) - must contain all function circles
//
// Key formulas:
// - maxWeightedFunctionRadius = functionRadius * max(all weights)
// - ringRadius = livingRadius + gap + maxWeightedFunctionRadius  (where functions are centered)
// - cellRadius = ringRadius + maxWeightedFunctionRadius + padding (outer border)
// - minSpacing = 2 * cellRadius + gap (for overlap avoidance)
// =============================================================================

// Calculate the maximum weighted function radius
export function getMaxWeightedFunctionRadius(
  baseFunctionRadius: number,
  functionWeights: Record<string, number>
): number {
  const weights = Object.values(functionWeights);
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 1.0;
  return baseFunctionRadius * Math.max(maxWeight, 1.0);
}

// Calculate the ring radius where function circle CENTERS are placed
// This must be far enough from living center so function circles don't overlap with it
export function calculateFunctionRingRadius(
  livingRadius: number,
  functionRadius: number,
  functionWeights: Record<string, number>
): number {
  const maxWeightedRadius = getMaxWeightedFunctionRadius(functionRadius, functionWeights);

  // Gap between living circle edge and nearest function circle edge
  const gapBetweenLivingAndFunctions = livingRadius * 0.15;

  // Ring radius = livingRadius + gap + maxWeightedRadius
  // (function centers are placed here, so function edge touches: ringRadius - maxWeightedRadius)
  return livingRadius + gapBetweenLivingAndFunctions + maxWeightedRadius;
}

// Calculate the dynamic cell border radius
// This is the outer dashed circle that contains everything
export function calculateCellBorderRadius(
  livingRadius: number,
  functionRadius: number,
  functionWeights: Record<string, number>
): number {
  const maxWeightedRadius = getMaxWeightedFunctionRadius(functionRadius, functionWeights);
  const ringRadius = calculateFunctionRingRadius(livingRadius, functionRadius, functionWeights);

  // Padding between outermost function circle edge and cell border
  const outerPadding = livingRadius * 0.1;

  // Cell border = ringRadius + maxWeightedRadius + padding
  // (function centers at ringRadius, so outer edge at ringRadius + maxWeightedRadius)
  return ringRadius + maxWeightedRadius + outerPadding;
}

// Generate function positions in a ring around the living center
// visibleTypes: if provided, only positions for these types are calculated and evenly distributed
export function generateFunctionPositions(
  center: Point,
  livingRadius: number,
  functionRadius: number,
  functionWeights: Record<string, number>,
  visibleTypes?: string[],
  startAngle?: number
): Point[] {
  const positions: Point[] = [];
  const ringRadius = calculateFunctionRingRadius(livingRadius, functionRadius, functionWeights);

  // Use provided start angle or generate random one
  const angle0 = startAngle !== undefined ? startAngle : Math.random() * Math.PI * 2;

  // If visibleTypes provided, only generate for those (evenly distributed)
  // Otherwise generate for all FUNCTION_TYPES
  const typesToPosition = visibleTypes || FUNCTION_TYPES;
  const count = typesToPosition.length;

  if (count === 0) {
    // Return empty positions for all function types
    return FUNCTION_TYPES.map(() => ({ x: center.x, y: center.y }));
  }

  // Create a map of type -> position for visible types
  const typePositionMap = new Map<string, Point>();

  for (let i = 0; i < count; i++) {
    const angle = angle0 + (i / count) * Math.PI * 2;
    typePositionMap.set(typesToPosition[i], {
      x: center.x + Math.cos(angle) * ringRadius,
      y: center.y + Math.sin(angle) * ringRadius
    });
  }

  // Return positions in FUNCTION_TYPES order
  // Hidden functions get center position (they won't be rendered anyway)
  for (const type of FUNCTION_TYPES) {
    const pos = typePositionMap.get(type);
    positions.push(pos || { x: center.x, y: center.y });
  }

  return positions;
}

// Create a complete cell with functions
export function createCell(
  position: Point,
  config: NetworkConfig,
  cellIndex?: number
): Cell {
  // Generate function positions using dynamic ring radius based on weights
  const functionPositions = generateFunctionPositions(
    position,
    config.livingRadius,
    config.functionRadius,
    config.functionWeights
  );

  const functions: FunctionNode[] = FUNCTION_TYPES.map((type, index) => ({
    id: generateId(),
    type,
    position: functionPositions[index],
    radius: config.functionRadius
  }));

  // Calculate cell border radius that contains all function circles
  const cellBorderRadius = calculateCellBorderRadius(
    config.livingRadius,
    config.functionRadius,
    config.functionWeights
  );

  return {
    id: generateId(),
    label: cellIndex !== undefined ? `Cell ${cellIndex + 1}` : 'Cell',
    position,
    radius: cellBorderRadius,
    livingRadius: config.livingRadius,
    functions
  };
}

// Canvas scale factor - 10x larger coordinate space
export const CANVAS_SCALE = 10;

// =============================================================================
// OVERLAP AVOIDANCE
// =============================================================================
//
// For two cells NOT to overlap:
//   distance(center1, center2) >= radius1 + radius2 + gap
//
// Since all cells have the same configuration, we use:
//   minSpacing = 2 * cellBorderRadius + gap
// =============================================================================

// Calculate minimum distance between cell centers to avoid overlap
export function calculateMinSpacing(config: NetworkConfig, scaled: boolean = true): number {
  const scale = scaled ? CANVAS_SCALE : 1;

  // Calculate cell border radius (the outer dashed circle)
  const cellBorderRadius = calculateCellBorderRadius(
    config.livingRadius * scale,
    config.functionRadius * scale,
    config.functionWeights
  );

  // BEST PRACTICE: Use absolute buffer distance (not percentage)
  // Formula: minSpacing = radius1 + radius2 + buffer
  // For identical cells: minSpacing = 2 * cellBorderRadius + buffer
  //
  // Convert cellSpacing (0.0-1.0) to absolute buffer:
  // buffer = cellSpacing * cellBorderRadius
  //
  // This gives predictable, auditable spacing:
  // - cellSpacing=0.0 → cells just touch (distance = 2*radius)
  // - cellSpacing=0.1 → 10% of cell radius as gap
  // - cellSpacing=0.5 → 50% of cell radius as gap

  const buffer = config.avoidOverlap ? config.cellSpacing * cellBorderRadius : 0;
  return 2 * cellBorderRadius + buffer;
}

// Generate random cell positions with collision avoidance
// CRITICAL: This function ALWAYS respects minSpacing
// It will place fewer cells rather than violate spacing
export function generateCellPositions(
  count: number,
  minSpacing: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  existingPositions: Point[] = []
): Point[] {
  const positions: Point[] = [];
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 5000;  // Much higher to allow more attempts

  // All positions to check against (existing + newly generated)
  const allPositions = [...existingPositions];

  // Keep trying until we've had enough consecutive failures
  // This ensures we NEVER place cells that violate minSpacing
  while (positions.length < count && consecutiveFailures < maxConsecutiveFailures) {
    const candidate: Point = {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY)
    };

    // Check if candidate overlaps with ANY existing position
    // MUST RESPECT minSpacing - this is not optional
    const hasCollision = allPositions.some(p => distance(p, candidate) < minSpacing);

    if (!hasCollision) {
      // Success - add position and reset failure counter
      positions.push(candidate);
      allPositions.push(candidate);
      consecutiveFailures = 0;  // Reset on each success
    } else {
      // Failure - increment counter
      consecutiveFailures++;
    }
  }

  // CRITICAL FIX: Never place cells that violate spacing!
  // If we couldn't place all cells with proper spacing, that's OK.
  // Better to have fewer cells with correct spacing than overlapping cells.
  //
  // The original code had a fallback that placed random cells without checking spacing.
  // That's why there were 23 collisions. We NEVER do that.

  if (positions.length < count) {
    console.warn(
      `Could only place ${positions.length}/${count} cells with minSpacing=${minSpacing.toFixed(2)}.`,
      `Available space may be too small. Either:`,
      `1. Reduce cell count`,
      `2. Increase canvas size`,
      `3. Reduce cellSpacing in avoidOverlap settings`
    );
  }

  return positions;
}

// ============================================================================
// CELL GENERATION - SINGLE SOURCE OF TRUTH
// ============================================================================
// ALL cell generation goes through cellGeneration.ts for consistent spacing
// ============================================================================

/**
 * Generate network with RANDOM layout
 * Uses cellGeneration.ts for proper spacing enforcement
 */
export function generateNetwork(config: NetworkConfig): Cell[] {
  return generateCells(config, 'random');
}

/**
 * Generate network with specified layout template
 * ULTRATHINK FIX: Now uses cellGeneration.ts for ALL layouts
 * Ensures consistent spacing across random, grid, circle, cluster
 */
export function generateNetworkWithTemplate(config: NetworkConfig, template: LayoutTemplate): Cell[] {
  return generateCells(config, template as 'random' | 'grid' | 'circle' | 'cluster');
}

// DEPRECATED: Old layout functions - DO NOT USE
// These are kept for reference but should not be called directly
// Use generateCells() instead

export function generateGridLayout(count: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }): Point[] {
  // DEPRECATED - use generateCells(config, 'grid') instead
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const positions: Point[] = [];

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

  return positions;
}

export function generateCircleLayout(count: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }): Point[] {
  // DEPRECATED - use generateCells(config, 'circle') instead
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const radius = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 * 0.8;
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

export function generateClusterLayout(count: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }, minSpacing: number): Point[] {
  // DEPRECATED - use generateCells(config, 'cluster') instead
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const maxRadius = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 * 0.7;
  const positions: Point[] = [];

  // Use golden angle for natural distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const radius = maxRadius * Math.sqrt((i + 0.5) / count);
    const angle = i * goldenAngle;
    const candidate = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };

    // Check collision with existing positions
    let valid = true;
    for (const pos of positions) {
      if (distance(pos, candidate) < minSpacing) {
        valid = false;
        break;
      }
    }

    if (valid) {
      positions.push(candidate);
    } else {
      // Try a random offset
      positions.push({
        x: candidate.x + (Math.random() - 0.5) * minSpacing,
        y: candidate.y + (Math.random() - 0.5) * minSpacing
      });
    }
  }

  return positions;
}

// Calculate bounding box of all cells
export function calculateBoundingBox(cells: Cell[]): {
  minX: number; maxX: number; minY: number; maxY: number;
  centerX: number; centerY: number; width: number; height: number
} {
  if (cells.length === 0) {
    return { minX: 0, maxX: CANVAS_SCALE, minY: 0, maxY: CANVAS_SCALE, centerX: CANVAS_SCALE/2, centerY: CANVAS_SCALE/2, width: CANVAS_SCALE, height: CANVAS_SCALE };
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  cells.forEach(cell => {
    const r = cell.radius;
    minX = Math.min(minX, cell.position.x - r);
    maxX = Math.max(maxX, cell.position.x + r);
    minY = Math.min(minY, cell.position.y - r);
    maxY = Math.max(maxY, cell.position.y + r);
  });

  // Add some padding
  const paddingFactor = 0.1;
  const width = maxX - minX;
  const height = maxY - minY;
  const padding = Math.max(width, height) * paddingFactor;

  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  return {
    minX, maxX, minY, maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY
  };
}

// Update cell position (for dragging)
export function updateCellPosition(cell: Cell, newPosition: Point): Cell {
  const dx = newPosition.x - cell.position.x;
  const dy = newPosition.y - cell.position.y;

  return {
    ...cell,
    position: newPosition,
    functions: cell.functions.map(fn => ({
      ...fn,
      position: {
        x: fn.position.x + dx,
        y: fn.position.y + dy
      }
    }))
  };
}

// Recalculate cell geometry (radius and function positions) based on current weights and visibility
// Used when function weights or visibility changes to update existing cells
export function recalculateCellGeometry(
  cell: Cell,
  config: NetworkConfig
): Cell {
  // Calculate new cell border radius
  const newRadius = calculateCellBorderRadius(
    cell.livingRadius,
    config.functionRadius * CANVAS_SCALE,
    config.functionWeights
  );

  // Get list of visible function types
  const visibleTypes = FUNCTION_TYPES.filter(type => config.functionVisible[type]);

  // Calculate the current start angle to maintain rotation consistency
  // Find the first visible function and calculate its angle
  let startAngle: number | undefined;
  const firstVisible = cell.functions.find(fn => config.functionVisible[fn.type]);
  if (firstVisible) {
    const dx = firstVisible.position.x - cell.position.x;
    const dy = firstVisible.position.y - cell.position.y;
    const currentAngle = Math.atan2(dy, dx);
    const visibleIndex = visibleTypes.indexOf(firstVisible.type);
    // Calculate what the start angle should be based on current position
    startAngle = currentAngle - (visibleIndex / visibleTypes.length) * Math.PI * 2;
  }

  // Recalculate function positions with new ring radius and visibility
  const newFunctionPositions = generateFunctionPositions(
    cell.position,
    cell.livingRadius,
    config.functionRadius * CANVAS_SCALE,
    config.functionWeights,
    visibleTypes,
    startAngle
  );

  return {
    ...cell,
    radius: newRadius,
    functions: cell.functions.map((fn, index) => ({
      ...fn,
      position: newFunctionPositions[index],
      radius: config.functionRadius * CANVAS_SCALE
    }))
  };
}

// Generate random hex color
export function randomColor(): string {
  const h = Math.random() * 360;
  const s = 70 + Math.random() * 30; // 70-100% saturation
  const l = 45 + Math.random() * 20; // 45-65% lightness
  return hslToHex(h, s, l);
}

// HSL to Hex conversion
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
