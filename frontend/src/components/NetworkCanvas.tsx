import { useRef, useEffect, useCallback, useState } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useViewState } from '../hooks/useViewState';
import { calculateSmartLineSegments, calculateBoundingBox, CANVAS_SCALE } from '../utils/geometry';
import { Cell, Point, FunctionType, LineStyle } from '../types';

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
  const {
    cells, config, colors, isDragging, selectedCellIds,
    setSelectedCell, setSelectedCells, toggleCellSelection,
    setIsDragging, moveCell, moveSelectedCells, saveToHistory,
    undo, redo
  } = useNetworkStore();
  const { zoom, panX, panY, setZoom, zoomIn, zoomOut, pan, setView } = useViewState();

  const [isPanning, setIsPanning] = useState(false);
  const [canvasSize, setCanvasSize] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(1); // 0-1, 1 = fully drawn
  const [showConnections, setShowConnections] = useState(true);

  const dragStartRef = useRef<Point | null>(null);
  const dragCellStartRef = useRef<Point | null>(null);
  const panStartRef = useRef<Point | null>(null);
  const animationRef = useRef<number | null>(null);

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

      // External connections
      if (config.showExternalConnections) {
        cells.forEach((otherCell, otherIndex) => {
          if (cellIndex >= otherIndex) return; // Avoid duplicates

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

  // Start animation
  const startAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setShowConnections(true);
    setIsAnimating(true);
    setAnimationProgress(0);

    const startTime = performance.now();
    const duration = config.animationDuration * 1000; // Convert seconds to ms

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smoother animation
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimationProgress(easedProgress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [config.animationDuration]);

  // Stop animation
  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
    setAnimationProgress(1);
  }, []);

  // Toggle connections visibility
  const toggleConnections = useCallback(() => {
    if (showConnections) {
      setShowConnections(false);
      setAnimationProgress(0);
    } else {
      startAnimation();
    }
  }, [showConnections, startAnimation]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Fit all cells in view
  const fitAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || cells.length === 0) return;

    const bbox = calculateBoundingBox(cells);
    const canvasPixels = canvas.width;

    const scaleX = canvasPixels / (bbox.width * (canvasPixels / CANVAS_SCALE));
    const scaleY = canvasPixels / (bbox.height * (canvasPixels / CANVAS_SCALE));
    const newZoom = Math.min(scaleX, scaleY) * 0.9;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const networkCenterX = bbox.centerX * (canvas.width / CANVAS_SCALE);
    const networkCenterY = bbox.centerY * (canvas.height / CANVAS_SCALE);

    const newPanX = (centerX - networkCenterX) * newZoom;
    const newPanY = (centerY - networkCenterY) * newZoom;

    setView(newZoom, newPanX, newPanY);
  }, [cells, setView]);

  // Auto-fit on initial load
  useEffect(() => {
    if (cells.length > 0 && canvasSize > 0) {
      const timer = setTimeout(fitAll, 100);
      return () => clearTimeout(timer);
    }
  }, [canvasSize]);

  // Convert screen coords to network coords
  const screenToNetwork = useCallback((screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const canvasX = (screenX - rect.left) * (canvas.width / rect.width);
    const canvasY = (screenY - rect.top) * (canvas.height / rect.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const networkX = ((canvasX - centerX - panX) / zoom + centerX) / canvas.width * CANVAS_SCALE;
    const networkY = ((canvasY - centerY - panY) / zoom + centerY) / canvas.height * CANVAS_SCALE;

    return { x: networkX, y: networkY };
  }, [zoom, panX, panY]);

  // Convert network coords to canvas coords
  const networkToCanvas = useCallback((point: Point, canvas: HTMLCanvasElement): Point => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const pixelX = point.x / CANVAS_SCALE * canvas.width;
    const pixelY = point.y / CANVAS_SCALE * canvas.height;

    return {
      x: (pixelX - centerX) * zoom + centerX + panX,
      y: (pixelY - centerY) * zoom + centerY + panY
    };
  }, [zoom, panX, panY]);

  // Find cell at position
  const findCellAtPosition = useCallback((pos: Point): Cell | null => {
    for (const cell of cells) {
      const dx = pos.x - cell.position.x;
      const dy = pos.y - cell.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < cell.livingRadius) {
        return cell;
      }
    }
    return null;
  }, [cells]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const isPinch = e.ctrlKey;
    const delta = isPinch ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
    const newZoom = Math.max(0.05, Math.min(10, zoom * (1 + delta)));
    setZoom(newZoom);
  }, [zoom, setZoom]);

  // Double-click to zoom to cell
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const networkPos = screenToNetwork(e.clientX, e.clientY);
    const cell = findCellAtPosition(networkPos);

    if (cell) {
      // Zoom to this cell
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const cellX = cell.position.x / CANVAS_SCALE * canvas.width;
      const cellY = cell.position.y / CANVAS_SCALE * canvas.height;

      const newZoom = 2.5;
      const newPanX = (centerX - cellX) * newZoom;
      const newPanY = (centerY - cellY) * newZoom;

      setView(newZoom, newPanX, newPanY);
    }
  }, [screenToNetwork, findCellAtPosition, setView]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const networkPos = screenToNetwork(e.clientX, e.clientY);
    const cell = findCellAtPosition(networkPos);

    if (cell) {
      // Multi-select with shift key
      if (e.shiftKey) {
        toggleCellSelection(cell.id);
      } else {
        // If clicking on already selected cell (for multi-drag), keep selection
        if (!selectedCellIds.includes(cell.id)) {
          setSelectedCell(cell.id);
        }
      }

      // Save to history before dragging
      saveToHistory();

      setIsDragging(true);
      dragStartRef.current = networkPos;
      dragCellStartRef.current = { ...cell.position };
      canvas.setPointerCapture(e.pointerId);
    } else {
      // Clear selection if clicking on empty space (without shift)
      if (!e.shiftKey) {
        setSelectedCells([]);
      }
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
  }, [screenToNetwork, findCellAtPosition, setSelectedCell, setSelectedCells, toggleCellSelection, selectedCellIds, setIsDragging, saveToHistory]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      pan(dx, dy);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDragging || selectedCellIds.length === 0 || !dragStartRef.current) return;

    const networkPos = screenToNetwork(e.clientX, e.clientY);
    const dx = networkPos.x - dragStartRef.current.x;
    const dy = networkPos.y - dragStartRef.current.y;

    // Move all selected cells
    if (selectedCellIds.length > 1) {
      moveSelectedCells(dx, dy);
      dragStartRef.current = networkPos;
    } else if (dragCellStartRef.current) {
      const newPosition = {
        x: dragCellStartRef.current.x + dx,
        y: dragCellStartRef.current.y + dy
      };
      moveCell(selectedCellIds[0], newPosition);
    }
  }, [isPanning, isDragging, selectedCellIds, screenToNetwork, moveCell, moveSelectedCells, pan]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    dragStartRef.current = null;
    dragCellStartRef.current = null;
    panStartRef.current = null;
  }, [setIsDragging]);

  // Main drawing function
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

    // Draw connections with animation
    if (showConnections && !config.linesOnTop) {
      drawAnimatedConnections(ctx, canvas, allCircles, sizeScale);
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
      ctx.font = `${livingFontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.livingLabel, center.x, center.y);

      // Function circles (only draw visible ones)
      cell.functions.forEach(fn => {
        if (!config.functionVisible[fn.type]) return;

        const fnCenter = networkToCanvas(fn.position, canvas);
        const weight = config.functionWeights[fn.type] || 1.0;
        const fnRadius = fn.radius * sizeScale * weight;
        const fnColor = colors.functions[fn.type];

        ctx.beginPath();
        ctx.arc(fnCenter.x, fnCenter.y, fnRadius, 0, Math.PI * 2);
        ctx.fillStyle = colors.functionBackground[fn.type];
        ctx.fill();
        ctx.strokeStyle = fnColor;
        ctx.lineWidth = config.functionOutlineWidth;
        ctx.setLineDash(getLineDash(config.functionOutlineStyle, config.functionOutlineWidth));
        ctx.stroke();
        ctx.setLineDash([]);

        const fnFontSize = Math.min(config.functionFontSize * zoom * 2 * weight, config.functionFontSize * 3 * weight);
        ctx.fillStyle = colors.functionText[fn.type];
        ctx.font = `${fnFontSize}px system-ui, sans-serif`;
        ctx.fillText(config.functionLabels[fn.type], fnCenter.x, fnCenter.y);
      });
    });

    // Draw connections on top if configured
    if (showConnections && config.linesOnTop) {
      drawAnimatedConnections(ctx, canvas, allCircles, sizeScale);
    }

    // Draw selection indicators for all selected cells
    selectedCellIds.forEach(id => {
      const selectedCell = cells.find(c => c.id === id);
      if (selectedCell) {
        const center = networkToCanvas(selectedCell.position, canvas);
        const radius = selectedCell.livingRadius * sizeScale + 5;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw grid if enabled - covers entire visible canvas area
    if (config.showGrid) {
      const gridSize = config.gridSize * CANVAS_SCALE;
      ctx.lineWidth = 1;

      // Calculate the visible area in network coordinates
      // Get corners of the canvas in network coordinates
      const topLeft = screenToNetwork(0, 0);
      const bottomRight = screenToNetwork(width, height);

      // Extend bounds to ensure full coverage
      const minX = Math.floor(topLeft.x / config.gridSize) * config.gridSize * CANVAS_SCALE - gridSize;
      const maxX = Math.ceil(bottomRight.x / config.gridSize) * config.gridSize * CANVAS_SCALE + gridSize;
      const minY = Math.floor(topLeft.y / config.gridSize) * config.gridSize * CANVAS_SCALE - gridSize;
      const maxY = Math.ceil(bottomRight.y / config.gridSize) * config.gridSize * CANVAS_SCALE + gridSize;

      // Draw vertical lines
      let lineIndex = Math.floor(minX / gridSize);
      for (let x = minX; x <= maxX; x += gridSize) {
        const isMajor = Math.round(lineIndex) % 5 === 0;
        ctx.strokeStyle = isMajor ? colors.gridMajor : colors.grid;
        const canvasP1 = networkToCanvas({ x, y: minY }, canvas);
        const canvasP2 = networkToCanvas({ x, y: maxY }, canvas);
        ctx.beginPath();
        ctx.moveTo(canvasP1.x, canvasP1.y);
        ctx.lineTo(canvasP2.x, canvasP2.y);
        ctx.stroke();
        lineIndex++;
      }

      // Draw horizontal lines
      lineIndex = Math.floor(minY / gridSize);
      for (let y = minY; y <= maxY; y += gridSize) {
        const isMajor = Math.round(lineIndex) % 5 === 0;
        ctx.strokeStyle = isMajor ? colors.gridMajor : colors.grid;
        const canvasP1 = networkToCanvas({ x: minX, y }, canvas);
        const canvasP2 = networkToCanvas({ x: maxX, y }, canvas);
        ctx.beginPath();
        ctx.moveTo(canvasP1.x, canvasP1.y);
        ctx.lineTo(canvasP2.x, canvasP2.y);
        ctx.stroke();
        lineIndex++;
      }
    }
  }, [cells, config, colors, selectedCellIds, networkToCanvas, screenToNetwork, zoom, showConnections, animationProgress]);

  // Draw connections with animation support
  const drawAnimatedConnections = useCallback((
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    allCircles: Array<{ center: Point; radius: number }>,
    _sizeScale: number
  ) => {
    const connections = getAllConnections();
    const totalConnections = connections.length;
    const connectionsToShow = Math.floor(totalConnections * animationProgress);

    // Set line style for connections
    ctx.setLineDash(getLineDash(config.lineStyle, config.lineWidth));

    connections.slice(0, connectionsToShow).forEach((conn, index) => {
      const fromCanvas = networkToCanvas(conn.from, canvas);
      const toCanvas = networkToCanvas(conn.to, canvas);

      // Calculate how much of this specific line to draw
      const lineProgress = Math.min(1, (animationProgress * totalConnections - index));

      if (lineProgress <= 0) return;

      // Calculate line width with optional weight multiplier
      let baseWidth = config.lineWidth + (Math.random() - 0.5) * config.lineWidthJitter * 2;
      if (config.lineWidthByWeight) {
        baseWidth *= conn.weight;
      }

      if (lineProgress < 1) {
        // Partially draw the line
        const partialTo = {
          x: fromCanvas.x + (toCanvas.x - fromCanvas.x) * lineProgress,
          y: fromCanvas.y + (toCanvas.y - fromCanvas.y) * lineProgress
        };

        ctx.beginPath();
        ctx.moveTo(fromCanvas.x, fromCanvas.y);
        ctx.lineTo(partialTo.x, partialTo.y);
        ctx.strokeStyle = conn.color;
        ctx.lineWidth = baseWidth;
        ctx.globalAlpha = conn.opacity * config.lineOpacity;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // Fully draw with smart segments
        const segments = calculateSmartLineSegments(fromCanvas, toCanvas, allCircles, baseWidth);

        segments.forEach(segment => {
          // Use config opacity settings: lineOpacity for non-overlapping, lineOverlapOpacity for overlapping
          const isOverlapping = segment.opacity < 1;
          const baseOpacity = isOverlapping ? config.lineOverlapOpacity : config.lineOpacity;

          ctx.beginPath();
          ctx.moveTo(segment.start.x, segment.start.y);
          ctx.lineTo(segment.end.x, segment.end.y);
          ctx.strokeStyle = conn.color;
          ctx.lineWidth = segment.lineWidth;
          ctx.globalAlpha = baseOpacity * conn.opacity;
          ctx.lineCap = 'round';
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
    });

    ctx.setLineDash([]);
  }, [getAllConnections, networkToCanvas, animationProgress, config.lineWidth, config.lineWidthJitter, config.lineStyle, config.lineOpacity, config.lineOverlapOpacity, config.lineWidthByWeight]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const size = Math.min(container.clientWidth, container.clientHeight);
      canvas.width = size * window.devicePixelRatio;
      canvas.height = size * window.devicePixelRatio;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      setCanvasSize(size);
      draw();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Redraw when state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Keyboard shortcuts (only when not in an input field)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        fitAll();
      } else if (e.key === 'Escape') {
        setSelectedCells([]);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, fitAll, setSelectedCells, undo, redo]);

  // Listen for playAnimation events from ControlPanel
  useEffect(() => {
    const handlePlayAnimation = () => {
      startAnimation();
    };

    window.addEventListener('playAnimation', handlePlayAnimation);
    return () => window.removeEventListener('playAnimation', handlePlayAnimation);
  }, [startAnimation]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center p-4 relative">
      {/* Zoom/Pan Controls */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={zoomIn}
          className="w-10 h-10 bg-canvas-dark/80 hover:bg-canvas-light text-white rounded-lg flex items-center justify-center text-xl font-bold transition-colors backdrop-blur-sm"
          title="Zoom In (+)"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 bg-canvas-dark/80 hover:bg-canvas-light text-white rounded-lg flex items-center justify-center text-xl font-bold transition-colors backdrop-blur-sm"
          title="Zoom Out (-)"
        >
          −
        </button>
        <button
          onClick={fitAll}
          className="w-10 h-10 bg-canvas-dark/80 hover:bg-canvas-light text-white rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          title="Fit All (0)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
        <button
          onClick={() => setView(1, 0, 0)}
          className="w-10 h-10 bg-canvas-dark/80 hover:bg-canvas-light text-white rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm"
          title="Reset View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-full h-px bg-gray-600 my-1" />

        {/* Animation button */}
        <button
          onClick={isAnimating ? stopAnimation : startAnimation}
          className={`w-10 h-10 ${isAnimating ? 'bg-accent-pink' : 'bg-canvas-dark/80'} hover:bg-canvas-light text-white rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm`}
          title="Animate Connections (A)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isAnimating ? (
              <rect x="6" y="4" width="4" height="16" />
            ) : (
              <polygon points="5 3 19 12 5 21 5 3" />
            )}
          </svg>
        </button>

        {/* Toggle connections */}
        <button
          onClick={toggleConnections}
          className={`w-10 h-10 ${showConnections ? 'bg-accent-cyan' : 'bg-canvas-dark/80'} hover:bg-canvas-light text-white rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm`}
          title="Toggle Connections"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="3" />
            <circle cx="19" cy="12" r="3" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </button>
      </div>

      {/* Zoom level indicator */}
      <div className="absolute bottom-6 right-6 bg-canvas-dark/80 text-white px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </div>

      {/* Animation progress indicator */}
      {isAnimating && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-canvas-dark/80 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm flex items-center gap-3">
          <span>Animating...</span>
          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-cyan transition-all duration-100"
              style={{ width: `${animationProgress * 100}%` }}
            />
          </div>
          <span>{Math.round(animationProgress * 100)}%</span>
        </div>
      )}

      {/* Help text */}
      <div className="absolute bottom-6 left-6 bg-canvas-dark/80 text-gray-400 px-3 py-1 rounded-lg text-xs backdrop-blur-sm">
        Scroll=zoom • Drag=pan • Dbl-click=focus • Shift+click=multi-select • Ctrl+Z/Y=undo/redo
      </div>

      <canvas
        ref={canvasRef}
        className={`rounded-lg shadow-2xl ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
