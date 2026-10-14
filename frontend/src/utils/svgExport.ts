import { Cell, ColorScheme, NetworkConfig } from '../types';
import { generateFunctionBasedLayout, generateFunctionConnections } from './functionBasedLayout';
import { computeLabelPlacements, LabelInput, labelBoxWidth } from './labelLayout';
import { measureText } from './textMeasure';

/**
 * Vector export of the mitosis figure.
 *
 * Built from the same layout and label-placement code the interactive canvas
 * uses, so a saved figure matches what was designed on screen. The previous
 * exporter re-derived everything and had drifted: it wrote the literal string
 * "living" as every cell's label, used raw function keys instead of the user's
 * labels, hardcoded white function fills, ignored per-function text colours and
 * weights, and knew nothing about text position or overlap avoidance.
 */

/** Escape text for inclusion in XML character data or an attribute. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dashArray(style: string, width: number): string {
  switch (style) {
    case 'dashed':
      return ` stroke-dasharray="${(width * 4).toFixed(2)},${(width * 2).toFixed(2)}"`;
    case 'dotted':
      return ` stroke-dasharray="${width.toFixed(2)},${(width * 2).toFixed(2)}"`;
    default:
      return '';
  }
}

export interface SvgExportOptions {
  /** Output pixels per network unit. Larger means a bigger, sharper figure. */
  scale?: number;
  /** Margin around the content, in output pixels. */
  padding?: number;
  /** Font stack written into the SVG. */
  fontFamily?: string;
}

/**
 * Render the network to a standalone SVG document.
 *
 * The viewBox is fitted to the content, so the result has no dead margin and
 * scales cleanly to any figure width a journal asks for.
 */
