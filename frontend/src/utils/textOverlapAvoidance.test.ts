import { describe, it, expect } from 'vitest';
import {
  avoidTextOverlap,
  checkOverlap,
  getAlternativePositions,
  greedyLabelPlacement,
  TextLabel,
} from './textOverlapAvoidance';

function label(id: string, x: number, y: number, width = 60, height = 12): TextLabel {
  return { id, x, y, width, height, label: id };
}

/** Do any two boxes in the result still collide? */
function anyOverlap(
  boxes: { x: number; y: number; width: number; height: number }[],
  padding = 0
): boolean {
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      if (checkOverlap(label('a', boxes[a].x, boxes[a].y, boxes[a].width, boxes[a].height),
                       label('b', boxes[b].x, boxes[b].y, boxes[b].width, boxes[b].height),
                       padding)) {
        return true;
      }
    }
  }
  return false;
}

describe('avoidTextOverlap', () => {
  it('returns an entry for every label', () => {
    const labels = [label('a', 0, 0), label('b', 5, 0), label('c', 10, 0)];
    expect(avoidTextOverlap(labels)).toHaveLength(3);
  });

  it('separates labels stacked on the same point', () => {
    const labels = [label('a', 0, 0), label('b', 0, 0), label('c', 0, 0)];
    const out = avoidTextOverlap(labels, 200, 4);

    const boxes = out.map((l) => ({ x: l.adjustedX, y: l.adjustedY, width: l.width, height: l.height }));
    expect(anyOverlap(boxes)).toBe(false);
  });

  it('leaves well-separated labels essentially where they were', () => {
    const labels = [label('a', 0, 0), label('b', 500, 0), label('c', 1000, 0)];
    const out = avoidTextOverlap(labels, 100, 4);

    for (const moved of out) {
      const original = labels.find((l) => l.id === moved.id)!;
      expect(Math.hypot(moved.adjustedX - original.x, moved.adjustedY - original.y)).toBeLessThan(1);
    }
  });

  it('keeps the original label fields intact', () => {
    const [out] = avoidTextOverlap([label('a', 3, 4)]);
    expect(out.id).toBe('a');
    expect(out.x).toBe(3);
    expect(out.y).toBe(4);
    expect(out.label).toBe('a');
  });

  it('produces finite coordinates', () => {
    const labels = Array.from({ length: 20 }, (_, i) => label(`n${i}`, 0, 0));
    for (const out of avoidTextOverlap(labels, 60, 4)) {
      expect(Number.isFinite(out.adjustedX)).toBe(true);
      expect(Number.isFinite(out.adjustedY)).toBe(true);
    }
  });

  it('handles an empty input', () => {
    expect(avoidTextOverlap([])).toEqual([]);
  });

  // The implementation used to clamp to at least 100 ticks regardless of the
  // requested count, so the caller could not trade accuracy for latency.
  it('honours the requested iteration count', () => {
    const labels = [label('a', 0, 0), label('b', 1, 0)];
    const oneTick = avoidTextOverlap(labels, 1, 4);
    const manyTicks = avoidTextOverlap(labels, 300, 4);

    const spread = (out: typeof oneTick) =>
      Math.abs(out[0].adjustedX - out[1].adjustedX) + Math.abs(out[0].adjustedY - out[1].adjustedY);

    expect(spread(manyTicks)).toBeGreaterThan(spread(oneTick));
  });
});

describe('checkOverlap', () => {
  it('detects boxes sharing space', () => {
    expect(checkOverlap(label('a', 0, 0), label('b', 10, 0))).toBe(true);
  });

  it('clears boxes that are far apart', () => {
    expect(checkOverlap(label('a', 0, 0), label('b', 200, 0))).toBe(false);
  });

  it('counts padding as part of the box', () => {
    expect(checkOverlap(label('a', 0, 0), label('b', 61, 0))).toBe(false);
    expect(checkOverlap(label('a', 0, 0), label('b', 61, 0), 5)).toBe(true);
  });
});

describe('getAlternativePositions', () => {
  it('offers the eight surrounding positions', () => {
    const alternatives = getAlternativePositions(label('a', 0, 0), 50);
    expect(alternatives).toHaveLength(8);
    for (const alt of alternatives) {
      expect(alt.id).toBe('a');
      expect(Math.max(Math.abs(alt.x), Math.abs(alt.y))).toBe(50);
    }
  });
});

describe('greedyLabelPlacement', () => {
  it('places every label', () => {
    const labels = [label('a', 0, 0), label('b', 0, 0), label('c', 0, 0)];
    expect(greedyLabelPlacement(labels)).toHaveLength(3);
  });

  it('moves a colliding label off its original spot', () => {
    const out = greedyLabelPlacement([label('a', 0, 0), label('b', 0, 0)], 5);
    const moved = out[1];
    expect(Math.hypot(moved.adjustedX - 0, moved.adjustedY - 0)).toBeGreaterThan(0);
  });
});
