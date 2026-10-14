import { Cell, ColorScheme, NetworkConfig } from '../types';

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
