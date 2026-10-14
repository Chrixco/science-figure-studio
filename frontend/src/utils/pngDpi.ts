/**
 * Write a pHYs chunk into a PNG so it reports a physical resolution.
 *
 * This is metadata only: it tells print software how large the image should
 * appear, and does not change how many pixels it contains. Callers must render
 * at the matching resolution themselves.
 */

/** CRC32 over a PNG chunk's type and data, per the PNG specification. */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, data.length, false);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.slice(4, 8 + data.length)), false);

  return chunk;
}

/** Bytes occupied by the PNG signature plus the IHDR chunk, which must come first. */
const HEADER_BYTES = 8 + 25;

export async function embedPngDpi(png: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  if (bytes.length < HEADER_BYTES) return png;

  // pHYs stores pixels per metre, so convert from dots per inch.
  const pixelsPerMetre = Math.round(dpi / 0.0254);

  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, pixelsPerMetre, false);
  view.setUint32(4, pixelsPerMetre, false);
  data[8] = 1; // unit specifier: metres

  const chunk = buildChunk('pHYs', data);

  // pHYs must appear after IHDR and before IDAT.
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.slice(0, HEADER_BYTES), 0);
  out.set(chunk, HEADER_BYTES);
  out.set(bytes.slice(HEADER_BYTES), HEADER_BYTES + chunk.length);

  return new Blob([out], { type: 'image/png' });
}
