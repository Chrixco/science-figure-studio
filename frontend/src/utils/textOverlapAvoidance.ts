import {
  forceSimulation,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';

export interface TextLabel {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface PositionedLabel extends TextLabel {
  adjustedX: number;
  adjustedY: number;
}

/** A label promoted into a d3-force simulation node. */
interface LabelNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Use D3-Force simulation to avoid text overlaps
 * Creates repulsive forces between overlapping labels to push them apart
 * @param labels - Array of text labels with positions and dimensions
 * @param iterations - Number of simulation iterations (default: 50)
 * @param padding - Minimum distance between text elements in pixels (default: 10)
 * @returns Array of labels with adjusted positions
 */
export function avoidTextOverlap(
  labels: TextLabel[],
  iterations: number = 50,
  padding: number = 10
): PositionedLabel[] {
  if (labels.length === 0) return [];

  // Create simulation nodes from labels
  const nodes: LabelNode[] = labels.map((label) => ({
    id: label.id,
    x: label.x,
    y: label.y,
    vx: 0,
    vy: 0,
    width: label.width,
    height: label.height,
  }));

  // Collision radius: half the label diagonal, plus padding.
  const getCollideRadius = (node: LabelNode) => {
    const diagonal = Math.sqrt(node.width ** 2 + node.height ** 2);
    return diagonal / 2 + padding;
  };

  // forceX/forceY pull each label back toward where it started, so labels drift
  // only as far as de-overlapping requires.
  const anchors = new Map(labels.map((label) => [label.id, { x: label.x, y: label.y }]));
  const simulation = forceSimulation<LabelNode>(nodes)
    .force('collide', forceCollide<LabelNode>().radius(getCollideRadius).strength(1.0))
    .force('x', forceX<LabelNode>((node) => anchors.get(node.id)?.x ?? node.x).strength(0.3))
    .force('y', forceY<LabelNode>((node) => anchors.get(node.id)?.y ?? node.y).strength(0.3))
    .stop();

  // The caller picks the iteration count: label layout runs on every zoom
  // change and during drags, so it decides the accuracy/latency trade-off.
  // (This used to clamp to a minimum of 100 ticks regardless of what was
  // asked for.)
  for (let i = 0; i < Math.max(1, iterations); i++) {
    simulation.tick();
  }

  // Extract adjusted positions and combine with original label data
  const positionedLabels: PositionedLabel[] = labels.map((label, index) => ({
    ...label,
    adjustedX: nodes[index].x ?? label.x,
    adjustedY: nodes[index].y ?? label.y,
  }));

  return positionedLabels;
}

/**
 * Check if two bounding boxes overlap
 */
export function checkOverlap(
  label1: TextLabel,
  label2: TextLabel,
  padding: number = 0
): boolean {
  const x1 = label1.x - label1.width / 2 - padding;
  const y1 = label1.y - label1.height / 2 - padding;
  const x2 = label1.x + label1.width / 2 + padding;
  const y2 = label1.y + label1.height / 2 + padding;

  const x3 = label2.x - label2.width / 2 - padding;
  const y3 = label2.y - label2.height / 2 - padding;
  const x4 = label2.x + label2.width / 2 + padding;
  const y4 = label2.y + label2.height / 2 + padding;

  return !(x2 < x3 || x4 < x1 || y2 < y3 || y4 < y1);
}

/**
 * Get alternative positions for a label (trying different offsets)
 */
export function getAlternativePositions(
  originalLabel: TextLabel,
  offset: number = 50
): TextLabel[] {
  const alternatives = [
    { ...originalLabel, y: originalLabel.y - offset }, // Top
    { ...originalLabel, y: originalLabel.y + offset }, // Bottom
    { ...originalLabel, x: originalLabel.x - offset }, // Left
    { ...originalLabel, x: originalLabel.x + offset }, // Right
    { ...originalLabel, x: originalLabel.x - offset, y: originalLabel.y - offset }, // Top-left
    { ...originalLabel, x: originalLabel.x + offset, y: originalLabel.y - offset }, // Top-right
    { ...originalLabel, x: originalLabel.x - offset, y: originalLabel.y + offset }, // Bottom-left
    { ...originalLabel, x: originalLabel.x + offset, y: originalLabel.y + offset }, // Bottom-right
  ];

  return alternatives;
}

/**
 * Simple greedy label placement (for fallback)
 * Places labels one by one, avoiding overlaps with already placed labels
 */
export function greedyLabelPlacement(
  labels: TextLabel[],
  padding: number = 5
): PositionedLabel[] {
  const positioned: PositionedLabel[] = [];

  for (const label of labels) {
    let bestPosition = { ...label, adjustedX: label.x, adjustedY: label.y };
    let minOverlaps = Infinity;

    // Try original position and alternatives
    const positions = [label, ...getAlternativePositions(label)];

    for (const pos of positions) {
      let overlaps = 0;
      for (const placed of positioned) {
        if (checkOverlap(pos, placed, padding)) {
          overlaps++;
        }
      }

      if (overlaps < minOverlaps) {
        minOverlaps = overlaps;
        bestPosition = {
          ...label,
          adjustedX: pos.x,
          adjustedY: pos.y,
        };
      }

      if (minOverlaps === 0) break; // Found no overlaps, use this position
    }

    positioned.push(bestPosition);
  }

  return positioned;
}