export function exportNetworkToSVG(
  cells: Cell[],
  config: NetworkConfig,
  colors: ColorScheme,
  { scale = 60, padding = 48, fontFamily = 'Helvetica, Arial, sans-serif' }: SvgExportOptions = {}
): string {
  const layoutNodes = generateFunctionBasedLayout(
    cells,
    config.functionLabels,
    config.functionWeights,
    config.functionVisible
  );

  const labelInputs: LabelInput[] = layoutNodes.map((node) => {
    const isCell = node.type === 'cell';
    return {
      id: node.id,
      position: node.position,
      radius: node.radius,
      text: isCell
        ? cells.find((c) => c.id === node.cellId)?.label || config.livingLabel
        : node.label,
      fontSize: isCell ? config.livingFontSize : config.functionFontSize,
    };
  });

  const placements = computeLabelPlacements(labelInputs, {
    scale,
    textPosition: config.textPosition,
    gap: config.textOffset,
    avoidOverlap: config.avoidLabelOverlap,
    padding: config.labelOverlapPadding,
    // Export is not interactive, so it can afford to converge properly.
    iterations: 300,
  });

  // --- Bounds: circles and labels both, so nothing is clipped ---
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };

  for (const node of layoutNodes) {
    const extent = Math.max(node.radius, node.boundingRadius ?? 0) * scale;
    include(node.position.x * scale - extent, node.position.y * scale - extent);
    include(node.position.x * scale + extent, node.position.y * scale + extent);
  }
  for (const placement of placements.values()) {
    include(placement.x - placement.width / 2, placement.y - placement.height / 2);
    include(placement.x + placement.width / 2, placement.y + placement.height / 2);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = scale;
    minY = 0;
    maxY = scale;
  }

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const offsetX = padding - minX;
  const offsetY = padding - minY;

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(
      2
    )}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}">`
  );
  parts.push(`  <rect width="100%" height="100%" fill="${colors.background}"/>`);
  parts.push(`  <g transform="translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})">`);

  const sx = (x: number) => (x * scale).toFixed(2);
  const sy = (y: number) => (y * scale).toFixed(2);

  // --- Cell-to-cell connections ---
  if (config.showExternalConnections) {
    const connections = generateFunctionConnections(cells, config.functionVisible);
    for (const connection of connections) {
      const from = cells.find((c) => c.id === connection.fromCellId);
      const to = cells.find((c) => c.id === connection.toCellId);
      if (!from || !to) continue;

      parts.push(
        `    <line x1="${sx(from.position.x)}" y1="${sy(from.position.y)}" x2="${sx(
          to.position.x
        )}" y2="${sy(to.position.y)}" stroke="${colors.grid}" stroke-width="${config.lineWidth.toFixed(
          2
        )}" stroke-opacity="${config.lineOpacity}" stroke-linecap="round"${dashArray(
          config.lineStyle,
          config.lineWidth
        )}/>`
      );
    }
  }

  // --- Function-to-cell spokes ---
  if (config.showFunctionConnections) {
    for (const node of layoutNodes) {
      if (node.type !== 'function' || !node.cellId) continue;
      const parent = layoutNodes.find((n) => n.type === 'cell' && n.cellId === node.cellId);
      if (!parent) continue;

      parts.push(
        `    <line x1="${sx(node.position.x)}" y1="${sy(node.position.y)}" x2="${sx(
          parent.position.x
        )}" y2="${sy(parent.position.y)}" stroke="${colors.grid}" stroke-width="${(
          config.lineWidth * 0.5
        ).toFixed(2)}" stroke-opacity="${(config.lineOpacity * 0.7).toFixed(
          2
        )}" stroke-linecap="round"${dashArray(config.lineStyle, config.lineWidth * 0.5)}/>`
      );
    }
  }

  // --- Circles ---
  for (const node of layoutNodes) {
    if (node.type === 'cell') {
      if (config.avoidOverlap && node.boundingRadius !== undefined) {
        parts.push(
          `    <circle cx="${sx(node.position.x)}" cy="${sy(node.position.y)}" r="${(
            node.boundingRadius * scale
          ).toFixed(2)}" fill="none" stroke="${colors.cellBorder}" stroke-width="${
            config.cellOutlineWidth
          }"${dashArray(config.cellOutlineStyle, config.cellOutlineWidth)}/>`
        );
      }
      parts.push(
        `    <circle cx="${sx(node.position.x)}" cy="${sy(node.position.y)}" r="${(
          node.radius * scale
        ).toFixed(2)}" fill="${colors.living}" stroke="${colors.livingOutline}" stroke-width="${
          config.livingOutlineWidth
        }"${dashArray(config.livingOutlineStyle, config.livingOutlineWidth)}/>`
      );
    } else {
      const type = node.functionType!;
      parts.push(
        `    <circle cx="${sx(node.position.x)}" cy="${sy(node.position.y)}" r="${(
          node.radius * scale
        ).toFixed(2)}" fill="${colors.functionBackground[type] || '#ffffff'}" stroke="${
          colors.functions[type]
        }" stroke-width="${config.functionOutlineWidth}"${dashArray(
          config.functionOutlineStyle,
          config.functionOutlineWidth
        )}/>`
      );
    }
  }

  // --- Leader lines, under the labels they belong to ---
  if (config.avoidLabelOverlap && config.showLabelLeaders) {
    for (const placement of placements.values()) {
      if (!placement.displaced) continue;
      parts.push(
        `    <line x1="${placement.anchorX.toFixed(2)}" y1="${placement.anchorY.toFixed(
          2
        )}" x2="${placement.x.toFixed(2)}" y2="${placement.y.toFixed(2)}" stroke="${
          colors.text
        }" stroke-width="0.75" stroke-opacity="0.45"/>`
      );
    }
  }

  // --- Labels, above every circle ---
  for (const node of layoutNodes) {
    const placement = placements.get(node.id);
    if (!placement) continue;

    const isCell = node.type === 'cell';
    const text = isCell
      ? cells.find((c) => c.id === node.cellId)?.label || config.livingLabel
      : node.label;
    const fill = isCell ? colors.livingText : colors.functionText[node.functionType!];
    const halo = isCell
      ? colors.living
      : colors.functionBackground[node.functionType!] || colors.functions[node.functionType!];

    // Mirror the canvas: `align` positions the text within its measured box.
    const metrics = measureText(text, placement.fontSize);
    const boxWidth = labelBoxWidth(metrics.width, placement.fontSize);
    let x = placement.x;
    let anchor = 'middle';
    if (config.textAlignment === 'left') {
      x = placement.x - boxWidth / 2;
      anchor = 'start';
    } else if (config.textAlignment === 'right') {
      x = placement.x + boxWidth / 2;
      anchor = 'end';
    }

    const common =
      `x="${x.toFixed(2)}" y="${placement.y.toFixed(2)}" font-family="${fontFamily}" ` +
      `font-size="${placement.fontSize.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="central"`;

    // Halo first, then the glyphs on top -- the same order the canvas paints.
    parts.push(
      `    <text ${common} fill="none" stroke="${halo}" stroke-width="${(
        placement.fontSize * 0.16
      ).toFixed(2)}" stroke-linejoin="round">${escapeXml(text)}</text>`
    );
    parts.push(`    <text ${common} fill="${fill}">${escapeXml(text)}</text>`);
  }

  parts.push('  </g>');
  parts.push('</svg>');

  return parts.join('\n');
}
