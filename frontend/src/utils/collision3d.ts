/**
 * 3D Collision Detection System
 * Uses the spacing.ts module for all collision calculations
 * Ensures 2D and 3D use identical formulas
 *
 * Sources:
 * - https://www.jeffreythompson.org/collision-detection/circle-circle.php
 * - https://www.toptal.com/game/video-game-physics-part-ii-collision-detection-for-solid-objects
 */

import { Cell } from '../types';
import {
  detectAllCollisions as coreDetectCollisions,
  resolveCollisions as coreResolveCollisions
} from './spacing';

export interface Collision {
  id: string;
  cell1Id: string;
  cell2Id: string;
  cell1Label: string;
  cell2Label: string;
  distance: number;
  minDistance: number;
  overlapAmount: number;
}

export interface CollisionStats {
  totalCells: number;
  overlappingCellCount: number;
  collisionCount: number;
  severity: 'none' | 'low' | 'medium' | 'high';
  overlappingCellIds: Set<string>;
}

/**
 * Detect all collisions in 3D space
 * Uses spatial hashing for O(n) average performance
 *
 * @param cells Array of cells to check
 * @param buffer Buffer distance (0 for raw collision detection)
 * @returns Array of collisions
 */
export function detectCollisions(cells: Cell[], buffer: number = 0): Collision[] {
  const coreCollisions = coreDetectCollisions(cells, buffer);

  return coreCollisions.map(col => {
    const cell1 = cells.find(c => c.id === col.cell1Id);
    const cell2 = cells.find(c => c.id === col.cell2Id);

    return {
      id: col.id,
      cell1Id: col.cell1Id,
      cell2Id: col.cell2Id,
      cell1Label: cell1?.label || 'Unknown',
      cell2Label: cell2?.label || 'Unknown',
      distance: col.distance,
      minDistance: cell1!.radius + cell2!.radius + buffer,
      overlapAmount: col.overlap
    };
  });
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
 * Check if specific cell is colliding
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
 * Resolve overlapping cells by pushing them apart
 *
 * @param cells Array of cells
 * @param buffer Spacing buffer (default: 0)
 * @param maxIterations Maximum iterations (default: 10)
 * @returns Resolved cells with updated positions
 */
export function autoResolveCollisions(
  cells: Cell[],
  buffer: number = 0,
  maxIterations: number = 10
): Cell[] {
  // First check if there are any collisions
  const collisions = detectCollisions(cells, buffer);
  if (collisions.length === 0) {
    return cells;
  }

  // Use core resolution algorithm
  return coreResolveCollisions(cells, buffer, maxIterations);
}

/**
 * Format collision info for display
 */
export function formatCollisionInfo(collision: Collision): string {
  return `${collision.cell1Label} ↔ ${collision.cell2Label} (overlap: ${collision.overlapAmount.toFixed(2)})`;
}

/**
 * Get severity color for display
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
