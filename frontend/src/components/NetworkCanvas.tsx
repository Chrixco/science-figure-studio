import { useRef, useEffect, useCallback, useState } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useViewState } from '../hooks/useViewState';
import { calculateSmartLineSegments, calculateBoundingBox, CANVAS_SCALE } from '../utils/geometry';
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
  const { cells, config, colors } = useNetworkStore();
  const { zoom, panX, panY, setZoom, zoomIn, zoomOut, setView } = useViewState();

  const [canvasSize, setCanvasSize] = useState(0);
  const [showConnections, setShowConnections] = useState(true);

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

    const normalizedX = networkPoint.x * (width / CANVAS_SCALE);
    const normalizedY = networkPoint.y * (height / CANVAS_SCALE);

    const canvasX = normalizedX * zoom + centerX + panX;
    const canvasY = normalizedY * zoom + centerY + panY;

    return { x: canvasX, y: canvasY };
  }, [zoom, panX, panY]);

  // Auto-fit on initial load
  useEffect(() => {
    if (cells.length > 0 && canvasSize > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const bbox = calculateBoundingBox(cells);

      // Calculate zoom to fit bounding box
      const scaleX = width / (bbox.width * (width / CANVAS_SCALE));
      const scaleY = height / (bbox.height * (height / CANVAS_SCALE));
      const newZoom = Math.min(scaleX, scaleY) * 0.9;

      // Calculate pan to center the bounding box
      const centerX = width / 2;
      const centerY = height / 2;
      const networkCenterX = (bbox.centerX - CANVAS_SCALE / 2) * width / CANVAS_SCALE;
      const networkCenterY = (bbox.centerY - CANVAS_SCALE / 2) * height / CANVAS_SCALE;

      const newPanX = centerX - networkCenterX * newZoom;
      const newPanY = centerY - networkCenterY * newZoom;

      setView(newZoom, newPanX, newPanY);
    }
  }, [cells, canvasSize, setView]);

  // Draw the network
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

    // Collect all circles for smart line calculation
    const allCircles = cells.flatMap(cell => [
      { center: networkToCanvas(cell.position, canvas), radius: cell.livingRadius * sizeScale },
      ...cell.functions.map(fn => ({
        center: networkToCanvas(fn.position, canvas),
        radius: fn.radius * sizeScale
      }))
    ]);

    // Draw connections
    if (showConnections) {
      const connections = getAllConnections();
      connections.forEach(conn => {
        const fromPos = networkToCanvas(conn.from, canvas);
        const toPos = networkToCanvas(conn.to, canvas);
        const toCircles = allCircles.filter(c =>
          Math.hypot(c.center.x - toPos.x, c.center.y - toPos.y) < c.radius + 5
        );

        ctx.strokeStyle = conn.color;
        ctx.globalAlpha = conn.opacity;
        ctx.lineWidth = config.lineWidth * sizeScale;
        ctx.setLineDash(getLineDash(config.lineStyle, config.lineWidth));

        const circleList = toCircles.length > 0 ? toCircles : [];
        const smartSegments = calculateSmartLineSegments(fromPos, toPos, circleList, config.lineWidth);

        smartSegments.forEach((segment) => {
          ctx.beginPath();
          ctx.moveTo(segment.start.x, segment.start.y);
          ctx.lineTo(segment.end.x, segment.end.y);
          ctx.stroke();
        });

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });
    }

    // Draw cells
    cells.forEach(cell => {
      const center = networkToCanvas(cell.position, canvas);
      const cellRadius = cell.radius * sizeScale;
      const livingRadius = cell.livingRadius * sizeScale;

      // Cell border
      ctx.beginPath();
      ctx.arc(center.x, center.y, cellRadius, 0, Math.PI * 2);
      ctx.strokeStyle = colors.cellBorder;
      ctx.lineWidth = config.cellOutlineWidth;
      ctx.setLineDash(getLineDash(config.cellOutlineStyle, config.cellOutlineWidth));
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Living circle
      ctx.beginPath();
      ctx.arc(center.x, center.y, livingRadius, 0, Math.PI * 2);
      ctx.fillStyle = colors.living;
      ctx.fill();
      ctx.strokeStyle = colors.livingOutline;
      ctx.lineWidth = config.livingOutlineWidth;
      ctx.setLineDash(getLineDash(config.livingOutlineStyle, config.livingOutlineWidth));
      ctx.stroke();
      ctx.setLineDash([]);

      // Living text
      const livingFontSize = Math.min(config.livingFontSize * zoom * 2, config.livingFontSize * 3);
      ctx.fillStyle = colors.livingText;
      ctx.font = `bold ${livingFontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.livingLabel, center.x, center.y);
    });

    // Draw function circles
    cells.forEach(cell => {
      cell.functions.forEach(fn => {
        if (!config.functionVisible[fn.type]) return;

        const center = networkToCanvas(fn.position, canvas);
        const radius = fn.radius * sizeScale;

        // Function circle background
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.functionBackground[fn.type];
        ctx.fill();

        // Function circle border
        ctx.strokeStyle = colors.functions[fn.type];
        ctx.lineWidth = config.functionOutlineWidth;
        ctx.setLineDash(getLineDash(config.functionOutlineStyle, config.functionOutlineWidth));
        ctx.stroke();
        ctx.setLineDash([]);

        // Function text
        const fontSize = Math.min(config.functionFontSize * zoom * 2, config.functionFontSize * 3);
        ctx.fillStyle = colors.functionText[fn.type];
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(config.functionLabels[fn.type] || fn.type, center.x, center.y);
      });
    });
  }, [cells, colors, config, zoom, panX, panY, showConnections, networkToCanvas, getAllConnections]);

  // Setup canvas and animation loop
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

    const animationId = setInterval(() => {
      draw();
    }, 1000 / 60); // 60 FPS

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(animationId);
    };
  }, [draw]);

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
      </div>
    </div>
  );
}
