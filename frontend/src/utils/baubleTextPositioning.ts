import { BaubleNode } from '../types/bauble';
import { avoidTextOverlap, TextLabel } from './textOverlapAvoidance';

export interface LabelInfo {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  worldScale: number;
}

/**
 * Calculate text dimensions based on text and font settings
 * More accurate estimation that accounts for actual character rendering
 */
export function estimateTextDimensions(
  text: string,
  fontSize: number
): { width: number; height: number } {
  // More accurate character width estimation based on font
  // Most fonts have average character width ~0.55 * fontSize
  const charWidth = fontSize * 0.55;

  // For multi-line text, split by common delimiters
  const lines = text.split(/[\s•\-,]/);

  // Find the longest line (approximation for max width)
  const maxLineLength = Math.max(...lines.map(line => line.length));
  const width = maxLineLength * charWidth + fontSize * 0.5; // Add padding

  // Height: base font size + line spacing for potential wrapping
  const estimatedLines = Math.ceil(text.length * charWidth / (width - fontSize * 0.5));
  const height = (fontSize * 1.4) * Math.max(1, estimatedLines * 0.5);

  return { width, height };
}

/**
 * Apply D3-Force based overlap avoidance to label positions
 * @param nodes - Array of Bauble nodes
 * @param labelInfoMap - Map of node IDs to text dimension info
 * @param worldScale - Scale factor for positioning
 * @param canvasCenter - Center of canvas for coordinate transformation
 * @param enableOverlapAvoidance - Whether to enable overlap avoidance
 * @param padding - Padding between text elements in pixels
 * @returns Map of node IDs to adjusted positions
 */
export function applyTextOverlapAvoidance(
  nodes: BaubleNode[],
  labelInfoMap: Map<string, { textWidth: number; textHeight: number; fontSize: number; fontFamily: string }>,
  worldScale: number,
  canvasCenter: number,
  enableOverlapAvoidance: boolean = true,
  padding: number = 10
): Map<string, { x: number; y: number }> {
  if (!enableOverlapAvoidance || nodes.length === 0) {
    // Return original positions
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      positions.set(node.id, {
        x: (node.position.x - canvasCenter) * worldScale,
        y: -(node.position.y - canvasCenter) * worldScale,
      });
    }
    return positions;
  }

  // Create labels with estimated dimensions
  const labels: TextLabel[] = nodes
    .filter((node) => node.label)
    .map((node) => {
      const labelInfo = labelInfoMap.get(node.id);
      const width = labelInfo?.textWidth || 50;
      const height = labelInfo?.textHeight || 20;
      const x = (node.position.x - canvasCenter) * worldScale;
      const y = -(node.position.y - canvasCenter) * worldScale;

      return {
        id: node.id,
        x,
        y,
        width,
        height,
        label: node.label,
      };
    });

  // Apply D3-Force overlap avoidance with configurable padding
  const positionedLabels = avoidTextOverlap(labels, 30, padding);

  // Convert back to position map
  const positions = new Map<string, { x: number; y: number }>();
  for (const positioned of positionedLabels) {
    positions.set(positioned.id, {
      x: positioned.adjustedX,
      y: positioned.adjustedY,
    });
  }

  return positions;
}

/**
 * Calculate offset position for label based on position preference
 */
export function getLabelOffset(
  position: 'top' | 'bottom' | 'left' | 'right',
  radius: number,
  labelWidth: number,
  labelHeight: number,
  padding: number = 10
): { x: number; y: number } {
  switch (position) {
    case 'top':
      return { x: 0, y: radius + labelHeight / 2 + padding };
    case 'bottom':
      return { x: 0, y: -radius - labelHeight / 2 - padding };
    case 'left':
      return { x: -radius - labelWidth / 2 - padding, y: 0 };
    case 'right':
      return { x: radius + labelWidth / 2 + padding, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Combine fixed positioning (based on textPosition config) with dynamic overlap avoidance
 * This allows labels to stay near their preferred positions while avoiding overlaps
 */
export function combinedPositioning(
  nodePosition: { x: number; y: number },
  preferredOffset: { x: number; y: number },
  adjustedPosition: { x: number; y: number } | null,
  interpolationFactor: number = 0.5
): { x: number; y: number } {
  if (!adjustedPosition) {
    return { x: nodePosition.x + preferredOffset.x, y: nodePosition.y + preferredOffset.y };
  }

  // Blend between preferred position and adjusted position
  const blendedX = nodePosition.x + preferredOffset.x + (adjustedPosition.x - (nodePosition.x + preferredOffset.x)) * interpolationFactor;
  const blendedY = nodePosition.y + preferredOffset.y + (adjustedPosition.y - (nodePosition.y + preferredOffset.y)) * interpolationFactor;

  return { x: blendedX, y: blendedY };
}
