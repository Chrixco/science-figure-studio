/**
 * Spacing & Collision Buffer System (Complete Rebuild)
 *
 * BEST PRACTICES APPLIED:
 * 1. Uses absolute buffer distance (units), not percentages
 * 2. Enforced during both generation AND resolution
 * 3. Identical formula in 2D and 3D (no scale confusion)
 * 4. Clear, auditable, testable code
 *
 * FORMULA (Industry Standard):
 * ──────────────────────────
 * minDistance = radius1 + radius2 + bufferDistance
 *
 * If distance < minDistance → COLLISION
 * If distance ≥ minDistance → NO COLLISION (with buffer)
 *
 * Sources:
 * - https://www.jeffreythompson.org/collision-detection/circle-circle.php
 * - https://www.toptal.com/game/video-game-physics-part-ii-collision-detection-for-solid-objects
 */

import { Cell, Point } from '../types';

/**
 * Calculate distance between two points
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance between points
 */
export function calculateDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance squared (more efficient, avoids sqrt)
 * Use when comparing: distSquared < minDistSquared
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance squared
 */
export function calculateDistanceSquared(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Core Collision Check - Pure Function
 * ─────────────────────────────────────
 * Check if two circles are overlapping
 *
 * @param pos1 Position of circle 1
 * @param radius1 Radius of circle 1
 * @param pos2 Position of circle 2
 * @param radius2 Radius of circle 2
 * @param buffer Minimum spacing distance (default: 0)
 * @returns true if collision occurs
 */
export function isColliding(
  pos1: Point,
  radius1: number,
  pos2: Point,
  radius2: number,
  buffer: number = 0
): boolean {
  const minDistance = radius1 + radius2 + buffer;
  const distance = calculateDistance(pos1, pos2);
  return distance < minDistance;
}

/**
 * Check collision using squared distances (faster, no sqrt)
 */
export function isCollidingSquared(
  pos1: Point,
  radius1: number,
  pos2: Point,
  radius2: number,
  buffer: number = 0
): boolean {
  const minDistance = radius1 + radius2 + buffer;
  const minDistanceSquared = minDistance * minDistance;
  const distanceSquared = calculateDistanceSquared(pos1, pos2);
  return distanceSquared < minDistanceSquared;
}

/**
 * Get minimum required spacing for two circles
 *
 * @param radius1 Radius of circle 1
 * @param radius2 Radius of circle 2
 * @param buffer Additional buffer spacing
 * @returns Minimum distance between centers
 */
export function getMinimumSpacing(
  radius1: number,
  radius2: number,
  buffer: number = 0
): number {
  return radius1 + radius2 + buffer;
}

/**
 * Check if a candidate position collides with any existing positions
 *
 * @param candidatePos New position to test
 * @param candidateRadius Radius of candidate
 * @param existingPositions Array of existing positions
 * @param existingRadii Array of existing radii (must match length of positions)
 * @param buffer Buffer distance
 * @returns true if candidate collides with any existing position
 */
export function hasCollisionWithAny(
  candidatePos: Point,
  candidateRadius: number,
  existingPositions: Point[],
  existingRadii: number[],
  buffer: number = 0
): boolean {
  for (let i = 0; i < existingPositions.length; i++) {
    if (isColliding(
      candidatePos,
      candidateRadius,
      existingPositions[i],
      existingRadii[i],
      buffer
    )) {
      return true;
    }
  }
  return false;
}

/**
 * Spatial Hash Grid for efficient collision detection
 * Divides space into grid cells to avoid O(n²) comparisons
 */
export class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, { pos: Point; radius: number; id: string }[]>;

  constructor(cellSize: number = 2.0) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /**
   * Get grid key for a position
   */
  private getGridKey(x: number, y: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return `${gx},${gy}`;
  }

  /**
   * Add item to grid
   */
  add(pos: Point, radius: number, id: string): void {
    const key = this.getGridKey(pos.x, pos.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push({ pos, radius, id });
  }

  /**
   * Get candidate items (neighboring grid cells)
   */
  getCandidates(pos: Point, maxRadius: number): { pos: Point; radius: number; id: string }[] {
    const candidates = new Set<{ pos: Point; radius: number; id: string }>();
    const searchRadius = Math.ceil((maxRadius * 2) / this.cellSize) + 1;

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const key = this.getGridKey(
          pos.x + dx * this.cellSize,
          pos.y + dy * this.cellSize
        );
        const items = this.grid.get(key) || [];
        items.forEach(item => candidates.add(item));
      }
    }

    return Array.from(candidates);
  }

  /**
   * Build grid from items
   */
  build(items: { pos: Point; radius: number; id: string }[]): void {
    this.grid.clear();
    items.forEach(item => this.add(item.pos, item.radius, item.id));
  }

  /**
   * Clear grid
   */
  clear(): void {
    this.grid.clear();
  }
}

