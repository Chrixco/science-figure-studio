import { Cell, ColorScheme, NetworkConfig } from '../types';
import { exportNetworkToSVG } from './svgExport';
import { rasterizeSvg, downloadBlob } from './rasterize';
import { embedPngDpi } from './pngDpi';

/**
 * Figure export in the three formats a paper needs.
 *
 * All of them render the same vector document, so PNG, PDF and SVG are
 * guaranteed to show the same figure, and the DPI setting changes the number of
 * pixels rendered rather than just the metadata.
 */

export type ExportDpi = number;

export async function exportFigureAsSVG(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  filename = 'figure.svg'
): Promise<void> {
  const svg = exportNetworkToSVG(cells, config, colors);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export async function exportFigureAsPNG(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  dpi: ExportDpi = 300,
  filename = 'figure.png'
): Promise<void> {
  const svg = exportNetworkToSVG(cells, config, colors);
  const { canvas } = await rasterizeSvg(svg, dpi);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not encode the figure as PNG');

  // Record the DPI so print software reports the right physical size.
  downloadBlob(await embedPngDpi(blob, dpi), filename);
}

export async function exportFigureAsPDF(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  dpi: ExportDpi = 300,
  filename = 'figure.pdf'
): Promise<void> {
  const svg = exportNetworkToSVG(cells, config, colors);
  const { canvas, widthInches, heightInches } = await rasterizeSvg(svg, dpi);

  // Imported here so jsPDF stays out of the main bundle.
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: widthInches > heightInches ? 'landscape' : 'portrait',
    unit: 'in',
    format: [widthInches, heightInches],
    compress: true,
  });

  // The page is sized in inches while the image carries `dpi` pixels per inch,
  // so the raster lands at full resolution rather than being downsampled.
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthInches, heightInches);
  pdf.save(filename);
}
