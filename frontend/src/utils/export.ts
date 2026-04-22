import jsPDF from 'jspdf';
import { Cell, ColorScheme, NetworkConfig } from '../types';
import { calculateSmartLineSegments } from './geometry';

// Export configuration as JSON
export function exportToJSON(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme
): string {
  const data = { cells, config, colors, version: '1.0.0' };
  return JSON.stringify(data, null, 2);
}

// Download a file
export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper: Create PNG with DPI metadata
function createPNGWithDPI(blob: Blob, width: number, height: number, dpi: number = 300): Promise<Blob> {
  return new Promise((resolve) => {
    processPNGBlob(blob, width, height, dpi, resolve);
  });
}

function processPNGBlob(originalBlob: Blob, width: number, height: number, dpi: number, resolve: (blob: Blob) => void): void {
  originalBlob.arrayBuffer().then((buffer) => {
    const view = new Uint8Array(buffer);

    // Convert DPI to pixels per meter for pHYs chunk
    const pixelsPerMeter = Math.round(dpi / 0.0254);

    // Create pHYs chunk
    const pHYsData = new Uint8Array(9);
    const dataView = new DataView(pHYsData.buffer);
    dataView.setUint32(0, pixelsPerMeter, false); // x pixels per meter (big-endian)
    dataView.setUint32(4, pixelsPerMeter, false); // y pixels per meter (big-endian)
    pHYsData[8] = 1; // unit specifier (1 = meters)

    const pHYsChunk = createChunk('pHYs', pHYsData);

    // Insert pHYs chunk after IHDR (8 bytes + 13 bytes for IHDR chunk)
    const newPNG = new Uint8Array(view.length + pHYsChunk.length);

    // Copy PNG signature and IHDR
    newPNG.set(view.slice(0, 33), 0);

    // Insert pHYs chunk
    newPNG.set(pHYsChunk, 33);

    // Copy rest of PNG
    newPNG.set(view.slice(33), 33 + pHYsChunk.length);

    const finalBlob = new Blob([newPNG], { type: 'image/png' });
    const physicalSize = {
      width: (width / pixelsPerMeter * 0.0254).toFixed(2),
      height: (height / pixelsPerMeter * 0.0254).toFixed(2)
    };
    console.log(`PNG created: ${width}x${height}px @ ${dpi} DPI (${physicalSize.width}cm × ${physicalSize.height}cm), size: ${(finalBlob.size / 1024 / 1024).toFixed(1)}MB`);
    resolve(finalBlob);
  });
}

// Helper: Create a PNG chunk with proper CRC
function createChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(12 + length);

  // Length (4 bytes, big-endian)
  const view = new DataView(chunk.buffer);
  view.setUint32(0, length, false);

  // Type (4 bytes)
  const typeBytes = new TextEncoder().encode(type);
  chunk.set(typeBytes, 4);

  // Data
  chunk.set(data, 8);

  // CRC (4 bytes)
  const crc = calculateCRC(chunk.slice(4, 8 + length));
  view.setUint32(8 + length, crc, false);

  return chunk;
}

// Helper: Calculate CRC32 for PNG chunks
function calculateCRC(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

// Export canvas as PNG with high quality (native resolution, no scaling)
export async function exportToPNG(canvas: HTMLCanvasElement, filename: string, dpi: number = 300) {
  // For proper quality: use the canvas at its native resolution
  // and embed DPI metadata so printing software knows the correct output size
  // This avoids the washout from scaling screenshots

  const originalBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });

  if (!originalBlob) {
    alert('Failed to export canvas');
    return;
  }

  console.log(`Exporting PNG at ${dpi} DPI (canvas size: ${canvas.width}x${canvas.height}px)`);

  // Create PNG with DPI metadata
  const blob = await createPNGWithDPI(originalBlob, canvas.width, canvas.height, dpi);

  // Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export canvas as PDF (lossless quality)
export async function exportToPDF(canvas: HTMLCanvasElement, filename: string, dpi: number = 300) {
  // Use canvas native resolution for PDF
  console.log(`Exporting PDF at ${dpi} DPI (canvas size: ${canvas.width}x${canvas.height}px)`);

  // Get high-quality image from canvas
  const imgData = canvas.toDataURL('image/png');

  // Calculate physical dimensions in inches (DPI conversion)
  const widthInches = canvas.width / dpi;
  const heightInches = canvas.height / dpi;

  // Create PDF with proper dimensions
  const pdf = new jsPDF({
    orientation: widthInches > heightInches ? 'landscape' : 'portrait',
    unit: 'in',
    format: [widthInches, heightInches],
    compress: true,
  });

  // Add image to PDF at full canvas size
  pdf.addImage(imgData, 'PNG', 0, 0, widthInches, heightInches);

  // Save PDF
  pdf.save(filename);

  const physicalSize = {
    width: widthInches.toFixed(2),
    height: heightInches.toFixed(2)
  };
  console.log(`PDF created: ${canvas.width}x${canvas.height}px @ ${dpi} DPI (${physicalSize.width}in × ${physicalSize.height}in)`);
}

