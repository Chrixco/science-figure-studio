import { Cell } from '../types';

/**
 * 3D Collision Detection System
 * Efficiently detects overlapping cells in 3D space
 */

export interface Collision {
  id: string;
  cell1Id: string;
  cell2Id: string;
  cell1Label: string;
  cell2Label: string;
  distance: number;
  minDistance: number;
  overlapAmount: number; // How much they overlap
}

export interface CollisionStats {
  totalCells: number;
  overlappingCellCount: number;
  collisionCount: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  overlappingCellIds: Set<string>;
}

/**
 * Spatial Hash Grid for efficient collision detection
 * Divides 3D space into cells to avoid O(n²) comparisons
 */
export class SpatialHash {
  private cellSize: number;
  private grid: Map<string, Cell[]>;

  constructor(cellSize: number = 1.0) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /**
   * Get grid key for a position
   */
  private getGridKey(x: number, y: number, z: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    return `${gx},${gy},${gz}`;
  }

  /**
   * Add cell to spatial hash
   */
  addCell(cell: Cell): void {
    const key = this.getGridKey(cell.position.x, cell.position.y, 0);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(cell);
  }

  /**
   * Get candidate cells for collision (neighbors + self)
   */
  getCandidates(cell: Cell): Cell[] {
    const candidates = new Set<Cell>();
    const x = cell.position.x;
    const y = cell.position.y;
    const z = 0;

    // Check current cell and 8 neighbors
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = this.getGridKey(
          x + dx * this.cellSize,
          y + dy * this.cellSize,
          z
        );
        const cellsInBucket = this.grid.get(key) || [];
        cellsInBucket.forEach(c => candidates.add(c));
      }
    }

    return Array.from(candidates);
  }

  /**
   * Build hash from all cells
   */
  build(cells: Cell[]): void {
    this.grid.clear();
    cells.forEach(cell => this.addCell(cell));
  }

  /**
   * Clear the hash
   */
  clear(): void {
    this.grid.clear();
  }
}

/**
 * Calculate distance between two cells
 */
export function calculateDistance(
  cell1: Cell,
  cell2: Cell
): number {
  const dx = cell2.position.x - cell1.position.x;
  const dy = cell2.position.y - cell1.position.y;
  // All cells are in the same XY plane (z = 0)

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get collision radius (living circle radius)
 */
function getCollisionRadius(cell: Cell): number {
  return cell.livingRadius;
}

/**
 * Detect all collisions between cells
 */
export function detectCollisions(cells: Cell[]): Collision[] {
  const collisions: Collision[] = [];
  const spatialHash = new SpatialHash(2.0); // Grid cell size = 2.0
  spatialHash.build(cells);

  const checkedPairs = new Set<string>();

  for (const cell1 of cells) {
    const candidates = spatialHash.getCandidates(cell1);

    for (const cell2 of candidates) {
      // Skip same cell
      if (cell1.id === cell2.id) continue;

      // Skip if already checked this pair
      const pairKey = [cell1.id, cell2.id].sort().join('|');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Calculate distance
      const distance = calculateDistance(cell1, cell2);
      const radius1 = getCollisionRadius(cell1);
      const radius2 = getCollisionRadius(cell2);
      const minDistance = radius1 + radius2;

      // Check for overlap
      if (distance < minDistance) {
        const overlapAmount = minDistance - distance;

        collisions.push({
          id: `${cell1.id}-${cell2.id}`,
          cell1Id: cell1.id,
          cell2Id: cell2.id,
          cell1Label: cell1.label,
          cell2Label: cell2.label,
          distance: parseFloat(distance.toFixed(2)),
          minDistance: parseFloat(minDistance.toFixed(2)),
          overlapAmount: parseFloat(overlapAmount.toFixed(2))
        });
      }
    }
  }

  return collisions;
}

/**
 * Get collision statistics
 */
export function getCollisionStats(
  cells: Cell[],
  collisions: Collision[]
): CollisionStats {
  const overlappingCellIds = new Set<string>();

  collisions.forEach(collision => {
    overlappingCellIds.add(collision.cell1Id);
    overlappingCellIds.add(collision.cell2Id);
  });

  // Calculate severity
  const overlapRatio = overlappingCellIds.size / cells.length;
  let severity: 'none' | 'low' | 'medium' | 'high' = 'none';

  if (overlapRatio === 0) {
    severity = 'none';
  } else if (overlapRatio <= 0.1) {
    severity = 'low';
  } else if (overlapRatio <= 0.3) {
    severity = 'medium';
  } else {
    severity = 'high';
  }

  return {
    totalCells: cells.length,
    overlappingCellCount: overlappingCellIds.size,
    collisionCount: collisions.length,
    severity,
    overlappingCellIds
  };
}

/**
 * Check if a specific cell is overlapping with any other
 */
export function isCellOverlapping(
  cellId: string,
  collisions: Collision[]
): boolean {
  return collisions.some(c => c.cell1Id === cellId || c.cell2Id === cellId);
}

/**
 * Get all collisions for a specific cell
 */
export function getCellCollisions(
  cellId: string,
  collisions: Collision[]
): Collision[] {
  return collisions.filter(c => c.cell1Id === cellId || c.cell2Id === cellId);
}

/**
 * Resolve overlaps by gently pushing cells apart
 */
export function resolveOverlapsByPushing(
  cells: Cell[],
  collisions: Collision[],
  iterations: number = 3
): Cell[] {
  // Deep copy cells for modification
  const resolvedCells = cells.map(c => ({
    ...c,
    position: { ...c.position }
  }));

  // Iteratively push apart overlapping cells
  for (let iter = 0; iter < iterations; iter++) {
    for (const collision of collisions) {
      const cell1 = resolvedCells.find(c => c.id === collision.cell1Id);
      const cell2 = resolvedCells.find(c => c.id === collision.cell2Id);

      if (!cell1 || !cell2) continue;

      // Calculate current distance
      const distance = calculateDistance(cell1, cell2);
      if (distance === 0) continue; // Prevent division by zero

      // Direction from cell1 to cell2
      const dx = cell2.position.x - cell1.position.x;
      const dy = cell2.position.y - cell1.position.y;
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;

      // How much to push apart
      const radius1 = getCollisionRadius(cell1);
      const radius2 = getCollisionRadius(cell2);
      const minDistance = radius1 + radius2;
      const pushDistance = (minDistance - distance) / 2 + 0.1; // + 0.1 gap

      // Move cells apart
      cell1.position.x -= normalizedDx * pushDistance;
      cell1.position.y -= normalizedDy * pushDistance;

      cell2.position.x += normalizedDx * pushDistance;
      cell2.position.y += normalizedDy * pushDistance;
    }
  }

  return resolvedCells;
}

/**
 * Format collision info for display
 */
export function formatCollisionInfo(collision: Collision): string {
  return `${collision.cell1Label} ↔ ${collision.cell2Label} (overlap: ${collision.overlapAmount.toFixed(2)})`;
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'high':
      return '#ff0000'; // Red
    case 'medium':
      return '#ff6600'; // Orange
    case 'low':
      return '#ffcc00'; // Yellow
    default:
      return '#00ff00'; // Green
  }
}
