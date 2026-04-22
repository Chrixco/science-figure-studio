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
  const { cells, config, colors } = useNetworkStore();
  const { zoom, panX, panY, setZoom, zoomIn, zoomOut, setView } = useViewState();

  const [canvasSize, setCanvasSize] = useState(0);
  const [showConnections, setShowConnections] = useState(true);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [isInitialized, setIsInitialized] = useState(false);

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

    // Draw connections between cells (if enabled)
    if (showConnections) {
      const connections = generateFunctionConnections(
        cells,
        config.functionLabels,
        config.functionVisible
      );

      connections.forEach(conn => {
        const fromNode = cellNodes.find(n => n.cellId === conn.fromCellId);
        const toNode = cellNodes.find(n => n.cellId === conn.toCellId);

        if (fromNode && toNode) {
          const fromPos = networkToCanvas(fromNode.position, canvas);
          const toPos = networkToCanvas(toNode.position, canvas);

          ctx.strokeStyle = colors.cellBorder;
          ctx.globalAlpha = 0.2 * conn.strength;
          ctx.lineWidth = config.lineWidth * sizeScale;
          ctx.setLineDash(getLineDash(config.lineStyle, config.lineWidth));

          ctx.beginPath();
          ctx.moveTo(fromPos.x, fromPos.y);
          ctx.lineTo(toPos.x, toPos.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
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

      // Cell background
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.living;
      ctx.fill();

      // Cell border
      ctx.strokeStyle = colors.livingOutline;
      ctx.lineWidth = config.livingOutlineWidth;
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
    });
  }, [cells, colors, config, zoom, panX, panY, showConnections, networkToCanvas]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

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
      </div>
    </div>
  );
}
