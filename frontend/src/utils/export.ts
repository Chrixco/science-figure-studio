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

// Export canvas as PNG
export function exportToPNG(canvas: HTMLCanvasElement, filename: string, scale: number = 2) {
  // Create a high-resolution canvas
  const exportCanvas = document.createElement('canvas');
  const ctx = exportCanvas.getContext('2d')!;

  exportCanvas.width = canvas.width * scale;
  exportCanvas.height = canvas.height * scale;

  ctx.scale(scale, scale);
  ctx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  link.download = filename;
  link.href = exportCanvas.toDataURL('image/png', 1.0);
  link.click();
}

// Export as SVG
export function exportToSVG(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  width: number,
  height: number
): string {
  const scaleX = width;
  const scaleY = height;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${colors.background}"/>
  <g id="network">
`;

  // Collect all circles for smart line calculation
  const allCircles: Array<{ center: { x: number; y: number }; radius: number }> = [];
  cells.forEach(cell => {
    allCircles.push({
      center: { x: cell.position.x * scaleX, y: cell.position.y * scaleY },
      radius: cell.livingRadius * scaleX
    });
    cell.functions.forEach(fn => {
      allCircles.push({
        center: { x: fn.position.x * scaleX, y: fn.position.y * scaleY },
        radius: fn.radius * scaleX
      });
    });
  });

  // Draw connections
  if (!config.linesOnTop) {
    svg += drawConnectionsSVG(cells, config, colors, scaleX, scaleY, allCircles);
  }

  // Draw cells
  cells.forEach(cell => {
    const cx = cell.position.x * scaleX;
    const cy = cell.position.y * scaleY;
    const cellR = cell.radius * scaleX;
    const livingR = cell.livingRadius * scaleX;

    // Cell border (dashed)
    svg += `    <circle cx="${cx}" cy="${cy}" r="${cellR}" fill="none" stroke="${colors.cellBorder}" stroke-width="${config.cellOutlineWidth}" stroke-dasharray="8,4" opacity="0.6"/>
`;

    // Living circle
    svg += `    <circle cx="${cx}" cy="${cy}" r="${livingR}" fill="${colors.living}" stroke="${colors.livingOutline}" stroke-width="${config.livingOutlineWidth}"/>
`;
    svg += `    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${colors.text}" font-size="${config.livingFontSize}" font-family="system-ui, sans-serif">living</text>
`;

    // Function circles
    cell.functions.forEach(fn => {
      const fx = fn.position.x * scaleX;
      const fy = fn.position.y * scaleY;
      const fr = fn.radius * scaleX;
      const fnColor = colors.functions[fn.type];

      svg += `    <circle cx="${fx}" cy="${fy}" r="${fr}" fill="white" stroke="${fnColor}" stroke-width="${config.functionOutlineWidth}"/>
`;
      svg += `    <text x="${fx}" y="${fy}" text-anchor="middle" dominant-baseline="middle" fill="${colors.text}" font-size="${config.functionFontSize}" font-family="system-ui, sans-serif">${fn.type}</text>
`;
    });
  });

  // Draw connections on top if configured
  if (config.linesOnTop) {
    svg += drawConnectionsSVG(cells, config, colors, scaleX, scaleY, allCircles);
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
  allCircles: Array<{ center: { x: number; y: number }; radius: number }>
): string {
  let svg = '';

  cells.forEach((cell, cellIndex) => {
    const livingX = cell.position.x * scaleX;
    const livingY = cell.position.y * scaleY;

    // Internal connections
    cell.functions.forEach(fn => {
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
        svg += `    <line x1="${seg.start.x}" y1="${seg.start.y}" x2="${seg.end.x}" y2="${seg.end.y}" stroke="${color}" stroke-width="${seg.lineWidth}" opacity="${seg.opacity}" stroke-linecap="round"/>
`;
      });
    });

    // External connections
    if (config.showExternalConnections) {
      cells.forEach((otherCell, otherIndex) => {
        if (cellIndex === otherIndex) return;

        otherCell.functions.forEach(fn => {
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
            svg += `    <line x1="${seg.start.x}" y1="${seg.start.y}" x2="${seg.end.x}" y2="${seg.end.y}" stroke="${color}" stroke-width="${seg.lineWidth}" opacity="${seg.opacity * 0.5}" stroke-linecap="round"/>
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
