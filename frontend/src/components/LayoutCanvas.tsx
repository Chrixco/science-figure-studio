import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Circle } from 'react-konva';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { generateFunctionBasedLayout } from '../utils/functionBasedLayout';
import { Point } from '../types';
import Konva from 'konva';

const CANVAS_SCALE = 10;
const NETWORK_TO_SCREEN = 60; // pixels per network unit

export function LayoutCanvas() {
  const {
    cells,
    config,
    colors,
    isDragging,
    selectedCellIds,
    setSelectedCell,
    setSelectedCells,
    toggleCellSelection,
    setIsDragging,
    moveCell,
    moveSelectedCells,
    saveToHistory,
  } = useNetworkStore();

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
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
        const { clientWidth, clientHeight } = containerRef.current;
        console.log('Updating container size:', { clientWidth, clientHeight });
        setContainerSize({
          width: clientWidth,
          height: clientHeight,
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


  // Generate layout nodes from cells
  const layoutNodes = generateFunctionBasedLayout(
    cells,
    CANVAS_SCALE,
    CANVAS_SCALE,
    config.functionLabels,
    config.functionWeights,
    config.functionVisible
  );

  // Debug: Log container size on mount and changes
  useEffect(() => {
    console.log('Container size updated:', containerSize);
  }, [containerSize]);

  // Debug: Log pan changes
  useEffect(() => {
    console.log('Pan values changed:', { panX, panY, zoom });
  }, [panX, panY, zoom]);

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

  // Find cell at position
  const findCellAtPosition = useCallback(
    (pos: Point): string | null => {
      for (const cell of cells) {
        const dx = pos.x - cell.position.x;
        const dy = pos.y - cell.position.y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.4) return cell.id;
      }
      return null;
    },
    [cells]
  );

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;

      const pos = screenToNetwork(e.evt.clientX, e.evt.clientY);
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
      } else {
        if (!e.evt.shiftKey) setSelectedCells([]);
        setIsPanning(true);
        panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
      }
    },
    [screenToNetwork, findCellAtPosition, cells, selectedCellIds, toggleCellSelection, setSelectedCell, setSelectedCells, saveToHistory]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning && panStartRef.current) {
        const deltaX = e.evt.clientX - panStartRef.current.x;
        const deltaY = e.evt.clientY - panStartRef.current.y;
        console.log('Pan move:', {
          deltaX,
          deltaY,
          eventClientX: e.evt.clientX,
          eventClientY: e.evt.clientY,
          startX: panStartRef.current.x,
          startY: panStartRef.current.y,
          newPanX: panX + deltaX,
          newPanY: panY + deltaY
        });
        setPanX((prev) => {
          const newVal = prev + deltaX;
          console.log('setPanX:', { prev, deltaX, newVal });
          return newVal;
        });
        setPanY((prev) => {
          const newVal = prev + deltaY;
          console.log('setPanY:', { prev, deltaY, newVal });
          return newVal;
        });
        panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }

      if (!isDragging || !dragStartRef.current) return;

      const pos = screenToNetwork(e.evt.clientX, e.evt.clientY);
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
    [isPanning, isDragging, selectedCellIds, screenToNetwork, moveCell, moveSelectedCells]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    dragStartRef.current = null;
    dragCellStartRef.current = null;
    panStartRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const oldZoom = zoom;
      const delta = e.evt.ctrlKey ? -e.evt.deltaY * 0.01 : -e.evt.deltaY * 0.002;
      const newZoom = Math.max(0.1, Math.min(10, zoom * (1 + delta)));

      const scale = newZoom / oldZoom;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.evt.clientX - rect.left;
      const mouseY = e.evt.clientY - rect.top;
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
          style={{ cursor: isPanning ? 'grab' : isDragging ? 'grabbing' : 'default' }}
        >
          <Layer>
            {/* Draw cells and functions */}
            {layoutNodes.map((node) => {
              const screenPos = networkToScreen(node.position);
              const isSelected = node.cellId && selectedCellIds.includes(node.cellId);

              if (node.type === 'cell') {
                return (
                  <React.Fragment key={node.id}>
                    <Circle
                      x={screenPos.x}
                      y={screenPos.y}
                      radius={node.radius * NETWORK_TO_SCREEN * zoom}
                      fill={colors.living || '#00ff00'}
                      opacity={0.7}
                      stroke={isSelected ? '#00ffff' : 'transparent'}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                  </React.Fragment>
                );
              } else {
                return (
                  <React.Fragment key={node.id}>
                    <Circle
                      x={screenPos.x}
                      y={screenPos.y}
                      radius={Math.max(2, node.radius * NETWORK_TO_SCREEN * zoom)}
                      fill={colors.functions[node.functionType!] || '#0088ff'}
                      opacity={0.6}
                    />
                  </React.Fragment>
                );
              }
            })}

          </Layer>
        </Stage>
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
          onClick={() => {
            setZoom(1);
            setPanX(0);
            setPanY(0);
          }}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm ml-auto"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
