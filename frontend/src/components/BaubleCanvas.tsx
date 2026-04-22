import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useBaubleStore } from '../hooks/useBaubleStore';
import { useCameraStore } from '../hooks/useCameraStore';
import { BaubleNode } from '../types/bauble';

const CANVAS_SCALE = 10;
const CANVAS_CENTER = CANVAS_SCALE / 2;
const WORLD_SCALE = 50; // Scale factor to convert CANVAS_SCALE to world coordinates

// Helper function to determine if a color is light or dark
const isLightColor = (hexColor: string | undefined): boolean => {
  if (!hexColor) return false; // Default to dark if no color provided
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

// Helper function to get contrasting colors based on background
const getContrastColors = (bgColor: string | undefined) => {
  const isLight = isLightColor(bgColor);
  return {
    text: isLight ? '#1a1a1a' : '#ffffff',
    edgeColor: isLight ? 0x666666 : 0x888888,
  };
};

interface NodeMesh {
  group: THREE.Group;
  circle: THREE.Mesh;
  label: THREE.Mesh | null;
  nodeId: string;
}

export function BaubleCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodeMeshesRef = useRef<Map<string, NodeMesh>>(new Map());
  const edgesRef = useRef<THREE.Group>(new THREE.Group());
  const nodesGroupRef = useRef<THREE.Group>(new THREE.Group());

  const {
    graph,
    config,
    selectedNodeId,
    setSelectedNode,
    setIsDragging,
    moveNode,
    undo,
    redo,
  } = useBaubleStore();

  const {
    zoom,
    panX,
    panY,
    pan,
    zoomByFactor,
  } = useCameraStore();

  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan'); // Default to pan mode
  const [selectionPolygon, setSelectionPolygon] = useState<Array<{ x: number; y: number }>>([]);
  const [selectedNodesInPolygon, setSelectedNodesInPolygon] = useState<Set<string>>(new Set());
  const [markedNodes, setMarkedNodes] = useState<Set<string>>(new Set()); // Persistent selection

  const dragStartRef = useRef<{ x: number; y: number; nodeId: string } | null>(null);
  const dragNodeStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMarkedNodesStartRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number; lastClickTime?: number } | null>(null);
  const isMiddleMouseRef = useRef(false);

  // Create canvas texture with text
  const createTextTexture = (text: string, color: string, fontSize: number, fontFamily: string = 'Arial'): { texture: THREE.CanvasTexture; width: number; height: number } => {
    // Use higher resolution for sharper text (2x DPI)
    const dpi = 2;
    const scaledFontSize = fontSize * dpi;

    // Temporary canvas to measure text
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.font = `bold ${scaledFontSize}px ${fontFamily}`;

    // Measure text lines
    const words = text.split(' ');
    let lines: string[] = [];
    let currentLine = '';
    const padding = scaledFontSize * 0.5; // Padding around text

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = tempCtx.measureText(testLine);
      if (metrics.width > 500 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Calculate canvas size based on actual text
    const lineHeight = scaledFontSize * 1.2;
    const maxWidth = Math.max(...lines.map((line) => tempCtx.measureText(line).width)) + padding * 2;
    const totalHeight = lines.length * lineHeight + padding * 2;

    const canvasWidth = Math.ceil(maxWidth);
    const canvasHeight = Math.ceil(totalHeight);

    // Create actual canvas with proper size
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return { texture: new THREE.CanvasTexture(canvas), width: 1, height: 1 };

    // Enable better text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Transparent background
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw text
    ctx.font = `bold ${scaledFontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let y = padding + lineHeight / 2;
    for (const line of lines) {
      ctx.fillText(line, canvasWidth / 2, y);
      y += lineHeight;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    // Return texture with calculated dimensions (in world units, roughly)
    return {
      texture,
      width: canvasWidth / 100,
      height: canvasHeight / 100,
    };
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Don't initialize if container has no dimensions
    if (width === 0 || height === 0) return;

    // Scene
    const scene = new THREE.Scene();
    const bgColor = config.backgroundColor || '#1a1a1a';
    try {
      scene.background = new THREE.Color(bgColor);
    } catch (e) {
      console.error('Invalid backgroundColor:', bgColor, e);
      scene.background = new THREE.Color('#1a1a1a');
    }
    sceneRef.current = scene;

    // Camera - orthographic for 2D-like view
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0.1,
      1000
    );
    camera.position.z = 100;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.setAttribute('data-bauble-canvas', 'true');
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Groups
    const edgesGroup = new THREE.Group();
    const nodesGroup = new THREE.Group();
    scene.add(edgesGroup);
    scene.add(nodesGroup);
    edgesRef.current = edgesGroup;
    nodesGroupRef.current = nodesGroup;

    // Handle resize
    const handleResize = () => {
      const w = containerRef.current?.clientWidth || width;
      const h = containerRef.current?.clientHeight || height;
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [config.backgroundColor]);

  // Render graph
  useEffect(() => {
    if (!sceneRef.current || !nodesGroupRef.current || !edgesRef.current) return;
    if (!graph || graph.nodes.length === 0) return; // Don't render if no nodes

    const nodesGroup = nodesGroupRef.current;
    const edgesGroup = edgesRef.current;
    const themeColor = getContrastColors(config.backgroundColor);

    // Clear previous
    nodesGroup.clear();
    edgesGroup.clear();
    nodeMeshesRef.current.clear();

    // Helper function to get node radius based on kind and multipliers
    const getNodeRadius = (node: BaubleNode): number => {
      let baseRadius: number;
      let multiplier = 1.0;

      if (node.kind === 'root') {
        baseRadius = config.rootRadius;
      } else if (node.kind === 'mother') {
        baseRadius = config.motherRadius;
        multiplier = config.motherRadiusMultiplier;
      } else if (node.kind === 'child') {
        baseRadius = config.childRadius;
        multiplier = config.childRadiusMultiplier;
      } else {
        // grandchild
        baseRadius = config.grandchildRadius;
        multiplier = config.grandchildRadiusMultiplier;
      }

      return baseRadius * multiplier;
    };

    // Draw edges first
    for (const edge of graph.edges) {
      if (edge.kind === 'root-to-mother' && !config.showRootToMotherConnections) continue;
      if (edge.kind === 'mother-to-child' && !config.showMotherToChildConnections) continue;
      if (edge.kind === 'mother-to-mother' && !config.showMotherToMotherConnections) continue;
      if (edge.kind === 'child-to-grandchild' && !config.showChildToGrandchildConnections) continue;

      const fromNode = graph.nodes.find((n) => n.id === edge.fromId);
      const toNode = graph.nodes.find((n) => n.id === edge.toId);
      if (!fromNode || !toNode) continue;

      const points = [
        new THREE.Vector3((fromNode.position.x - CANVAS_CENTER) * WORLD_SCALE, -(fromNode.position.y - CANVAS_CENTER) * WORLD_SCALE, 0),
        new THREE.Vector3((toNode.position.x - CANVAS_CENTER) * WORLD_SCALE, -(toNode.position.y - CANVAS_CENTER) * WORLD_SCALE, 0),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      let lineWidth = config.edgeWidth;
      let opacity = 0.6;

      if (edge.kind === 'mother-to-mother') {
        opacity = 0.35;
      } else if (edge.kind === 'root-to-mother') {
        opacity = 0.8;
      } else if (edge.kind === 'child-to-grandchild') {
        opacity = 0.6;
      }

      const material = new THREE.LineBasicMaterial({
        color: themeColor.edgeColor,
        linewidth: lineWidth,
        transparent: true,
        opacity: opacity,
      });

      const line = new THREE.Line(geometry, material);
      edgesGroup.add(line);
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const radius = getNodeRadius(node) * WORLD_SCALE;
      const fontSize = node.kind === 'root' ? config.rootFontSize : node.kind === 'mother' ? config.motherFontSize : node.kind === 'grandchild' ? config.grandchildFontSize : config.childFontSize;
      const fontFamily = node.kind === 'root' ? config.rootFontFamily : node.kind === 'mother' ? config.motherFontFamily : node.kind === 'grandchild' ? config.grandchildFontFamily : config.childFontFamily;

      const group = new THREE.Group();

      // Circle geometry
      const geometry = new THREE.CircleGeometry(radius, 64);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color),
        transparent: true,
        opacity: 0.9,
      });
      const circle = new THREE.Mesh(geometry, material);
      group.add(circle);

      // Stroke ring
      const ringGeometry = new THREE.BufferGeometry();
      const points = [];
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        points.push(
          new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.01)
        );
      }
      ringGeometry.setFromPoints(points);
      const ringMaterial = new THREE.LineBasicMaterial({
        color: node.kind === 'root' ? 0xffffff : node.kind === 'grandchild' ? 0xaaaaaa : 0xcccccc,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Line(ringGeometry, ringMaterial);
      group.add(ring);

      // Marked nodes highlight (persistent selection)
      if (markedNodes.has(node.id)) {
        const markedGeometry = new THREE.BufferGeometry();
        const markedPoints = [];
        const markedRadius = radius + 0.1 * WORLD_SCALE;
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          markedPoints.push(
            new THREE.Vector3(Math.cos(angle) * markedRadius, Math.sin(angle) * markedRadius, 0.015)
          );
        }
        markedGeometry.setFromPoints(markedPoints);
        const markedMaterial = new THREE.LineBasicMaterial({
          color: 0xffaa00, // Orange for marked nodes
          transparent: true,
          opacity: 1.0,
          linewidth: 3,
        });
        const marked = new THREE.Line(markedGeometry, markedMaterial);
        group.add(marked);
      }

      // Polygon selection highlight (temporary)
      if (selectedNodesInPolygon.has(node.id) && !markedNodes.has(node.id)) {
        const highlightGeometry = new THREE.BufferGeometry();
        const highlightPoints = [];
        const hlRadius = radius + 0.1 * WORLD_SCALE;
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          highlightPoints.push(
            new THREE.Vector3(Math.cos(angle) * hlRadius, Math.sin(angle) * hlRadius, 0.015)
          );
        }
        highlightGeometry.setFromPoints(highlightPoints);
        const highlightMaterial = new THREE.LineBasicMaterial({
          color: 0x64ccff, // Cyan for current selection
          transparent: true,
          opacity: 0.6,
          linewidth: 2,
        });
        const highlight = new THREE.Line(highlightGeometry, highlightMaterial);
        group.add(highlight);
      }

      // Selection ring
      if (node.id === selectedNodeId) {
        const selectionGeometry = new THREE.BufferGeometry();
        const selectionPoints = [];
        const selRadius = radius + 0.15 * WORLD_SCALE;
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          selectionPoints.push(
            new THREE.Vector3(Math.cos(angle) * selRadius, Math.sin(angle) * selRadius, 0.02)
          );
        }
        selectionGeometry.setFromPoints(selectionPoints);
        const selectionMaterial = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1.0,
          linewidth: 2,
        });
        const selection = new THREE.Line(selectionGeometry, selectionMaterial);
        group.add(selection);
      }

      // Label positioning
      let labelMesh: THREE.Mesh | null = null;
      if (config.showLabels && node.label) {
        const { texture: labelTexture, width: textWidth, height: textHeight } = createTextTexture(node.label, themeColor.text, fontSize, fontFamily);
        // Size label based on actual text dimensions
        const labelWidth = Math.max(textWidth * WORLD_SCALE, 0.3 * WORLD_SCALE);
        const labelHeight = Math.max(textHeight * WORLD_SCALE, 0.2 * WORLD_SCALE);
        const labelGeometry = new THREE.PlaneGeometry(labelWidth, labelHeight);
        const labelMaterial = new THREE.MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
        });
        labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);

        // Get text position for this node kind
        const textPosition = node.kind === 'root'
          ? config.rootTextPosition
          : node.kind === 'mother'
            ? config.motherTextPosition
            : node.kind === 'grandchild'
              ? config.grandchildTextPosition
              : config.childTextPosition;

        // Position label based on text position setting
        const padding = 0.05 * WORLD_SCALE;
        switch (textPosition) {
          case 'top':
            labelMesh.position.set(0, radius + labelHeight / 2 + padding, 0.05);
            break;
          case 'left':
            labelMesh.position.set(-radius - labelWidth / 2 - padding, 0, 0.05);
            break;
          case 'right':
            labelMesh.position.set(radius + labelWidth / 2 + padding, 0, 0.05);
            break;
          case 'bottom':
          default:
            labelMesh.position.set(0, -radius - labelHeight / 2 - padding, 0.05);
            break;
        }
        group.add(labelMesh);
      }

      // Position node
      const posX = (node.position.x - CANVAS_CENTER) * WORLD_SCALE;
      const posY = -(node.position.y - CANVAS_CENTER) * WORLD_SCALE;
      group.position.set(posX, posY, 0);
      group.userData.nodeId = node.id;

      nodesGroup.add(group);
      nodeMeshesRef.current.set(node.id, {
        group,
        circle,
        label: labelMesh,
        nodeId: node.id,
      });
    }
  }, [graph, config, selectedNodeId, selectedNodesInPolygon, markedNodes]);

  // Rendering loop - continuously update camera from global state
  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    if (!renderer || !scene || !camera) return;

    const animate = () => {
      requestAnimationFrame(animate);

      // Apply pan and zoom from global camera store
      camera.position.x = panX;
      camera.position.y = panY;
      camera.zoom = zoom;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      // Cleanup handled by renderer
    };
  }, [zoom, panX, panY]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Helper: Check if point is inside polygon using ray casting algorithm
  const isPointInPolygon = (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
    if (polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Interaction handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Middle mouse button or left click in pan mode = pan
    if (e.button === 1 || (e.button === 0 && interactionMode === 'pan')) {
      isMiddleMouseRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      console.log('🖱️ Pan/Middle mouse initiated:', { button: e.button, interactionMode, x: e.clientX, y: e.clientY });
      return;
    }

    // Only left click in select mode for node selection or polygon selection
    if (e.button !== 0 || interactionMode !== 'select') return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, cameraRef.current!);

    const intersects = raycaster.intersectObjects(nodesGroupRef.current!.children, true);

    if (intersects.length > 0) {
      let nodeId = null;
      for (const obj of intersects) {
        if (obj.object.parent?.userData.nodeId) {
          nodeId = obj.object.parent.userData.nodeId;
          break;
        }
      }

      if (nodeId) {
        setSelectedNode(nodeId);
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY, nodeId };

        const node = graph.nodes.find((n) => n.id === nodeId)!;
        dragNodeStartRef.current = { x: node.position.x, y: node.position.y };

        // If dragging a marked node, prepare to move all marked nodes together
        if (markedNodes.has(nodeId)) {
          const markedStartPositions = new Map<string, { x: number; y: number }>();
          markedNodes.forEach((mNodeId) => {
            const mNode = graph.nodes.find((n) => n.id === mNodeId);
            if (mNode) {
              markedStartPositions.set(mNodeId, { x: mNode.position.x, y: mNode.position.y });
            }
          });
          dragMarkedNodesStartRef.current = markedStartPositions;
        } else {
          dragMarkedNodesStartRef.current = null;
        }
      }
    } else {
      // Check if clicking on empty canvas - if already have marked nodes, deselect them
      if (markedNodes.size > 0) {
        // Double-click or first click on empty: deselect
        const now = Date.now();
        const lastClickTime = selectionStartRef.current?.lastClickTime || 0;
        if ((now - lastClickTime) > 300) {
          // Deselect marked nodes
          setMarkedNodes(new Set());
          setSelectionPolygon([]);
          setSelectedNodesInPolygon(new Set());
          selectionStartRef.current = { x: e.clientX, y: e.clientY, lastClickTime: now };
        } else {
          // Start new selection
          setSelectionPolygon([]);
          setSelectedNodesInPolygon(new Set());
          selectionStartRef.current = { x: e.clientX, y: e.clientY, lastClickTime: now };
        }
      } else {
        // Start polygon selection
        setSelectedNode(null);
        setSelectionPolygon([]);
        setSelectedNodesInPolygon(new Set());
        selectionStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Debug: Log unexpected pan movements
    if (isMiddleMouseRef.current && panStartRef.current) {
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;
      if (deltaX !== 0 || deltaY !== 0) {
        console.log('🎮 Pan movement detected:', { deltaX, deltaY, isMiddleMouseRef: isMiddleMouseRef.current });
      }
    }

    if (dragStartRef.current && dragNodeStartRef.current) {
      // Dragging a node
      const deltaX = (e.clientX - dragStartRef.current.x) / (WORLD_SCALE * zoom);
      const deltaY = (e.clientY - dragStartRef.current.y) / (WORLD_SCALE * zoom);

      // If dragging a marked node, move all marked nodes together
      if (dragMarkedNodesStartRef.current && dragMarkedNodesStartRef.current.size > 0) {
        dragMarkedNodesStartRef.current.forEach((startPos, nodeId) => {
          const newPos = {
            x: startPos.x + deltaX,
            y: startPos.y + deltaY,
          };
          moveNode(nodeId, newPos);
        });
      } else {
        // Single node drag
        const newPos = {
          x: dragNodeStartRef.current.x + deltaX,
          y: dragNodeStartRef.current.y + deltaY,
        };
        moveNode(dragStartRef.current.nodeId, newPos);
      }
    } else if (isMiddleMouseRef.current && panStartRef.current) {
      // Panning with middle mouse button
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      pan(deltaX, deltaY);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (selectionStartRef.current) {
      // Drawing selection polygon (rectangular)
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Helper function to convert screen coordinates to canvas space (0-10)
      const screenToCanvas = (screenX: number, screenY: number) => {
        // Convert to normalized device coordinates (-1 to 1)
        const ndcX = (screenX - rect.left) / rect.width * 2 - 1;
        const ndcY = -((screenY - rect.top) / rect.height * 2 - 1);

        // Convert to world space using camera position and zoom
        const worldX = ndcX * rect.width / (2 * WORLD_SCALE * zoom) + panX;
        const worldY = ndcY * rect.height / (2 * WORLD_SCALE * zoom) + panY;

        // Convert from world space to canvas space (0-10)
        const canvasX = worldX / WORLD_SCALE + CANVAS_CENTER;
        const canvasY = -worldY / WORLD_SCALE + CANVAS_CENTER;

        return { x: canvasX, y: canvasY };
      };

      const startPos = screenToCanvas(selectionStartRef.current.x, selectionStartRef.current.y);
      const currentPos = screenToCanvas(e.clientX, e.clientY);

      const startCanvasX = startPos.x;
      const startCanvasY = startPos.y;
      const currentCanvasX = currentPos.x;
      const currentCanvasY = currentPos.y;

      // Create rectangular selection polygon
      const polygon = [
        { x: startCanvasX, y: startCanvasY },
        { x: currentCanvasX, y: startCanvasY },
        { x: currentCanvasX, y: currentCanvasY },
        { x: startCanvasX, y: currentCanvasY },
      ];

      setSelectionPolygon(polygon);

      // Find nodes inside the polygon
      const nodesInside = new Set<string>();
      graph.nodes.forEach(node => {
        if (isPointInPolygon(node.position, polygon)) {
          nodesInside.add(node.id);
        }
      });
      setSelectedNodesInPolygon(nodesInside);
    }
  };

  const handlePointerUp = () => {
    // End middle mouse panning
    if (isMiddleMouseRef.current) {
      console.log('🖱️ Pan/Middle mouse ended, panX:', panX, 'panY:', panY);
      isMiddleMouseRef.current = false;
      panStartRef.current = null;
    }

    // End node dragging
    setIsDragging(false);
    dragStartRef.current = null;
    dragNodeStartRef.current = null;
    dragMarkedNodesStartRef.current = null;

    // Complete polygon selection
    if (selectionStartRef.current && selectionPolygon.length > 0) {
      const selectedNodeIds: string[] = [];

      graph.nodes.forEach(node => {
        if (isPointInPolygon(node.position, selectionPolygon)) {
          selectedNodeIds.push(node.id);
        }
      });

      // Mark the selected nodes permanently
      if (selectedNodeIds.length > 0) {
        setMarkedNodes(new Set(selectedNodeIds));
        setSelectedNode(selectedNodeIds[0]);
        console.log(`Selected ${selectedNodeIds.length} node(s):`, selectedNodeIds);
      }

      // Keep polygon visible briefly then clear temporary selection
      setSelectionPolygon([]);
      setSelectedNodesInPolygon(new Set());
    }

    selectionStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Scroll wheel always zooms (mouse wheel, trackpad pinch, Ctrl+scroll)
    // Negative deltaY = scroll up = zoom in (1.1x), Positive = scroll down = zoom out (0.9x)
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomByFactor(factor);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full bg-canvas-dark relative ${
        interactionMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Selection polygon and badges */}
      {(selectionPolygon.length > 0 || markedNodes.size > 0) && (
        <div className="absolute inset-0 pointer-events-none">
          {selectionPolygon.length > 0 && (
            <svg
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            >
              <polygon
                points={selectionPolygon.map(p => {
                  const width = containerRef.current?.clientWidth || 0;
                  const height = containerRef.current?.clientHeight || 0;

                  // Convert from canvas space (0-10) to world space
                  const worldX = (p.x - CANVAS_CENTER) * WORLD_SCALE;
                  const worldY = -(p.y - CANVAS_CENTER) * WORLD_SCALE;

                  // Apply orthographic camera transform to get screen coordinates
                  const screenX = (worldX - panX) * zoom + width / 2;
                  const screenY = height / 2 - (worldY - panY) * zoom;

                  return `${screenX},${screenY}`;
                }).join(' ')}
                fill="rgba(100, 150, 255, 0.1)"
                stroke="rgba(100, 150, 255, 0.5)"
                strokeWidth="2"
              />
            </svg>
          )}

          {/* Temporary selection count (during dragging) */}
          {selectionPolygon.length > 0 && selectedNodesInPolygon.size > 0 && (
            <div className="absolute top-4 left-4 bg-blue-900/80 text-cyan-300 px-3 py-2 rounded text-sm font-semibold border border-cyan-500/50">
              {selectedNodesInPolygon.size} node{selectedNodesInPolygon.size !== 1 ? 's' : ''} in selection
            </div>
          )}

          {/* Marked nodes badge (persistent) */}
          {markedNodes.size > 0 && (
            <div className="absolute top-4 left-4 bg-orange-900/90 text-orange-100 px-3 py-2 rounded text-sm font-semibold border border-orange-500">
              {markedNodes.size} node{markedNodes.size !== 1 ? 's' : ''} marked
              <button
                onClick={() => setMarkedNodes(new Set())}
                className="ml-3 text-orange-300 hover:text-orange-100 font-bold text-xs"
              >
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Interaction Mode Controls */}
      <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
        <button
          onClick={() => setInteractionMode('pan')}
          className={`px-3 py-2 rounded text-xs font-medium transition-all border ${
            interactionMode === 'pan'
              ? 'bg-accent-cyan/30 border-accent-cyan text-accent-cyan'
              : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
          }`}
          title="Pan Mode - Click and drag to move view, Scroll to pan"
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
          title="Selection Mode - Click and drag to select, drag nodes to move"
        >
          ⬜ Select
        </button>
      </div>
    </div>
  );
}
