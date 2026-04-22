import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useCameraStore } from '../hooks/useCameraStore';
import { generateCellularGraph } from '../utils/cellularGraphGeneration';

const CANVAS_SCALE = 10;
const WORLD_SCALE = 50;

// Helper function to determine if a color is light or dark
const isLightColor = (hexColor: string | undefined): boolean => {
  if (!hexColor) return false;
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

interface NodeMesh {
  group: THREE.Group;
  circle: THREE.Mesh;
  label: THREE.Mesh | null;
  nodeId: string;
}

export function CellularCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodeMeshesRef = useRef<Map<string, NodeMesh>>(new Map());
  const edgesRef = useRef<THREE.Group>(new THREE.Group());
  const nodesGroupRef = useRef<THREE.Group>(new THREE.Group());

  const { cells, config, colors } = useNetworkStore();
  const { zoom, panX, panY, pan, zoomByFactor } = useCameraStore();

  const [interactionMode, setInteractionMode] = useState<'pan' | 'select'>('pan');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const isMiddleMouseRef = useRef(false);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // Create canvas texture with text
  const createTextTexture = (text: string, color: string, fontSize: number, fontFamily: string = 'Arial'): { texture: THREE.CanvasTexture; width: number; height: number } => {
    const dpi = 2;
    const scaledFontSize = fontSize * dpi;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.font = `bold ${scaledFontSize}px ${fontFamily}`;

    const words = text.split(' ');
    let lines: string[] = [];
    let currentLine = '';
    const padding = scaledFontSize * 0.5;

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

    const lineHeight = scaledFontSize * 1.2;
    const maxWidth = Math.max(...lines.map((line) => tempCtx.measureText(line).width)) + padding * 2;
    const totalHeight = lines.length * lineHeight + padding * 2;

    const canvasWidth = Math.ceil(maxWidth);
    const canvasHeight = Math.ceil(totalHeight);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return { texture: new THREE.CanvasTexture(canvas), width: 1, height: 1 };

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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
    dimensionsRef.current = { width, height };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(
      -width / (WORLD_SCALE * 2),
      width / (WORLD_SCALE * 2),
      height / (WORLD_SCALE * 2),
      -height / (WORLD_SCALE * 2),
      0.1,
      10000
    );
    camera.position.z = 100;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    nodesGroupRef.current = new THREE.Group();
    edgesRef.current = new THREE.Group();
    scene.add(edgesRef.current);
    scene.add(nodesGroupRef.current);

    const handleResize = () => {
      const newWidth = containerRef.current?.clientWidth || width;
      const newHeight = containerRef.current?.clientHeight || height;
      dimensionsRef.current = { width: newWidth, height: newHeight };
      camera.left = -newWidth / (WORLD_SCALE * 2);
      camera.right = newWidth / (WORLD_SCALE * 2);
      camera.top = newHeight / (WORLD_SCALE * 2);
      camera.bottom = -newHeight / (WORLD_SCALE * 2);
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      const { width: currentWidth, height: currentHeight } = dimensionsRef.current;
      camera.position.x = -panX * (currentWidth / (WORLD_SCALE * 2));
      camera.position.y = panY * (currentHeight / (WORLD_SCALE * 2));
      const zoomScale = 1 / zoom;
      camera.left = (-currentWidth / (WORLD_SCALE * 2)) * zoomScale;
      camera.right = (currentWidth / (WORLD_SCALE * 2)) * zoomScale;
      camera.top = (currentHeight / (WORLD_SCALE * 2)) * zoomScale;
      camera.bottom = (-currentHeight / (WORLD_SCALE * 2)) * zoomScale;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // Generate and render cellular graph
  useEffect(() => {
    if (!sceneRef.current || !nodesGroupRef.current || !edgesRef.current) return;

    // Clear existing nodes and edges
    nodesGroupRef.current.clear();
    edgesRef.current.clear();
    nodeMeshesRef.current.clear();

    // Generate cellular graph
    const graph = generateCellularGraph(cells, config, colors);

    // Simple circular layout for nodes
    const nodePositions = new Map<string, { x: number; y: number }>();
    const nodesByKind = {
      root: graph.nodes.filter((n) => n.kind === 'root'),
      mother: graph.nodes.filter((n) => n.kind === 'mother'),
      child: graph.nodes.filter((n) => n.kind === 'child'),
    };

    // Root at center
    if (nodesByKind.root.length > 0) {
      nodePositions.set(nodesByKind.root[0].id, { x: CANVAS_SCALE / 2, y: CANVAS_SCALE / 2 });
    }

    // Mothers in a circle around root
    const motherCount = nodesByKind.mother.length;
    nodesByKind.mother.forEach((node, i) => {
      const angle = (i / motherCount) * Math.PI * 2;
      const radius = 2.5;
      const x = CANVAS_SCALE / 2 + radius * Math.cos(angle);
      const y = CANVAS_SCALE / 2 + radius * Math.sin(angle);
      nodePositions.set(node.id, { x, y });
    });

    // Children around their mothers
    const childrenByMother = new Map<string, string[]>();
    graph.edges.forEach((edge) => {
      if (edge.kind === 'mother-to-child') {
        if (!childrenByMother.has(edge.fromId)) {
          childrenByMother.set(edge.fromId, []);
        }
        childrenByMother.get(edge.fromId)!.push(edge.toId);
      }
    });

    nodesByKind.child.forEach((node) => {
      // Find parent mother
      let parentX = CANVAS_SCALE / 2;
      let parentY = CANVAS_SCALE / 2;

      graph.edges.forEach((edge) => {
        if (edge.kind === 'mother-to-child' && edge.toId === node.id) {
          const parentPos = nodePositions.get(edge.fromId);
          if (parentPos) {
            parentX = parentPos.x;
            parentY = parentPos.y;
          }
        }
      });

      const childCount = childrenByMother.get(graph.edges.find((e) => e.toId === node.id)?.fromId || '') || [];
      const childIndex = childCount.indexOf(node.id);
      const angle = (childIndex / Math.max(childCount.length, 1)) * Math.PI * 2;
      const radius = 1.2;

      nodePositions.set(node.id, {
        x: parentX + radius * Math.cos(angle),
        y: parentY + radius * Math.sin(angle),
      });
    });

    // Render edges
    graph.edges.forEach((edge) => {
      const fromPos = nodePositions.get(edge.fromId);
      const toPos = nodePositions.get(edge.toId);

      if (fromPos && toPos) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array([fromPos.x, fromPos.y, 0, toPos.x, toPos.y, 0]), 3)
        );
        const material = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 1 });
        const line = new THREE.Line(geometry, material);
        edgesRef.current!.add(line);
      }
    });

    // Render nodes
    graph.nodes.forEach((node) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const group = new THREE.Group();
      group.position.set(pos.x, pos.y, 0);

      // Circle
      const geometry = new THREE.CircleGeometry(node.radius, 32);
      const material = new THREE.MeshBasicMaterial({ color: node.color });
      const circle = new THREE.Mesh(geometry, material);
      circle.position.z = 1;
      group.add(circle);

      // Selection ring
      if (selectedNodeId === node.id) {
        const ringGeometry = new THREE.CircleGeometry(node.radius, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          side: THREE.BackSide,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.z = 0.5;
        group.add(ring);
      }

      // Label
      const textTexture = createTextTexture(node.label, isLightColor(node.color) ? '#000000' : '#ffffff', 0.4);
      const labelGeometry = new THREE.PlaneGeometry(textTexture.width, textTexture.height);
      const labelMaterial = new THREE.MeshBasicMaterial({ map: textTexture.texture, transparent: true });
      const label = new THREE.Mesh(labelGeometry, labelMaterial);
      label.position.z = 2;
      group.add(label);

      nodesGroupRef.current!.add(group);
      nodeMeshesRef.current.set(node.id, { group, circle, label, nodeId: node.id });
    });
  }, [cells, config, colors]);

  // Mouse interactions
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button or left click in pan mode = pan
      if (e.button === 1 || (e.button === 0 && interactionMode === 'pan')) {
        isMiddleMouseRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Only left click in select mode for node selection
      if (interactionMode === 'select' && e.button === 0) {
        setSelectedNodeId(null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isMiddleMouseRef.current && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        pan(dx * 0.01, dy * 0.01);
        panStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isMiddleMouseRef.current = false;
      panStartRef.current = null;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      zoomByFactor(factor);
    };

    containerRef.current.addEventListener('mousedown', handleMouseDown);
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('mouseup', handleMouseUp);
    containerRef.current.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      containerRef.current?.removeEventListener('mousedown', handleMouseDown);
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('mouseup', handleMouseUp);
      containerRef.current?.removeEventListener('wheel', handleWheel);
    };
  }, [interactionMode, pan, zoomByFactor]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      <div className="flex-1 relative" ref={containerRef} />
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-gray-800 bg-gray-900/70 hover:bg-gray-900 transition-colors flex gap-1.5">
        <button
          onClick={() => setInteractionMode('pan')}
          className={`p-2 rounded transition-colors ${
            interactionMode === 'pan'
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
          }`}
          title="Pan Mode (middle-click drag)"
        >
          🖐️
        </button>
        <button
          onClick={() => setInteractionMode('select')}
          className={`p-2 rounded transition-colors ${
            interactionMode === 'select'
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
          }`}
          title="Select Mode"
        >
          ⬜
        </button>
      </div>
    </div>
  );
}
