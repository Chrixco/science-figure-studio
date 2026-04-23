import { useRef, useEffect, useCallback, useState } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useViewState } from '../hooks/useViewState';
import { calculateSmartLineSegments, calculateBoundingBox, CANVAS_SCALE } from '../utils/geometry';
import { generateFunctionBasedLayout, generateFunctionConnections } from '../utils/functionBasedLayout';
import { Point, FunctionType, LineStyle } from '../types';

// Helper to convert LineStyle to canvas dash pattern
function getLineDash(style: LineStyle, lineWidth: number): number[] {
  switch (style) {
    case 'dashed':
      return [lineWidth * 4, lineWidth * 2];
    case 'dotted':
      return [lineWidth, lineWidth * 2];
    case 'solid':
    default:
      return [];
  }
}

interface Connection {
  from: Point;
  to: Point;
  color: string;
  opacity: number;
  isExternal: boolean;
  functionType: FunctionType;
  weight: number;
}

export function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const { cells, config, colors, moveCell } = useNetworkStore();
  const { zoom, panX, panY, setZoom, zoomIn, zoomOut, setView } = useViewState();

  const [canvasSize, setCanvasSize] = useState(0);
  const [showConnections, setShowConnections] = useState(true);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCellStartRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Build list of all connections
  const getAllConnections = useCallback((): Connection[] => {
    const connections: Connection[] = [];
    const filter = config.connectionFilter;

    cells.forEach((cell, cellIndex) => {
      // Internal connections (only for visible functions)
      cell.functions.forEach(fn => {
        if (!config.functionVisible[fn.type]) return;
        if (filter !== 'all' && fn.type !== filter) return;
        connections.push({
          from: cell.position,
          to: fn.position,
          color: colors.functions[fn.type],
          opacity: 1.0,
          isExternal: false,
          functionType: fn.type,
          weight: config.functionWeights[fn.type] || 1.0
        });
      });

      // External connections: each cell connects to other cells' function circles
      if (config.showExternalConnections) {
        cells.forEach((otherCell, otherIndex) => {
          if (cellIndex === otherIndex) return;

          otherCell.functions.forEach(fn => {
            if (!config.functionVisible[fn.type]) return;
            if (filter !== 'all' && fn.type !== filter) return;
            connections.push({
              from: cell.position,
              to: fn.position,
              color: colors.functions[fn.type],
              opacity: 0.4,
              isExternal: true,
              functionType: fn.type,
              weight: config.functionWeights[fn.type] || 1.0
            });
          });
        });
      }
    });

    return connections;
  }, [cells, colors.functions, config.showExternalConnections, config.functionVisible, config.connectionFilter, config.functionWeights]);

  // Convert network coordinates to screen coordinates
  const networkToCanvas = useCallback((networkPoint: Point, canvas: HTMLCanvasElement) => {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Convert network coordinates (0-10) to pixel coordinates
    const pixelX = (networkPoint.x / CANVAS_SCALE) * width;
    const pixelY = (networkPoint.y / CANVAS_SCALE) * height;

    // Apply zoom and pan
    const canvasX = centerX + (pixelX - centerX) * zoom + panX;
    const canvasY = centerY + (pixelY - centerY) * zoom + panY;

    return { x: canvasX, y: canvasY };
  }, [zoom, panX, panY]);

  // Auto-fit on initial load only (once)
  useEffect(() => {
    if (cells.length > 0 && canvasSize > 0 && !isInitialized) {
      // Simple: zoom to 1.0 and center (0, 0)
      // Network coordinates 0-10 will be displayed at actual pixel size
      setView(1.0, 0, 0);
      setIsInitialized(true);
    }
  }, [canvasSize, isInitialized, setView]);

  // Draw the network based on function-based layout
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear and fill background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    const sizeScale = (width / CANVAS_SCALE) * zoom;

    // Generate function-based layout
    const layoutNodes = generateFunctionBasedLayout(
      cells,
      width,
      height,
      config.functionLabels,
      config.functionWeights,
      config.functionVisible
    );

    // Separate nodes by type
    const functionNodes = layoutNodes.filter(n => n.type === 'function');
    const cellNodes = layoutNodes.filter(n => n.type === 'cell');

    // Draw connections from each living circle to its functions (if enabled)
    if (showConnections) {
      // Get all unique cells
      const uniqueCells = cells.map(c => c.id);

      uniqueCells.forEach((cellId) => {
        const livingNode = cellNodes.find(n => n.cellId === cellId);
        if (!livingNode) return;

        const livingPos = networkToCanvas(livingNode.position, canvas);

        // Find functions for this specific cell
        const cellFunctions = functionNodes.filter(fn => fn.id.includes(`-${cellId}-`));

        cellFunctions.forEach((fnNode) => {
          // Check if connection should be filtered
          if (config.connectionFilter !== 'all' && config.connectionFilter !== fnNode.functionType) {
            return; // Skip if filtered
          }

          const fnPos = networkToCanvas(fnNode.position, canvas);

          // Calculate line width based on function weight (lineWidth is already in pixels)
          let lineWidth = config.lineWidth;
          if (config.lineWidthByWeight && fnNode.functionType) {
            const weight = config.functionWeights[fnNode.functionType] || 1;
            lineWidth *= weight;
          }

          // Apply width jitter if enabled
          if (config.lineWidthJitter > 0) {
            const jitter = (Math.random() - 0.5) * config.lineWidthJitter * lineWidth;
            lineWidth += jitter;
          }

          ctx.strokeStyle = colors.cellBorder;
          ctx.globalAlpha = config.lineOpacity;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash(getLineDash(config.lineStyle, config.lineWidth));

          ctx.beginPath();
          ctx.moveTo(livingPos.x, livingPos.y);
          ctx.lineTo(fnPos.x, fnPos.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        });
      });
    }

    // Draw function nodes
    functionNodes.forEach((node) => {
      const center = networkToCanvas(node.position, canvas);
      const radius = node.radius * sizeScale;

      if (!node.functionType) return;

      // Function circle background
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.functionBackground[node.functionType];
      ctx.fill();

      // Function circle border
      ctx.strokeStyle = colors.functions[node.functionType];
      ctx.lineWidth = config.functionOutlineWidth;
      ctx.setLineDash(getLineDash(config.functionOutlineStyle, config.functionOutlineWidth));
      ctx.stroke();
      ctx.setLineDash([]);

      // Function text
      const fontSize = Math.min(config.functionFontSize * zoom * 2, config.functionFontSize * 3);
      ctx.fillStyle = colors.functionText[node.functionType];
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, center.x, center.y);
    });

    // Draw cell nodes
    cellNodes.forEach((node) => {
      const center = networkToCanvas(node.position, canvas);
      const radius = node.radius * sizeScale;
      const isMarked = markedCells.has(node.cellId!);

      // Cell background
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isMarked ? '#00d9ff' : colors.living; // Cyan highlight for selected
      ctx.fill();

      // Cell border - thicker and brighter for selected cells
      ctx.strokeStyle = isMarked ? '#00ff88' : colors.livingOutline;
      ctx.lineWidth = isMarked ? config.livingOutlineWidth * 2 : config.livingOutlineWidth;
      ctx.setLineDash(getLineDash(config.livingOutlineStyle, config.livingOutlineWidth));
      ctx.stroke();
      ctx.setLineDash([]);

      // Cell text
      const fontSize = Math.min(config.livingFontSize * zoom * 2, config.livingFontSize * 3);
      ctx.fillStyle = colors.livingText;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, center.x, center.y);

      // Debug: Draw bounding circle if debug mode is enabled
      if (showDebug && node.boundingRadius) {
        const boundingRadius = node.boundingRadius * sizeScale;
        ctx.strokeStyle = '#0088ff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, boundingRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });
  }, [cells, colors, config, zoom, panX, panY, showConnections, showDebug, markedCells, networkToCanvas]);

  // Update the draw ref whenever draw changes
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // Setup canvas and animation loop (only once)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      setCanvasSize(Math.max(rect.width, rect.height));

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Use ref to avoid recreating interval on every draw change
    const animationId = setInterval(() => {
      if (drawRef.current) drawRef.current();
    }, 1000 / 60); // 60 FPS

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(animationId);
    };
  }, []); // Empty dependency array - only run once

  // Attach wheel listener with { passive: false } for zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const isPinch = e.ctrlKey;
    const delta = isPinch ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
    const newZoom = Math.max(0.05, Math.min(10, zoom * (1 + delta)));
    setZoom(newZoom);
  }, [zoom, setZoom]);

  // Handle panning and cell selection/dragging
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (interactionMode === 'pan') {
      panStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (interactionMode === 'select') {
      // Find which cell was clicked
      const layoutNodes = generateFunctionBasedLayout(cells, canvas.width, canvas.height, config.functionLabels, config.functionWeights, config.functionVisible);
      const cellNodes = layoutNodes.filter(n => n.type === 'cell');
      const sizeScale = (canvas.width / CANVAS_SCALE) * zoom;

      let clickedCellId: string | null = null;

      for (const cellNode of cellNodes) {
        const center = networkToCanvas(cellNode.position, canvas);
        const radius = cellNode.radius * sizeScale;
        const dist = Math.sqrt((canvasX - center.x) ** 2 + (canvasY - center.y) ** 2);

        if (dist <= radius) {
          clickedCellId = cellNode.cellId!;
          break;
        }
      }

      if (clickedCellId) {
        // Toggle selection with Ctrl/Cmd, or select single
        let newMarked = new Set(markedCells);
        if (e.ctrlKey || e.metaKey) {
          if (newMarked.has(clickedCellId)) {
            newMarked.delete(clickedCellId);
          } else {
            newMarked.add(clickedCellId);
          }
        } else if (!newMarked.has(clickedCellId)) {
          newMarked = new Set([clickedCellId]);
        }

        setMarkedCells(newMarked);

        // Start dragging - use newMarked (the updated set) instead of state
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        dragCellStartRef.current = new Map();

        newMarked.forEach(cellId => {
          const cell = cells.find(c => c.id === cellId);
          if (cell) {
            dragCellStartRef.current!.set(cellId, { x: cell.position.x, y: cell.position.y });
          }
        });
      } else {
        // Clicked on empty space - deselect
        setMarkedCells(new Set());
      }
    }
  }, [interactionMode, cells, config, markedCells, networkToCanvas, zoom]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (interactionMode === 'pan' && panStartRef.current) {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      panStartRef.current = { x: e.clientX, y: e.clientY };

      const newPanX = panX + deltaX;
      const newPanY = panY + deltaY;

      setView(zoom, newPanX, newPanY);
    } else if (interactionMode === 'select' && dragStartRef.current && dragCellStartRef.current.size > 0) {
      // Drag marked cells
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Calculate delta in network coordinates
      const deltaPixelX = e.clientX - dragStartRef.current.x;
      const deltaPixelY = e.clientY - dragStartRef.current.y;

      const deltaNetworkX = (deltaPixelX / zoom) / (canvas.width / CANVAS_SCALE);
      const deltaNetworkY = (deltaPixelY / zoom) / (canvas.height / CANVAS_SCALE);

      // Move all marked cells
      dragCellStartRef.current.forEach((startPos, cellId) => {
        const newX = Math.max(0.5, Math.min(CANVAS_SCALE - 0.5, startPos.x + deltaNetworkX));
        const newY = Math.max(0.5, Math.min(CANVAS_SCALE - 0.5, startPos.y + deltaNetworkY));
        moveCell(cellId, { x: newX, y: newY });
      });
    }
  }, [interactionMode, panX, panY, zoom, setView, moveCell, dragCellStartRef]);

  const handleMouseUp = useCallback(() => {
    panStartRef.current = null;
    dragStartRef.current = null;
    dragCellStartRef.current.clear();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div className="w-full h-full flex flex-col bg-canvas overflow-hidden">
      <div className="flex-1 relative" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Toolbar - Camera and View Controls */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-gray-800 bg-gray-900/70 hover:bg-gray-900 transition-colors flex gap-1.5">
        <button
          onClick={zoomIn}
          className="p-2 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="p-2 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
          title="Zoom Out (-)"
        >
          −
        </button>
        <button
          onClick={() => setView(1, 0, 0)}
          className="p-2 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
          title="Reset View"
        >
          ⊙
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowConnections(!showConnections)}
          className={`p-2 rounded text-sm transition-colors ${
            showConnections
              ? 'text-accent-cyan bg-accent-cyan/10'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
          title="Toggle Connections"
        >
          ∿
        </button>
        <div className="w-px bg-gray-700" />
        <button
          onClick={() => setInteractionMode('pan')}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            interactionMode === 'pan'
              ? 'text-accent-cyan bg-accent-cyan/10'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
          title="Pan Mode"
        >
          🖐️
        </button>
        <button
          onClick={() => setInteractionMode('select')}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            interactionMode === 'select'
              ? 'text-accent-cyan bg-accent-cyan/10'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
          title="Select Mode"
        >
          ⬜
        </button>
        <div className="w-px bg-gray-700" />
        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            showDebug
              ? 'text-blue-400 bg-blue-400/10'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
          title="Toggle Debug (Show Cell Bounds)"
        >
          🐛
        </button>
      </div>
    </div>
  );
}
