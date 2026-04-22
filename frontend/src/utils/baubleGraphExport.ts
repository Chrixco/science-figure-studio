import { BaubleGraph, BaubleConfig, LoadedBaubleFile } from '../types/bauble';
import jsPDF from 'jspdf';

// Helper function to determine if a color is light or dark
const isLightColor = (hexColor: string): boolean => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

export interface BaubleGraphExport {
  version: string;
  timestamp: string;
  config: BaubleConfig;
  files: LoadedBaubleFile[];
  nodeColors: Record<string, string>;
  nodePositions: Record<string, { x: number; y: number }>;
}

/**
 * Export bauble graph to JSON
 * Includes config, files metadata (with parent-child links), custom node colors, and positions
 */
export function exportBaubleGraphToJSON(
  files: LoadedBaubleFile[],
  graph: BaubleGraph,
  config: BaubleConfig
): string {
  // Extract custom colors and positions from nodes
  const nodeColors: Record<string, string> = {};
  const nodePositions: Record<string, { x: number; y: number }> = {};

  graph.nodes.forEach((node) => {
    nodeColors[node.id] = node.color;
    nodePositions[node.id] = { x: node.position.x, y: node.position.y };
  });

  const exportData: BaubleGraphExport = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    config,
    files,
    nodeColors,
    nodePositions,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import bauble graph from JSON
 * Returns parsed export data
 */
export function importBaubleGraphFromJSON(jsonString: string): BaubleGraphExport | null {
  try {
    const data = JSON.parse(jsonString) as BaubleGraphExport;

    // Validate structure
    if (!data.version || !data.config || !Array.isArray(data.files) || !data.nodeColors) {
      console.error('Invalid bauble graph JSON structure');
      return null;
    }

    // Ensure nodePositions exists (for backwards compatibility with old exports)
    if (!data.nodePositions) {
      data.nodePositions = {};
    }

    return data;
  } catch (error) {
    console.error('Failed to parse bauble graph JSON:', error);
    return null;
  }
}

/**
 * Download JSON file
 */
export function downloadBaubleGraphJSON(jsonString: string, filename: string = 'bauble-graph.json') {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// PNG/PDF/SVG Export Functions for Bauble Graph
// ============================================================================

/**
 * Helper: Escape XML special characters in text content
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export canvas as PNG with 300 DPI metadata
 */
export async function exportBaubleGraphToPNG(
  canvas: HTMLCanvasElement,
  filename: string,
  dpi: number = 300
) {
  try {
    console.log('Starting PNG export...', { canvas, width: canvas?.width, height: canvas?.height });

    if (!canvas) {
      alert('❌ PNG export failed: Canvas element is null or undefined');
      return;
    }

    if (canvas.width <= 0 || canvas.height <= 0) {
      alert(`❌ PNG export failed: Canvas dimensions invalid (${canvas.width}x${canvas.height}). Make sure the visualization is rendered.`);
      return;
    }

    // Get PNG data from canvas
    console.log('Converting canvas to blob...');
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        console.log('toBlob callback received:', blob?.size);
        resolve(blob);
      }, 'image/png', 1.0);
    });

    if (!blob) {
      alert('❌ PNG export failed: toBlob() returned null');
      return;
    }

    if (blob.size === 0) {
      alert('❌ PNG export failed: Canvas produced empty image');
      return;
    }

    console.log(`✓ PNG canvas captured: ${canvas.width}x${canvas.height}px (${(blob.size / 1024).toFixed(1)}KB)`);

    // Add DPI metadata
    const finalBlob = await addPNGDPI(blob, canvas.width, canvas.height, dpi);
    downloadBlob(finalBlob, filename);
    console.log(`✓ PNG exported with ${dpi} DPI metadata`);
  } catch (error) {
    console.error('PNG export error:', error);
    alert(`❌ PNG export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export canvas as PDF with 300 DPI
 */
export async function exportBaubleGraphToPDF(
  canvas: HTMLCanvasElement,
  filename: string,
  dpi: number = 300
) {
  try {
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      alert('❌ PDF export failed: Canvas is empty or invalid');
      return;
    }

    // Get image data from canvas
    const imgData = canvas.toDataURL('image/png');
    if (!imgData || imgData.length < 100) {
      alert('❌ PDF export failed: Canvas produced empty image');
      return;
    }

    const pdfWidth = canvas.width;
    const pdfHeight = canvas.height;

    console.log(`✓ PDF canvas captured: ${pdfWidth}x${pdfHeight}px`);

    // Calculate physical dimensions in millimeters
    const widthMM = (pdfWidth / dpi) * 25.4;
    const heightMM = (pdfHeight / dpi) * 25.4;

    const pdf = new jsPDF({
      orientation: widthMM > heightMM ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [widthMM, heightMM],
      compress: true,
    });

    pdf.addImage(imgData, 'PNG', 0, 0, widthMM, heightMM);
    pdf.save(filename);

    console.log(`✓ PDF saved: ${widthMM.toFixed(1)}cm × ${heightMM.toFixed(1)}cm @ ${dpi} DPI`);
  } catch (error) {
    console.error('PDF export error:', error);
    alert(`❌ PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


/**
 * Helper: Create PNG chunk with proper CRC32
 */
function createPNGChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(12 + length);
  const view = new DataView(chunk.buffer);

  // Length (big-endian)
  view.setUint32(0, length, false);

  // Type (4 bytes)
  const typeBytes = new TextEncoder().encode(type);
  chunk.set(typeBytes, 4);

  // Data
  chunk.set(data, 8);

  // CRC32
  const crc = crc32(chunk.slice(4, 8 + length));
  view.setUint32(8 + length, crc, false);

  return chunk;
}

/**
 * Helper: CRC32 calculation for PNG chunks
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Helper: Add DPI metadata to PNG blob
 */
async function addPNGDPI(blob: Blob, _width: number, _height: number, dpi: number = 300): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const view = new Uint8Array(buffer);

  // Convert DPI to pixels per meter
  const pixelsPerMeter = Math.round(dpi / 0.0254);

  // Create pHYs chunk (9 bytes: 4 bytes X, 4 bytes Y, 1 byte unit)
  const pHYsData = new Uint8Array(9);
  const dataView = new DataView(pHYsData.buffer);
  dataView.setUint32(0, pixelsPerMeter, false); // X
  dataView.setUint32(4, pixelsPerMeter, false); // Y
  pHYsData[8] = 1; // Unit (1 = meters)

  const pHYsChunk = createPNGChunk('pHYs', pHYsData);

  // Insert pHYs chunk after IHDR (first 8 bytes PNG signature + 33 bytes IHDR chunk)
  const newPNG = new Uint8Array(view.length + pHYsChunk.length);
  newPNG.set(view.slice(0, 33), 0);
  newPNG.set(pHYsChunk, 33);
  newPNG.set(view.slice(33), 33 + pHYsChunk.length);

  return new Blob([newPNG], { type: 'image/png' });
}

