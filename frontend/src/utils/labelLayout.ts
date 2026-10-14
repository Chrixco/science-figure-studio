import { Point, TextPosition } from '../types';
import { measureText } from './textMeasure';
import { avoidTextOverlap, TextLabel } from './textOverlapAvoidance';

/**
 * Label placement, shared by the interactive canvas and the SVG exporter.
 *
 * Both renderers consume this so an exported figure matches what was designed
 * on screen. They previously computed labels independently, and the SVG export
 * had drifted badly -- it hardcoded the string "living" for every cell, used
 * raw function keys instead of the user's labels, and ignored text position,
 * per-function colours and weights entirely.
 */

/** One label to place, described in network units. */
export interface LabelInput {
  id: string;
  /** Node centre, in network units. */
  position: Point;
  /** Node radius, in network units. */
  radius: number;
  text: string;
  /** Rendered type size, in final output pixels. */
  fontSize: number;
}

/** Where a label ended up, in scaled space (network units x `scale`). */
export interface LabelPlacement {
  id: string;
  x: number;
  y: number;
  /** The node the label belongs to, for leader lines. */
  anchorX: number;
  anchorY: number;
  /** Measured box, in output pixels. */
  width: number;
  height: number;
  fontSize: number;
  /** True once de-overlap moved the label clear of its node. */
  displaced: boolean;
}

export interface LabelLayoutOptions {
  /** Output pixels per network unit. */
  scale: number;
  textPosition: TextPosition;
  /** Gap between circle edge and label, in output pixels. */
  gap: number;
  avoidOverlap: boolean;
  /** Minimum gap between label boxes, in output pixels. */
  padding: number;
  /**
   * Force-simulation ticks. The canvas re-runs this on every zoom step and
   * during drags, so it trades accuracy for latency; export can afford more.
   */
  iterations?: number;
}

/** Vertical offset from a node centre to its label centre, before de-overlap. */
export function labelOffsetY(
  position: TextPosition,
  radius: number,
  gap: number,
  boxHeight: number
): number {
  switch (position) {
    case 'above':
      return -radius - gap - boxHeight / 2;
    case 'below':
    case 'outside':
      return radius + gap + boxHeight / 2;
    case 'inside':
    default:
      return 0;
  }
}

/** Width of a label's box, padded so alignment has room and glyphs never clip. */
export function labelBoxWidth(textWidth: number, fontSize: number): number {
  return textWidth + fontSize;
}

/**
 * Resolve a position for every label.
 *
 * Coordinates come back in scaled space -- network units multiplied by
 * `scale`, with no pan applied. Callers add their own translation at draw
 * time, so panning never invalidates this result.
 */
export function computeLabelPlacements(
  inputs: LabelInput[],
  options: LabelLayoutOptions
): Map<string, LabelPlacement> {
  const { scale, textPosition, gap, avoidOverlap, padding, iterations = 60 } = options;
  const placements = new Map<string, LabelPlacement>();
  if (inputs.length === 0) return placements;

  const boxes = inputs.map((input) => {
    const metrics = measureText(input.text, input.fontSize);
    const anchorX = input.position.x * scale;
    const anchorY = input.position.y * scale;
    const radius = input.radius * scale;

    return {
      id: input.id,
      fontSize: input.fontSize,
      anchorX,
      anchorY,
      x: anchorX,
      y: anchorY + labelOffsetY(textPosition, radius, gap, metrics.height),
      width: labelBoxWidth(metrics.width, input.fontSize),
      height: metrics.height,
    };
  });

  if (!avoidOverlap) {
    for (const box of boxes) {
      placements.set(box.id, { ...box, displaced: false });
    }
    return placements;
  }

  const labels: TextLabel[] = boxes.map((box) => ({
    id: box.id,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    label: box.id,
  }));

  const adjusted = avoidTextOverlap(labels, iterations, padding);
  const byId = new Map(adjusted.map((label) => [label.id, label]));

  for (const box of boxes) {
    const moved = byId.get(box.id);
    const x = moved?.adjustedX ?? box.x;
    const y = moved?.adjustedY ?? box.y;
    // A leader line only helps once the label has left its node's vicinity.
    const drift = Math.hypot(x - box.x, y - box.y);

    placements.set(box.id, {
      ...box,
      x,
      y,
      displaced: drift > box.height,
    });
  }

  return placements;
}
