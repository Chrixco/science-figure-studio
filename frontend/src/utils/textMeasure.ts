/**
 * Canvas-backed text measurement.
 *
 * Konva's <Text> only honours `align` when an explicit `width` is set, and
 * `verticalAlign` when an explicit `height` is set. Without real metrics the
 * only options are a guessed box (labels clip or drift) or no box at all
 * (align/verticalAlign silently do nothing and text anchors at its top-left).
 *
 * The same metrics feed label overlap avoidance, which needs true bounding
 * boxes to be worth running at all.
 */

export interface TextMetrics {
  width: number;
  height: number;
}

/** Ratio of line box height to font size. Matches Konva's default lineHeight. */
const LINE_HEIGHT_RATIO = 1.2;

let ctx: CanvasRenderingContext2D | null = null;

function getContext(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  return ctx;
}

// Measuring is cheap but happens per node per render; caching keeps it off the
// hot path during drags.
const cache = new Map<string, TextMetrics>();
const MAX_CACHE_ENTRIES = 2000;

/**
 * Measure a single line of text.
 *
 * Falls back to a character-width approximation when no canvas is available
 * (SSR, or a test environment without canvas support).
 */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily = 'Arial',
  fontStyle = 'normal'
): TextMetrics {
  const key = `${fontStyle}|${fontSize}|${fontFamily}|${text}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const height = fontSize * LINE_HEIGHT_RATIO;
  let width: number;

  const context = getContext();
  if (context) {
    context.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
    width = context.measureText(text).width;
  } else {
    // ~0.55em average glyph advance for common UI sans-serif faces.
    width = text.length * fontSize * 0.55;
  }

  const metrics: TextMetrics = { width, height };

  if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
  cache.set(key, metrics);
  return metrics;
}

/** Drop cached metrics. Exposed for tests. */
export function clearTextMeasureCache(): void {
  cache.clear();
}