/**
 * Helper: Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export Bauble Graph as SVG
 * Properly escapes XML entities in labels to prevent parsing errors
 */
export function exportBaubleGraphToSVG(
  graph: BaubleGraph,
  config: BaubleConfig,
  width: number = 1200,
  height: number = 1200
): string {
  const CANVAS_SCALE = 10;

  // Calculate bounds
  const padding = 50;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  graph.nodes.forEach(node => {
    const left = node.position.x - node.radius;
    const right = node.position.x + node.radius;
    const top = node.position.y - node.radius;
    const bottom = node.position.y + node.radius;

    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, bottom);
  });

  if (!isFinite(minX)) {
    minX = 0;
    maxX = CANVAS_SCALE;
    minY = 0;
    maxY = CANVAS_SCALE;
  }

  // Add padding
  minX -= 0.2;
  maxX += 0.2;
  minY -= 0.2;
  maxY += 0.2;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  const scaleX = (width - padding * 2) / contentWidth;
  const scaleY = (height - padding * 2) / contentHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = padding - minX * scale;
  const offsetY = padding - minY * scale;

  // Build SVG with proper XML escaping
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style type="text/css"><![CDATA[
      .bauble-node { stroke-linecap: round; stroke-linejoin: round; }
      .bauble-label { font-family: Arial, sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .bauble-edge { stroke-linecap: round; stroke-linejoin: round; }
    ]]></style>
  </defs>
  <rect width="100%" height="100%" fill="${config.backgroundColor}"/>
  <g id="bauble-graph" transform="translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}) scale(${scale.toFixed(6)})">
`;

  // Draw edges
  graph.edges.forEach(edge => {
    const fromNode = graph.nodes.find(n => n.id === edge.fromId);
    const toNode = graph.nodes.find(n => n.id === edge.toId);

    if (fromNode && toNode) {
      const edgeColor = config.edgeColor;
      const edgeOpacity = edge.kind === 'mother-to-mother' ? 0.3 : 0.6;
      const edgeStrokeWidth = (config.edgeWidth / scale).toFixed(4);

      svg += `    <line x1="${fromNode.position.x.toFixed(4)}" y1="${fromNode.position.y.toFixed(4)}" x2="${toNode.position.x.toFixed(4)}" y2="${toNode.position.y.toFixed(4)}" stroke="${edgeColor}" stroke-width="${edgeStrokeWidth}" opacity="${edgeOpacity}"/>\n`;
    }
  });

  // Draw nodes and labels
  graph.nodes.forEach(node => {
    const cx = node.position.x.toFixed(4);
    const cy = node.position.y.toFixed(4);
    const r = node.radius.toFixed(4);

    // Node circle
    svg += `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${node.color}" stroke="#ffffff" stroke-width="${(0.02 / scale).toFixed(4)}"/>\n`;

    // Determine font properties
    const fontSize = (() => {
      switch (node.kind) {
        case 'root': return config.rootFontSize;
        case 'mother': return config.motherFontSize;
        case 'child': return config.childFontSize;
        case 'grandchild': return config.grandchildFontSize;
        default: return 10;
      }
    })();

    const fontFamily = (() => {
      switch (node.kind) {
        case 'root': return config.rootFontFamily;
        case 'mother': return config.motherFontFamily;
        case 'child': return config.childFontFamily;
        case 'grandchild': return config.grandchildFontFamily;
        default: return 'Arial';
      }
    })();

    const labelColor = isLightColor(config.backgroundColor) ? '#000000' : '#ffffff';
    const labelY = (parseFloat(cy) + parseFloat(r) + 0.15).toFixed(4);
    const labelText = escapeXML(node.label);

    svg += `    <text x="${cx}" y="${labelY}" fill="${labelColor}" font-size="${(fontSize / scale).toFixed(2)}" font-family="${fontFamily}" text-anchor="middle" dominant-baseline="middle">${labelText}</text>\n`;
  });

  svg += `  </g>\n</svg>`;

  return svg;
}

/**
 * Download SVG file
 */
export function downloadBaubleGraphSVG(svgContent: string, filename: string = 'bauble-graph.svg') {
  try {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, filename);
    console.log(`✓ SVG downloaded: ${(blob.size / 1024).toFixed(1)}KB`);
  } catch (error) {
    console.error('SVG download error:', error);
    alert(`❌ SVG download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