/**
 * Resolve collisions by pushing cells apart
 * Uses iterative approach to separate overlapping pairs
 *
 * @param cells Array of cells to resolve
 * @param buffer Minimum spacing buffer
 * @param maxIterations Maximum iterations
 * @returns Resolved cells (deep copy with updated positions)
 */
export function resolveCollisions(
  cells: Cell[],
  buffer: number = 0,
  maxIterations: number = 10
): Cell[] {
  // Deep copy cells
  const resolved = cells.map(cell => ({
    ...cell,
    position: { ...cell.position }
  }));

  for (let iter = 0; iter < maxIterations; iter++) {
    let anyMoved = false;

    // Check all pairs for collisions
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const cell1 = resolved[i];
        const cell2 = resolved[j];

        const distance = calculateDistance(cell1.position, cell2.position);
        const minDistance = cell1.radius + cell2.radius + buffer;

        // If colliding, push apart
        if (distance < minDistance) {
          anyMoved = true;
          const overlap = minDistance - distance;

          // Direction from cell1 to cell2
          const dx = cell2.position.x - cell1.position.x;
          const dy = cell2.position.y - cell1.position.y;

          // Avoid division by zero
          if (distance < 0.001) {
            // Random direction if overlapping completely
            const angle = Math.random() * Math.PI * 2;
            cell1.position.x -= Math.cos(angle) * overlap / 2;
            cell1.position.y -= Math.sin(angle) * overlap / 2;
            cell2.position.x += Math.cos(angle) * overlap / 2;
            cell2.position.y += Math.sin(angle) * overlap / 2;
          } else {
            // Normal vector
            const nx = dx / distance;
            const ny = dy / distance;

            // Push equally
            const pushDistance = overlap / 2;
            cell1.position.x -= nx * pushDistance;
            cell1.position.y -= ny * pushDistance;
            cell2.position.x += nx * pushDistance;
            cell2.position.y += ny * pushDistance;
          }
        }
      }
    }

    // Stop if no cells moved this iteration
    if (!anyMoved) break;
  }

  return resolved;
}

/**
 * Detect all collisions between cells
 *
 * @param cells Array of cells
 * @param buffer Buffer distance for detection
 * @returns Array of colliding pairs
 */
export function detectAllCollisions(
  cells: Cell[],
  buffer: number = 0
): Array<{ id: string; cell1Id: string; cell2Id: string; distance: number; overlap: number }> {
  const collisions: Array<{ id: string; cell1Id: string; cell2Id: string; distance: number; overlap: number }> = [];
  const checked = new Set<string>();

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];

      const distance = calculateDistance(cell1.position, cell2.position);
      const minDistance = cell1.radius + cell2.radius + buffer;

      if (distance < minDistance) {
        const pairKey = [cell1.id, cell2.id].sort().join('|');
        if (!checked.has(pairKey)) {
          checked.add(pairKey);
          collisions.push({
            id: `${cell1.id}-${cell2.id}`,
            cell1Id: cell1.id,
            cell2Id: cell2.id,
            distance: parseFloat(distance.toFixed(2)),
            overlap: parseFloat((minDistance - distance).toFixed(2))
          });
        }
      }
    }
  }

  return collisions;
}

/**
 * Diagnostic: Get spacing information
 * Helps debug why cells are overlapping
 */
export function getSpacingDiagnostics(
  cells: Cell[],
  buffer: number = 0
): {
  avgCellRadius: number;
  minRequiredDistance: number;
  actualMinDistance: number;
  actualMaxDistance: number;
  percentageOverlapping: number;
} {
  if (cells.length === 0) {
    return {
      avgCellRadius: 0,
      minRequiredDistance: 0,
      actualMinDistance: Infinity,
      actualMaxDistance: 0,
      percentageOverlapping: 0
    };
  }

  const avgCellRadius = cells.reduce((sum, c) => sum + c.radius, 0) / cells.length;
  const minRequiredDistance = 2 * avgCellRadius + buffer;

  let minDistance = Infinity;
  let maxDistance = 0;
  let overlappingPairs = 0;

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const dist = calculateDistance(cells[i].position, cells[j].position);
      minDistance = Math.min(minDistance, dist);
      maxDistance = Math.max(maxDistance, dist);
      if (dist < minRequiredDistance) {
        overlappingPairs++;
      }
    }
  }

  const totalPairs = (cells.length * (cells.length - 1)) / 2;

  return {
    avgCellRadius: parseFloat(avgCellRadius.toFixed(2)),
    minRequiredDistance: parseFloat(minRequiredDistance.toFixed(2)),
    actualMinDistance: parseFloat(minDistance.toFixed(2)),
    actualMaxDistance: parseFloat(maxDistance.toFixed(2)),
    percentageOverlapping: parseFloat(((overlappingPairs / totalPairs) * 100).toFixed(1))
  };
}
