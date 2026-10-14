import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Circle, Line, Text } from 'react-konva';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { generateFunctionBasedLayout, generateFunctionConnections } from '../utils/functionBasedLayout';
import { Point, TextAlignment, LineStyle } from '../types';
import { measureText } from '../utils/textMeasure';
import { computeLabelPlacements, LabelInput, labelBoxWidth } from '../utils/labelLayout';
import Konva from 'konva';

const NETWORK_TO_SCREEN = 60; // pixels per network unit
const CELL_SELECT_RADIUS = 0.4; // Network units for cell selection radius

/** Konva dash pattern for a LineStyle, or undefined for solid. */
function dashFor(style: LineStyle): number[] | undefined {
  switch (style) {
    case 'dashed':
      return [5, 5];
    case 'dotted':
      return [2, 2];
    default:
      return undefined;
  }
}

/** A node's drawn radius in screen pixels, with a floor so it stays visible. */
function nodeScreenRadius(
  node: { type: 'cell' | 'function'; radius: number },
  zoom: number
): number {
  const scaled = node.radius * NETWORK_TO_SCREEN * zoom;
  return node.type === 'cell' ? scaled : Math.max(3, scaled);
}

interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Zoom and pan that frames every node, with a margin.
 *
 * Returns null when there is nothing to frame or the container has not been
 * measured yet.
 */
function computeFit(
  nodes: { position: Point; radius: number; boundingRadius?: number }[],
  container: { width: number; height: number }
): ViewTransform | null {
  if (nodes.length === 0) return null;
  if (container.width <= 0 || container.height <= 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const extent = Math.max(node.radius, node.boundingRadius ?? 0);
    minX = Math.min(minX, node.position.x - extent);
    maxX = Math.max(maxX, node.position.x + extent);
    minY = Math.min(minY, node.position.y - extent);
    maxY = Math.max(maxY, node.position.y + extent);
  }

  const contentWidth = Math.max(maxX - minX, 1e-6);
  const contentHeight = Math.max(maxY - minY, 1e-6);

  const padding = 48;
  const zoom = Math.max(
    0.1,
    Math.min(
      10,
      Math.min(
        (container.width - padding * 2) / (contentWidth * NETWORK_TO_SCREEN),
        (container.height - padding * 2) / (contentHeight * NETWORK_TO_SCREEN)
      )
    )
  );

  // networkToScreen centres the viewport on the network origin, so panning by
  // the negated content centre brings that centre to the middle of the stage.
  return {
    zoom,
    panX: (-(minX + maxX) / 2) * NETWORK_TO_SCREEN * zoom,
    panY: (-(minY + maxY) / 2) * NETWORK_TO_SCREEN * zoom,
  };
}

interface NodeLabelProps {
  /** Centre of the label box, in screen pixels, already resolved by layout. */
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  alignment: TextAlignment;
  /**
   * Colour painted behind the glyphs as a halo.
   *
   * Pass the node's own fill: a label wider than its circle spills onto the
   * canvas, where text coloured for the circle becomes unreadable. A halo in
   * the circle's colour is invisible over the circle itself and carries a
   * matching patch out under the overhang.
   */
  haloColor?: string;
}

/**
 * A label anchored to a node.
 *
 * Konva ignores `align` unless `width` is set and `verticalAlign` unless
 * `height` is set, so both are measured and passed explicitly -- otherwise the
 * text/alignment controls appear to do nothing and every label renders from its
 * top-left corner at the circle's centre.
 */
function NodeLabel({ x, y, text, fontSize, fill, alignment, haloColor }: NodeLabelProps) {
  const metrics = measureText(text, fontSize);

  // Pad the box so `align` has room to move the text within it, and so
  // sub-pixel measurement differences never clip a glyph.
  const boxWidth = labelBoxWidth(metrics.width, fontSize);
  const boxHeight = metrics.height;

  return (
    <Text
      x={x - boxWidth / 2}
      y={y - boxHeight / 2}
      width={boxWidth}
      height={boxHeight}
      text={text}
      fontSize={fontSize}
      fill={fill}
      align={alignment}
      verticalAlign="middle"
      wrap="none"
      listening={false}
      {...(haloColor
        ? {
            stroke: haloColor,
            // Scale with the type so the halo stays proportional when zoomed.
            // Kept thin: it should read as a background patch, not an outline.
            strokeWidth: Math.max(1, fontSize * 0.16),
            // Paint the stroke first so it reads as a halo behind the glyphs
            // rather than an outline over them.
            fillAfterStrokeEnabled: true,
            // Keep the halo crisp instead of following the glyph joins.
            lineJoin: 'round' as const,
          }
        : {})}
    />
  );
}

