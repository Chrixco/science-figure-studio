import { describe, it, expect, beforeEach } from 'vitest';
import { measureText, clearTextMeasureCache } from './textMeasure';

describe('measureText', () => {
  beforeEach(() => clearTextMeasureCache());

  it('reports a positive box for non-empty text', () => {
    const { width, height } = measureText('biodiversity', 12);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('scales height with font size', () => {
    expect(measureText('x', 24).height).toBeCloseTo(measureText('x', 12).height * 2, 6);
  });

  it('makes longer strings wider', () => {
    expect(measureText('biodiversity', 12).width).toBeGreaterThan(measureText('x', 12).width);
  });

  it('returns identical metrics on a cache hit', () => {
    const first = measureText('temperature', 10);
    const second = measureText('temperature', 10);
    expect(second).toEqual(first);
  });

  it('keys the cache on size, family and style', () => {
    const small = measureText('temperature', 8);
    const large = measureText('temperature', 16);
    expect(large.width).not.toBeCloseTo(small.width, 3);
    expect(measureText('temperature', 8, 'Georgia').height).toBe(small.height);
  });

  // Guards the branch that reads the canvas: if the measuring context were
  // dropped the fallback would still return plausible-looking numbers, so the
  // assertion pins width to the stubbed advance rather than just "> 0".
  it('measures via the canvas context when one is available', () => {
    // The test stub advances 0.5em per character.
    expect(measureText('abcd', 10).width).toBeCloseTo(20, 6);
  });

  it('handles empty text without producing NaN', () => {
    const { width, height } = measureText('', 12);
    expect(Number.isFinite(width)).toBe(true);
    expect(Number.isFinite(height)).toBe(true);
    expect(width).toBe(0);
  });
});
