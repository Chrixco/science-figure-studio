/**
 * Rasterise an SVG figure at an arbitrary resolution.
 *
 * Raster export used to call `canvas.toBlob()` on the on-screen Konva canvas
 * and then stamp a pHYs chunk claiming the chosen DPI. That only relabelled the
 * file: a "600 DPI" export contained exactly as many pixels as the browser
 * window, so the image was upscaled by whatever opened it. Going through the
 * vector figure instead means the DPI setting genuinely changes how many pixels
 * are rendered, and PNG/PDF/SVG all show the same drawing.
 */

/** Physical size an image represents at a given DPI. */
export interface RasterResult {
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
  widthInches: number;
  heightInches: number;
}

/** CSS pixels per inch, the unit an SVG's width/height attributes are in. */
const CSS_PPI = 96;

function parseSvgSize(svg: string): { width: number; height: number } {
  const width = Number(/width="([\d.]+)"/.exec(svg)?.[1]);
  const height = Number(/height="([\d.]+)"/.exec(svg)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('SVG is missing usable width/height attributes');
  }
  return { width, height };
}

/**
 * Draw an SVG document onto a canvas sized for `dpi`.
 *
 * The SVG's own width/height are treated as CSS pixels (96 per inch), so the
 * output is `dpi / 96` times larger in each dimension.
 */
export async function rasterizeSvg(svg: string, dpi = 300): Promise<RasterResult> {
  const { width, height } = parseSvgSize(svg);
  const ratio = dpi / CSS_PPI;

  const widthPx = Math.max(1, Math.round(width * ratio));
  const heightPx = Math.max(1, Math.round(height * ratio));

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not rasterise the figure'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not obtain a 2D context');

    ctx.drawImage(image, 0, 0, widthPx, heightPx);

    return {
      canvas,
      widthPx,
      heightPx,
      widthInches: width / CSS_PPI,
      heightInches: height / CSS_PPI,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
