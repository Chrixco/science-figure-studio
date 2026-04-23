import { useRef, useEffect, useCallback, useState } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useViewState } from '../hooks/useViewState';
import { calculateSmartLineSegments, calculateBoundingBox, CANVAS_SCALE } from '../utils/geometry';
import { generateFunctionBasedLayout } from '../utils/functionBasedLayout';
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

export function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<(() => void) | null>(null);

  // Store state - all interaction-related methods
  const {
    cells, config, colors,
    isDragging, selectedCellIds,
    setSelectedCell, setSelectedCells, toggleCellSelection,
    setIsDragging, moveCell, moveSelectedCells, saveToHistory,
    undo, redo
  } = useNetworkStore();

  // View state - pan and zoom
  const { zoom, panX, panY, zoomIn, zoomOut, pan, setView } = useViewState();

  // Local UI state
  const [canvasSize, setCanvasSize] = useState(0);
  const [showConnections, setShowConnections] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Drag tracking refs
  const dragStartRef = useRef<Point | null>(null);
  const dragCellStartRef = useRef<Point | null>(null);
  const panStartRef = useRef<Point | null>(null);

  // Convert screen coordinates to network coordinates
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

  // Convert network coordinates to canvas coordinates for drawing
  const networkToCanvas = useCallback((networkPoint: Point, canvas: HTMLCanvasElement) => {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const pixelX = (networkPoint.x / CANVAS_SCALE) * width;
    const pixelY = (networkPoint.y / CANVAS_SCALE) * height;

    const canvasX = centerX + (pixelX - centerX) * zoom + panX;
    const canvasY = centerY + (pixelY - centerY) * zoom + panY;

    return { x: canvasX, y: canvasY };
  }, [zoom, panX, panY]);

  // Find cell at network position
  const findCellAtPosition = useCallback((pos: Point): string | null => {
    for (const cell of cells) {
      const dx = pos.x - cell.position.x;
      const dy = pos.y - cell.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 0.4) return cell.id; // 0.4 network units radius
    }
    return null;
  }, [cells]);

  // Initialize cell positions to grid layout on first load
  useEffect(() => {
    if (cells.length > 0 && !isInitialized) {
      const cols = Math.ceil(Math.sqrt(cells.length));
      const spacing = CANVAS_SCALE / (cols + 1);
      let needsInit = false;

      cells.forEach((cell, i) => {
        if (cell.position.x === 0 && cell.position.y === 0) {
          needsInit = true;
          const col = i % cols;
          const row = Math.floor(i / cols);
          moveCell(cell.id, {
            x: spacing * (col + 1),
            y: spacing * (row + 1)
          });
        }
      });

      if (!needsInit) {
        setIsInitialized(true);
      }
    }
  }, [cells.length, isInitialized, cells, moveCell]);

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
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

    // Draw connections from each cell to its functions (if enabled)
    if (showConnections) {
      cellNodes.forEach((livingNode) => {
        if (!livingNode.cellId) return;

        const livingPos = networkToCanvas(livingNode.position, canvas);

        // Find functions for this specific cell
        const cellFunctions = functionNodes.filter(fn => fn.id.includes(`-${livingNode.cellId}-`));

        cellFunctions.forEach((fnNode) => {
          // Check if connection should be filtered
          if (config.connectionFilter !== 'all' && config.connectionFilter !== fnNode.functionType) {
            return;
          }

          const fnPos = networkToCanvas(fnNode.position, canvas);

          // Calculate line width based on function weight
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
      const isSelected = node.cellId && selectedCellIds.includes(node.cellId);

      // Cell background - cyan highlight for selected
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#00d9ff' : colors.living;
      ctx.fill();

      // Cell border - thicker and brighter for selected
      ctx.strokeStyle = isSelected ? '#00ff88' : colors.livingOutline;
      ctx.lineWidth = isSelected ? config.livingOutlineWidth * 2 : config.livingOutlineWidth;
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

      // Debug: Draw bounding circle
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
  }, [cells, colors, config, zoom, panX, panY, showConnections, showDebug, selectedCellIds, networkToCanvas]);

  // Update draw ref
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

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
      if (drawRef.current) drawRef.current();
    }, 1000 / 60); // 60 FPS

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(animationId);
    };
  }, []);

  // Pointer down - select/drag cell or pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = screenToNetwork(e.clientX, e.clientY);
    const cellId = findCellAtPosition(pos);

    if (cellId) {
      // Clicked on cell
      if (e.shiftKey) {
        toggleCellSelection(cellId);
      } else if (!selectedCellIds.includes(cellId)) {
        setSelectedCell(cellId);
      }

      saveToHistory();
      setIsDragging(true);
      dragStartRef.current = pos;

      const cell = cells.find(c => c.id === cellId);
      dragCellStartRef.current = cell ? { ...cell.position } : null;
      canvas.setPointerCapture(e.pointerId);
    } else {
      // Clicked on empty space
      if (!e.shiftKey) setSelectedCells([]);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    }
  }, [screenToNetwork, findCellAtPosition, cells, selectedCellIds, toggleCellSelection, setSelectedCell, setSelectedCells, setIsDragging, saveToHistory]);

  // Pointer move - pan or drag cells
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning && panStartRef.current) {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      pan(deltaX, deltaY);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDragging || selectedCellIds.length === 0 || !dragStartRef.current) return;

    const pos = screenToNetwork(e.clientX, e.clientY);
    const dx = pos.x - dragStartRef.current.x;
    const dy = pos.y - dragStartRef.current.y;

    // Move all selected cells
    if (selectedCellIds.length > 1) {
      moveSelectedCells(dx, dy);
      dragStartRef.current = pos;
    } else if (dragCellStartRef.current && selectedCellIds.length === 1) {
      moveCell(selectedCellIds[0], {
        x: dragCellStartRef.current.x + dx,
        y: dragCellStartRef.current.y + dy,
      });
    }
  }, [isPanning, isDragging, selectedCellIds, screenToNetwork, moveCell, moveSelectedCells, pan]);

  // Pointer up - stop dragging/panning
  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    dragStartRef.current = null;
    dragCellStartRef.current = null;
    panStartRef.current = null;
  }, [setIsDragging]);

  // Double-click to zoom on cell
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pos = screenToNetwork(e.clientX, e.clientY);
    const cellId = findCellAtPosition(pos);

    if (cellId) {
      const cell = cells.find(c => c.id === cellId);
      if (cell) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const cellX = cell.position.x / CANVAS_SCALE * canvas.width;
        const cellY = cell.position.y / CANVAS_SCALE * canvas.height;

        const newZoom = 2.5;
        const newPanX = (centerX - cellX) * newZoom;
        const newPanY = (centerY - cellY) * newZoom;

        setView(newZoom, newPanX, newPanY);
      }
    }
  }, [screenToNetwork, findCellAtPosition, cells, setView]);

  // Wheel - zoom at cursor
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const isPinch = e.ctrlKey;
    const delta = isPinch ? -e.deltaY * 0.01 : -e.deltaY * 0.002;
    const newZoom = Math.max(0.05, Math.min(10, zoom * (1 + delta)));

    const scale = newZoom / zoom;
    const newPanX = (mouseX - cx) * (1 - scale) + scale * panX;
    const newPanY = (mouseY - cy) * (1 - scale) + scale * panY;

    setView(newZoom, newPanX, newPanY);
  }, [zoom, panX, panY, setView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        setView(0.1, 0, 0);
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
  }, [zoomIn, zoomOut, setView, setSelectedCells, undo, redo]);

  return (
    <div className="w-full h-full flex flex-col bg-canvas overflow-hidden">
      <div className="flex-1 relative" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Toolbar */}
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
          onClick={() => setView(0.1, 0, 0)}
          className="p-2 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-colors"
          title="Reset View (0)"
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