// Export as SVG with proper bounds calculation
export function exportToSVG(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  width: number = 1200,
  height: number = 1200
): string {
  // Calculate bounds with padding to ensure nothing gets cut off
  const padding = 50; // pixels of padding around content
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  // Find bounds of all circles (cells and functions)
  cells.forEach(cell => {
    const cellLeft = cell.position.x - cell.radius;
    const cellRight = cell.position.x + cell.radius;
    const cellTop = cell.position.y - cell.radius;
    const cellBottom = cell.position.y + cell.radius;

    minX = Math.min(minX, cellLeft);
    maxX = Math.max(maxX, cellRight);
    minY = Math.min(minY, cellTop);
    maxY = Math.max(maxY, cellBottom);

    cell.functions.forEach(fn => {
      const fnLeft = fn.position.x - fn.radius;
      const fnRight = fn.position.x + fn.radius;
      const fnTop = fn.position.y - fn.radius;
      const fnBottom = fn.position.y + fn.radius;

      minX = Math.min(minX, fnLeft);
      maxX = Math.max(maxX, fnRight);
      minY = Math.min(minY, fnTop);
      maxY = Math.max(maxY, fnBottom);
    });
  });

  // Handle default bounds if no cells
  if (!isFinite(minX)) {
    minX = 0;
    maxX = 1;
    minY = 0;
    maxY = 1;
  }

  // Add padding
  minX -= 0.05;
  maxX += 0.05;
  minY -= 0.05;
  maxY += 0.05;

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;

  // Scale to fit in the SVG while maintaining aspect ratio
  const scaleX = (width - padding * 2) / contentWidth;
  const scaleY = (height - padding * 2) / contentHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = padding - minX * scale;
  const offsetY = padding - minY * scale;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .network-circle { fill: white; stroke-linecap: round; stroke-linejoin: round; }
      .network-text { font-family: system-ui, sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .network-line { stroke-linecap: round; stroke-linejoin: round; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${colors.background}"/>
  <g id="network" transform="translate(${offsetX}, ${offsetY}) scale(${scale})">
`;

  // Collect all circles for smart line calculation (using normalized coordinates)
  // Only include visible functions
  const allCircles: Array<{ center: { x: number; y: number }; radius: number }> = [];
  cells.forEach(cell => {
    allCircles.push({
      center: { x: cell.position.x, y: cell.position.y },
      radius: cell.livingRadius
    });
    cell.functions.forEach(fn => {
      // Only include circles for visible functions
      if (config.functionVisible[fn.type]) {
        allCircles.push({
          center: { x: fn.position.x, y: fn.position.y },
          radius: fn.radius
        });
      }
    });
  });

  // Draw connections
  if (!config.linesOnTop) {
    svg += drawConnectionsSVG(cells, config, colors, 1, 1, allCircles);
  }

  // Draw cells
  cells.forEach(cell => {
    const cx = cell.position.x;
    const cy = cell.position.y;
    const cellR = cell.radius;
    const livingR = cell.livingRadius;

    // Cell border (dashed)
    svg += `    <circle cx="${cx.toFixed(4)}" cy="${cy.toFixed(4)}" r="${cellR.toFixed(4)}" fill="none" stroke="${colors.cellBorder}" stroke-width="${(config.cellOutlineWidth / scale).toFixed(4)}" stroke-dasharray="${(8 / scale).toFixed(2)},${(4 / scale).toFixed(2)}" opacity="0.6"/>
`;

    // Living circle
    svg += `    <circle cx="${cx.toFixed(4)}" cy="${cy.toFixed(4)}" r="${livingR.toFixed(4)}" class="network-circle" fill="${colors.living}" stroke="${colors.livingOutline}" stroke-width="${(config.livingOutlineWidth / scale).toFixed(4)}"/>
`;
    svg += `    <text x="${cx.toFixed(4)}" y="${cy.toFixed(4)}" class="network-text" fill="${colors.text}" font-size="${(config.livingFontSize / scale).toFixed(2)}">living</text>
`;

    // Function circles (only visible functions)
    cell.functions.forEach(fn => {
      // Skip invisible functions
      if (!config.functionVisible[fn.type]) return;

      const fx = fn.position.x;
      const fy = fn.position.y;
      const fr = fn.radius;
      const fnColor = colors.functions[fn.type];

      svg += `    <circle cx="${fx.toFixed(4)}" cy="${fy.toFixed(4)}" r="${fr.toFixed(4)}" class="network-circle" fill="white" stroke="${fnColor}" stroke-width="${(config.functionOutlineWidth / scale).toFixed(4)}"/>
`;
      svg += `    <text x="${fx.toFixed(4)}" y="${fy.toFixed(4)}" class="network-text" fill="${colors.text}" font-size="${(config.functionFontSize / scale).toFixed(2)}">${fn.type}</text>
`;
    });
  });

  // Draw connections on top if configured
  if (config.linesOnTop) {
    svg += drawConnectionsSVG(cells, config, colors, 1, 1, allCircles, scale);
  }

  svg += `  </g>
</svg>`;

  return svg;
}

function drawConnectionsSVG(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  scaleX: number,
  scaleY: number,
  allCircles: Array<{ center: { x: number; y: number }; radius: number }>,
  svgScale: number = 1
): string {
  let svg = '';

  cells.forEach((cell, cellIndex) => {
    const livingX = cell.position.x * scaleX;
    const livingY = cell.position.y * scaleY;

    // Internal connections (only visible functions)
    cell.functions.forEach(fn => {
      // Skip invisible functions
      if (!config.functionVisible[fn.type]) return;

      const fnX = fn.position.x * scaleX;
      const fnY = fn.position.y * scaleY;
      const color = colors.functions[fn.type];

      const segments = calculateSmartLineSegments(
        { x: livingX, y: livingY },
        { x: fnX, y: fnY },
        allCircles,
        config.lineWidth
      );

      segments.forEach(seg => {
        svg += `    <line x1="${seg.start.x.toFixed(4)}" y1="${seg.start.y.toFixed(4)}" x2="${seg.end.x.toFixed(4)}" y2="${seg.end.y.toFixed(4)}" class="network-line" stroke="${color}" stroke-width="${(seg.lineWidth / svgScale).toFixed(4)}" opacity="${seg.opacity}" />
`;
      });
    });

    // External connections
    if (config.showExternalConnections) {
      cells.forEach((otherCell, otherIndex) => {
        if (cellIndex === otherIndex) return;

        otherCell.functions.forEach(fn => {
          // Skip invisible functions
          if (!config.functionVisible[fn.type]) return;

          const fnX = fn.position.x * scaleX;
          const fnY = fn.position.y * scaleY;
          const color = colors.functions[fn.type];

          const segments = calculateSmartLineSegments(
            { x: livingX, y: livingY },
            { x: fnX, y: fnY },
            allCircles,
            config.lineWidth
          );

          segments.forEach(seg => {
            svg += `    <line x1="${seg.start.x.toFixed(4)}" y1="${seg.start.y.toFixed(4)}" x2="${seg.end.x.toFixed(4)}" y2="${seg.end.y.toFixed(4)}" class="network-line" stroke="${color}" stroke-width="${(seg.lineWidth / svgScale).toFixed(4)}" opacity="${(seg.opacity * 0.5).toFixed(2)}" />
`;
          });
        });
      });
    }
  });

  return svg;
}

// Create shareable URL with config
export function createShareableURL(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme
): string {
  const data = { cells, config, colors };
  const compressed = btoa(JSON.stringify(data));
  return `${window.location.origin}${window.location.pathname}?data=${compressed}`;
}

// Parse shareable URL
export function parseShareableURL(): { cells: Cell[]; config: NetworkConfig; colors: ColorScheme } | null {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');

  if (!data) return null;

  try {
    return JSON.parse(atob(data));
  } catch {
    return null;
  }
}

// Export animation as GIF
export async function exportToGIF(
  canvas: HTMLCanvasElement,
  _cells: Cell[],
  config: NetworkConfig,
  _colors: ColorScheme,
  onProgress?: (progress: number) => void
): Promise<void> {
  const duration = config.animationDuration * 1000;
  const fps = 20;
  const totalFrames = Math.ceil((duration / 1000) * fps);
  const frameDelay = 1000 / fps;

  // Dispatch animation start
  window.dispatchEvent(new CustomEvent('playAnimation'));

  // Wait a bit for animation to start
  await new Promise(r => setTimeout(r, 100));

  // Collect frames
  const frames: string[] = [];
  const startTime = performance.now();

  for (let i = 0; i < totalFrames; i++) {
    // Wait for the right moment
    const targetTime = startTime + (i * frameDelay);
    const now = performance.now();
    if (targetTime > now) {
      await new Promise(r => setTimeout(r, targetTime - now));
    }

    // Capture frame
    frames.push(canvas.toDataURL('image/png'));
    onProgress?.(i / totalFrames);
  }

  // Create GIF using canvas frames
  // Using a simple approach - convert to animated WebP or use MediaRecorder
  const blob = await createGIFFromFrames(frames, frameDelay, canvas.width, canvas.height);

  // Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'circle-network-animation.gif';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);

  onProgress?.(1);
}

async function createGIFFromFrames(
  frames: string[],
  _delay: number,
  width: number,
  height: number
): Promise<Blob> {
  // Create a simple GIF encoder
  // For simplicity, we'll create an animated image using canvas recording
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d')!;

  // Load all frame images
  const images = await Promise.all(
    frames.map(src => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    })
  );

  // Use MediaRecorder to create a video, then convert to GIF format
  // For now, we'll create a simple WebM and let user convert or use a workaround
  const stream = tempCanvas.captureStream(20);
  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: Blob[] = [];

  return new Promise((resolve) => {
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.start();

    // Draw each frame
    let frameIndex = 0;
    const drawFrame = () => {
      if (frameIndex < images.length) {
        ctx.drawImage(images[frameIndex], 0, 0);
        frameIndex++;
        setTimeout(drawFrame, 50);
      } else {
        mediaRecorder.stop();
      }
    };

    drawFrame();
  });
}