export function LayoutCanvas() {
  const {
    cells,
    config,
    colors,
    isDragging,
    selectedCellIds,
    setSelectedCell,
    toggleCellSelection,
    setIsDragging,
    moveCell,
    moveSelectedCells,
    saveToHistory,
    layoutVersion,
  } = useNetworkStore();

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('select');
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Point | null>(null);
  const dragCellStartRef = useRef<Point | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Track container size changes
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    // Update on mount with a small delay to ensure DOM is laid out
    const timeoutId = setTimeout(updateSize, 100);

    // Use ResizeObserver for better resize tracking
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);


  // Recomputed only when its inputs change -- this used to run on every render,
  // including every mousemove during a drag.
  const layoutNodes = useMemo(
    () =>
      generateFunctionBasedLayout(
        cells,
        config.functionLabels,
        config.functionWeights,
        config.functionVisible
      ),
    [cells, config.functionLabels, config.functionWeights, config.functionVisible]
  );


  // Convert network coordinates to screen coordinates
  const networkToScreen = useCallback(
    (pos: Point): Point => {
      const centerX = (containerSize.width || 800) / 2;
      const centerY = (containerSize.height || 600) / 2;
      return {
        x: pos.x * NETWORK_TO_SCREEN * zoom + panX + centerX,
        y: pos.y * NETWORK_TO_SCREEN * zoom + panY + centerY,
      };
    },
    [zoom, panX, panY, containerSize]
  );

  // Convert screen coordinates to network coordinates
  const screenToNetwork = useCallback(
    (screenX: number, screenY: number): Point => {
      const centerX = (containerSize.width || 800) / 2;
      const centerY = (containerSize.height || 600) / 2;
      return {
        x: (screenX - panX - centerX) / (NETWORK_TO_SCREEN * zoom),
        y: (screenY - panY - centerY) / (NETWORK_TO_SCREEN * zoom),
      };
    },
    [zoom, panX, panY, containerSize]
  );

  // Frame all content in the viewport.
  //
  // Cells now live in a coordinate space that grows with the cell count, so a
  // fixed zoom of 1 can leave most of a large network off-screen.
  const fit = useMemo(
    () => computeFit(layoutNodes, containerSize),
    [layoutNodes, containerSize]
  );

  const fitToContent = useCallback(() => {
    if (!fit) return;
    setZoom(fit.zoom);
    setPanX(fit.panX);
    setPanY(fit.panY);
  }, [fit]);

  // Frame the network on first paint and whenever the cell count changes
  // (regenerate, template switch, import) -- but never mid-drag, which is why
  // the key deliberately excludes cell positions.
  //
  // Adjusting during render rather than in an effect avoids the extra commit
  // that would otherwise paint one frame at the wrong zoom.
  const fitKey = `${layoutVersion}:${containerSize.width}x${containerSize.height}`;
  const [fittedKey, setFittedKey] = useState<string | null>(null);
  if (fit && fittedKey !== fitKey) {
    setFittedKey(fitKey);
    setZoom(fit.zoom);
    setPanX(fit.panX);
    setPanY(fit.panY);
  }

  // Konva's pointer position is already relative to the Stage. Reading
  // e.evt.clientX/clientY instead offsets every hit-test by whatever sits to the
  // left of the canvas (the 320px sidebar), which made cells unclickable.
  const getNetworkPointer = useCallback((): Point | null => {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return null;
    return screenToNetwork(pointer.x, pointer.y);
  }, [screenToNetwork]);

  // Find cell at position using layout nodes (which have the correct rendered positions)
  const findCellAtPosition = useCallback(
    (pos: Point): string | null => {
      // Check layout nodes for cells (type === 'cell')
      for (const node of layoutNodes) {
        if (node.type === 'cell' && node.cellId) {
          const dx = pos.x - node.position.x;
          const dy = pos.y - node.position.y;
          if (Math.sqrt(dx * dx + dy * dy) < CELL_SELECT_RADIUS) return node.cellId;
        }
      }
      return null;
    },
    [layoutNodes]
  );

  // Generate connections between cells
  const connections = useMemo(
    () => generateFunctionConnections(cells, config.functionVisible),
    [cells, config.functionVisible]
  );

  /**
   * Resolve where every label should sit.
   *
   * Shared with the SVG exporter so a saved figure matches the screen.
   */
  const labelPlacements = useMemo(() => {
    const inputs: LabelInput[] = layoutNodes.map((node) => {
      const isCell = node.type === 'cell';
      return {
        id: node.id,
        position: node.position,
        // Match the on-screen radius floor so small function circles do not
        // pull their labels inside themselves.
        radius: nodeScreenRadius(node, zoom) / (NETWORK_TO_SCREEN * zoom),
        text: isCell
          ? cells.find((c) => c.id === node.cellId)?.label || config.livingLabel
          : node.label,
        fontSize: isCell
          ? Math.max(10, config.livingFontSize * zoom)
          : Math.max(8, config.functionFontSize * zoom),
      };
    });

    return computeLabelPlacements(inputs, {
      scale: NETWORK_TO_SCREEN * zoom,
      textPosition: config.textPosition,
      gap: config.textOffset * zoom,
      avoidOverlap: config.avoidLabelOverlap,
      padding: config.labelOverlapPadding * zoom,
    });
  }, [
    layoutNodes,
    cells,
    zoom,
    config.textPosition,
    config.textOffset,
    config.livingFontSize,
    config.functionFontSize,
    config.livingLabel,
    config.avoidLabelOverlap,
    config.labelOverlapPadding,
  ]);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      // Middle mouse button or left click in pan mode = pan
      if (e.evt.button === 1 || (e.evt.button === 0 && interactionMode === 'pan')) {
        setIsPanning(true);
        panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }

      // Only left click in select mode for cell selection
      if (e.evt.button !== 0 || interactionMode !== 'select') return;

      const pos = getNetworkPointer();
      if (!pos) return;
      const cellId = findCellAtPosition(pos);

      if (cellId) {
        if (e.evt.shiftKey) {
          toggleCellSelection(cellId);
        } else if (!selectedCellIds.includes(cellId)) {
          setSelectedCell(cellId);
        }
        saveToHistory();
        setIsDragging(true);
        dragStartRef.current = pos;
        const cell = cells.find((c) => c.id === cellId);
        dragCellStartRef.current = cell ? { ...cell.position } : null;
      }
    },
    [getNetworkPointer, findCellAtPosition, cells, selectedCellIds, toggleCellSelection, setSelectedCell, setIsDragging, saveToHistory, interactionMode]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning && panStartRef.current) {
        const deltaX = e.evt.clientX - panStartRef.current.x;
        const deltaY = e.evt.clientY - panStartRef.current.y;
        setPanX((prev) => prev + deltaX);
        setPanY((prev) => prev + deltaY);
        panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }

      if (!isDragging || !dragStartRef.current) return;

      const pos = getNetworkPointer();
      if (!pos) return;
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;

      if (selectedCellIds.length > 1) {
        moveSelectedCells(dx, dy);
        dragStartRef.current = pos;
      } else if (dragCellStartRef.current && selectedCellIds.length === 1) {
        moveCell(selectedCellIds[0], {
          x: dragCellStartRef.current.x + dx,
          y: dragCellStartRef.current.y + dy,
        });
      }
    },
    [isPanning, isDragging, selectedCellIds, getNetworkPointer, moveCell, moveSelectedCells]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    dragStartRef.current = null;
    dragCellStartRef.current = null;
    panStartRef.current = null;
  }, [setIsDragging]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const oldZoom = zoom;
      const delta = e.evt.ctrlKey ? -e.evt.deltaY * 0.01 : -e.evt.deltaY * 0.002;
      const newZoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));

      const scale = newZoom / oldZoom;
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const mouseX = pointer.x;
      const mouseY = pointer.y;
      const centerX = (containerSize.width || 800) / 2;
      const centerY = (containerSize.height || 600) / 2;

      // Zoom at cursor
      setPanX((prev) => (mouseX - centerX) * (1 - scale) + scale * prev);
      setPanY((prev) => (mouseY - centerY) * (1 - scale) + scale * prev);
      setZoom(newZoom);
    },
    [zoom, containerSize]
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 bg-canvas-dark relative overflow-hidden"
      >
        <Stage
          ref={stageRef}
          width={containerSize.width || 800}
          height={containerSize.height || 600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            cursor: isPanning ? 'grab' : isDragging ? 'grabbing' : interactionMode === 'pan' ? 'grab' : 'default'
          }}
        >
          <Layer>
            {/* Draw connections between cells */}
            {config.showExternalConnections && connections.map((conn) => {
              const cell1 = cells.find(c => c.id === conn.fromCellId);
              const cell2 = cells.find(c => c.id === conn.toCellId);
              if (!cell1 || !cell2) return null;

              const pos1 = networkToScreen(cell1.position);
              const pos2 = networkToScreen(cell2.position);

              return (
                <Line
                  key={`connection-${conn.fromCellId}-${conn.toCellId}`}
                  points={[pos1.x, pos1.y, pos2.x, pos2.y]}
                  stroke={colors.grid || '#444444'}
                  strokeWidth={config.lineWidth * zoom}
                  opacity={config.lineOpacity}
                  dash={config.lineStyle === 'dashed' ? [5, 5] : config.lineStyle === 'dotted' ? [2, 2] : undefined}
                />
              );
            })}

            {/* Draw connections from functions to their parent cells */}
            {config.showFunctionConnections && layoutNodes.map((node) => {
              if (node.type === 'function' && node.cellId) {
                const parentCell = layoutNodes.find(n => n.type === 'cell' && n.cellId === node.cellId);
                if (!parentCell) return null;

                const functionPos = networkToScreen(node.position);
                const cellPos = networkToScreen(parentCell.position);

                return (
                  <Line
                    key={`fn-conn-${node.id}`}
                    points={[functionPos.x, functionPos.y, cellPos.x, cellPos.y]}
                    stroke={colors.grid || '#444444'}
                    strokeWidth={Math.max(0.5, config.lineWidth * 0.5 * zoom)}
                    opacity={config.lineOpacity * 0.7}
                    dash={config.lineStyle === 'dashed' ? [5, 5] : config.lineStyle === 'dotted' ? [2, 2] : undefined}
                  />
                );
              }
              return null;
            })}

            {/* Circles, drawn in one pass so that no label can be painted
                over by a neighbouring node's circle. */}
            {layoutNodes.map((node) => {
              const screenPos = networkToScreen(node.position);
              const isSelected = !!node.cellId && selectedCellIds.includes(node.cellId);
              const radius = nodeScreenRadius(node, zoom);

              if (node.type === 'cell') {
                return (
                  <React.Fragment key={`shape-${node.id}`}>
                    {/* Bounding circle showing the cell's spacing footprint */}
                    {config.avoidOverlap && node.boundingRadius !== undefined && (
                      <Circle
                        x={screenPos.x}
                        y={screenPos.y}
                        radius={node.boundingRadius * NETWORK_TO_SCREEN * zoom}
                        fill="transparent"
                        stroke={colors.cellBorder || '#666666'}
                        strokeWidth={Math.max(1, config.cellOutlineWidth * zoom)}
                        dash={dashFor(config.cellOutlineStyle)}
                        listening={false}
                      />
                    )}

                    <Circle
                      x={screenPos.x}
                      y={screenPos.y}
                      radius={radius}
                      fill={colors.living || '#00ff00'}
                      stroke={isSelected ? colors.text || '#ffffff' : colors.livingOutline || '#00cc00'}
                      strokeWidth={Math.max(1, (isSelected ? 3 : config.livingOutlineWidth) * zoom)}
                      dash={dashFor(config.livingOutlineStyle)}
                      listening={false}
                    />
                  </React.Fragment>
                );
              }

              return (
                <Circle
                  key={`shape-${node.id}`}
                  x={screenPos.x}
                  y={screenPos.y}
                  radius={radius}
                  fill={
                    colors.functionBackground[node.functionType!] ||
                    colors.functions[node.functionType!] ||
                    '#0088ff'
                  }
                  stroke={
                    isSelected
                      ? colors.text || '#ffffff'
                      : colors.functions[node.functionType!] || '#0088ff'
                  }
                  strokeWidth={Math.max(1, (isSelected ? 3 : config.functionOutlineWidth) * zoom)}
                  dash={dashFor(config.functionOutlineStyle)}
                  listening={false}
                />
              );
            })}

            {/* Leader lines, drawn under the labels they belong to. */}
            {config.avoidLabelOverlap &&
              config.showLabelLeaders &&
              layoutNodes.map((node) => {
                const placement = labelPlacements.get(node.id);
                if (!placement?.displaced) return null;

                const from = networkToScreen(node.position);
                // Placements are pan-free, so re-apply the same offset
                // networkToScreen uses to land in stage coordinates.
                const to = {
                  x: placement.x + panX + (containerSize.width || 800) / 2,
                  y: placement.y + panY + (containerSize.height || 600) / 2,
                };

                return (
                  <Line
                    key={`leader-${node.id}`}
                    points={[from.x, from.y, to.x, to.y]}
                    stroke={colors.text || '#888888'}
                    strokeWidth={Math.max(0.5, 0.75 * zoom)}
                    opacity={0.45}
                    listening={false}
                  />
                );
              })}

            {/* Labels, above every circle. */}
            {layoutNodes.map((node) => {
              const placement = labelPlacements.get(node.id);
              if (!placement) return null;

              const isCell = node.type === 'cell';
              const label = isCell
                ? cells.find((c) => c.id === node.cellId)?.label || config.livingLabel
                : node.label;

              return (
                <NodeLabel
                  key={`label-${node.id}`}
                  x={placement.x + panX + (containerSize.width || 800) / 2}
                  y={placement.y + panY + (containerSize.height || 600) / 2}
                  text={label}
                  fontSize={
                    isCell
                      ? Math.max(10, config.livingFontSize * zoom)
                      : Math.max(8, config.functionFontSize * zoom)
                  }
                  fill={
                    isCell
                      ? colors.livingText || '#ffffff'
                      : colors.functionText[node.functionType!] || '#ffffff'
                  }
                  alignment={config.textAlignment}
                  haloColor={
                    isCell
                      ? colors.living || undefined
                      : colors.functionBackground[node.functionType!] ||
                        colors.functions[node.functionType!]
                  }
                />
              );
            })}

          </Layer>
        </Stage>

        {/* Interaction Mode Controls */}
        <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
          <button
            onClick={() => setInteractionMode('pan')}
            className={`px-3 py-2 rounded text-xs font-medium transition-all border ${
              interactionMode === 'pan'
                ? 'bg-accent-cyan/30 border-accent-cyan text-accent-cyan'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
            }`}
            title="Pan Mode - Click and drag to move view"
          >
            🖐️ Pan
          </button>
          <button
            onClick={() => setInteractionMode('select')}
            className={`px-3 py-2 rounded text-xs font-medium transition-all border ${
              interactionMode === 'select'
                ? 'bg-accent-cyan/30 border-accent-cyan text-accent-cyan'
                : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
            }`}
            title="Selection Mode - Click and drag to select, drag cells to move"
          >
            ⬜ Select
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="p-4 bg-canvas border-t border-canvas-dark flex gap-2">
        <button
          onClick={() => setZoom((prev) => Math.max(0.1, prev - 0.1))}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          −
        </button>
        <span className="px-3 py-1 text-sm text-gray-300 min-w-fit">{zoom.toFixed(2)}×</span>
        <button
          onClick={() => setZoom((prev) => Math.min(10, prev + 0.1))}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          +
        </button>
        <button
          onClick={fitToContent}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm ml-auto"
          title="Zoom and pan so the whole network is visible"
        >
          Fit to View
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPanX(0);
            setPanY(0);
          }}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          title="Reset zoom to 100% and recentre on the origin"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
