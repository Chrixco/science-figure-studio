import * as THREE from 'three';
import { Cell, ColorScheme } from '../types';
import { Collision } from './collision3d';
import { LightingSystem } from './lighting3d';

/**
 * 3D Scene Management
 * Creates and manages Three.js 3D visualization of the network
 */

export type VisualState = 'normal' | 'hover' | 'selected' | 'collision';

export interface Scene3D {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  cellGroup: THREE.Group;
  connectionGroup: THREE.Group;
  collisionGroup: THREE.Group;
  materialCache: Map<string, THREE.Material>;
  geometryCache: Map<string, THREE.BufferGeometry>;
  cellMeshMap: Map<string, THREE.Mesh>; // Cell ID → living circle mesh
  lightingSystem?: LightingSystem;
}

/**
 * Visual state configuration for interactive feedback
 */
export const VISUAL_STATE_CONFIG: Record<VisualState, {
  emissive: number;
  emissiveIntensity: number;
  colorOverride?: number;
}> = {
  normal: { emissive: 0x000000, emissiveIntensity: 0 },
  hover: { emissive: 0x00ffff, emissiveIntensity: 0.3 },
  selected: { emissive: 0x00ffff, emissiveIntensity: 0.6 },
  collision: { emissive: 0xff6666, emissiveIntensity: 0.8, colorOverride: 0xff4444 }
};

/**
 * Determine the visual state for a cell based on current interaction state
 * Priority: collision > selected > hover > normal
 */
function determineVisualState(
  cellId: string,
  selectedIds: string[],
  hoveredId: string | null,
  collisionIds: Set<string>
): VisualState {
  if (collisionIds.has(cellId)) return 'collision';
  if (selectedIds.includes(cellId)) return 'selected';
  if (hoveredId === cellId) return 'hover';
  return 'normal';
}

/**
 * Update a cell's visual appearance based on its state
 */
export function updateCellVisual(
  scene3D: Scene3D,
  cellId: string,
  state: VisualState,
  colors: ColorScheme
): void {
  const mesh = scene3D.cellMeshMap.get(cellId);
  if (!mesh) return;

  const material = mesh.material as THREE.MeshPhongMaterial;
  if (!material) return;

  const config = VISUAL_STATE_CONFIG[state];

  // Apply color override if present (for collision state)
  if (config.colorOverride !== undefined) {
    material.color.setHex(config.colorOverride);
  } else if (state === 'normal') {
    // Restore original color for normal state
    material.color.copy(new THREE.Color(colors.living));
  }

  // Apply emissive settings
  material.emissive.setHex(config.emissive);
  material.emissiveIntensity = config.emissiveIntensity;
}

/**
 * Clear all visual states except those in the exceptions set
 */
export function clearAllVisualStates(
  scene3D: Scene3D,
  colors: ColorScheme,
  exceptions?: Set<string>
): void {
  for (const [cellId, mesh] of scene3D.cellMeshMap) {
    if (exceptions && exceptions.has(cellId)) continue;

    const material = mesh.material as THREE.MeshPhongMaterial;
    if (!material) continue;

    material.color.copy(new THREE.Color(colors.living));
    material.emissive.setHex(0x000000);
    material.emissiveIntensity = 0;
  }
}

/**
 * Update all cell visuals based on current interaction state
 */
export function updateAllCellVisuals(
  scene3D: Scene3D,
  cells: Cell[],
  selectedIds: string[],
  hoveredId: string | null,
  collisionIds: Set<string>,
  colors: ColorScheme
): void {
  for (const cell of cells) {
    const state = determineVisualState(cell.id, selectedIds, hoveredId, collisionIds);
    updateCellVisual(scene3D, cell.id, state, colors);
  }
}

export interface FocusOptions {
  duration?: number; // default: 1000ms
  distance?: number; // default: 5 units
}

/**
 * Smoothly animate camera to focus on a specific cell
 */
export function focusOnCell(
  scene3D: Scene3D,
  cellId: string,
  options: FocusOptions = {}
): void {
  const cell = Array.from(scene3D.cellMeshMap.entries()).find(
    ([id]) => id === cellId
  );

  if (!cell) return;

  const { duration = 1000, distance = 5 } = options;
  const mesh = cell[1];

  // Calculate target position: cell position + offset for isometric view
  const cellPosition = mesh.position.clone();
  const targetPosition = new THREE.Vector3(
    cellPosition.x + 2,
    cellPosition.y + 2,
    distance
  );

  const startPosition = scene3D.camera.position.clone();
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    scene3D.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
    scene3D.camera.lookAt(cellPosition.x, cellPosition.y, 0);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

/**
 * Create a complete 3D scene with renderer and camera
 */
export function create3DScene(
  container: HTMLDivElement,
  cells: Cell[],
  colors: ColorScheme
): Scene3D {
  // Get container dimensions
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.background);

  // Create renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('data-network-canvas-3d', 'true');
  container.appendChild(renderer.domElement);

  // Create camera with proper aspect ratio
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  // Isometric-like view: position at (5, 5, 15) looking at (5, 5, 0)
  camera.position.set(5, 5, 15);
  camera.lookAt(5, 5, 0);

  // Add lighting
  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Directional light for depth and shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  // Create material and geometry caches
  const materialCache = new Map<string, THREE.Material>();
  const geometryCache = new Map<string, THREE.BufferGeometry>();

  // Pre-cache geometries
  geometryCache.set('sphere-32', new THREE.SphereGeometry(1, 32, 32));
  geometryCache.set('sphere-16', new THREE.SphereGeometry(1, 16, 16));

  // Create groups for organization
  const cellGroup = new THREE.Group();
  cellGroup.name = 'cells';
  scene.add(cellGroup);

  const connectionGroup = new THREE.Group();
  connectionGroup.name = 'connections';
  scene.add(connectionGroup);

  const collisionGroup = new THREE.Group();
  collisionGroup.name = 'collisions';
  scene.add(collisionGroup);

  const cellMeshMap = new Map<string, THREE.Mesh>();

  // Add cells to scene
  for (const cell of cells) {
    addCell3D(
      cellGroup,
      cell,
      colors,
      materialCache,
      geometryCache,
      cellMeshMap
    );
  }

  // Add connections
  addConnections3D(connectionGroup, cells, colors, materialCache);

  return {
    scene,
    renderer,
    camera,
    cellGroup,
    connectionGroup,
    collisionGroup,
    materialCache,
    geometryCache,
    cellMeshMap
  };
}

/**
 * Add a single cell to the 3D scene
 */
function addCell3D(
  parent: THREE.Group,
  cell: Cell,
  colors: ColorScheme,
  materialCache: Map<string, THREE.Material>,
  geometryCache: Map<string, THREE.BufferGeometry>,
  cellMeshMap?: Map<string, THREE.Mesh>
): void {
  // Create cell group and position it
  const cellGroup = new THREE.Group();
  cellGroup.position.set(cell.position.x, cell.position.y, 0);
  cellGroup.userData.cellId = cell.id;

  // Living circle (center)
  const livingGeometry = geometryCache.get('sphere-32')!.clone();
  livingGeometry.scale(cell.livingRadius, cell.livingRadius, cell.livingRadius);

  const livingMaterial = getMaterial(materialCache, colors.living, 'phong');
  const livingMesh = new THREE.Mesh(livingGeometry, livingMaterial);
  livingMesh.castShadow = true;
  livingMesh.receiveShadow = true;
  livingMesh.name = 'living';
  livingMesh.userData.cellId = cell.id;
  cellGroup.add(livingMesh);

  // Store mesh reference for collision visualization
  if (cellMeshMap) {
    cellMeshMap.set(cell.id, livingMesh);
  }

  // Function circles (orbiting)
  for (const fn of cell.functions) {
    const fnGeometry = geometryCache.get('sphere-16')!.clone();
    fnGeometry.scale(fn.radius, fn.radius, fn.radius);

    const fnColor = colors.functions[fn.type];
    const fnMaterial = getMaterial(materialCache, fnColor, 'phong');
    const fnMesh = new THREE.Mesh(fnGeometry, fnMaterial);

    // Position relative to cell center
    const dx = fn.position.x - cell.position.x;
    const dy = fn.position.y - cell.position.y;
    fnMesh.position.set(dx, dy, 0);

    fnMesh.castShadow = true;
    fnMesh.receiveShadow = true;
    fnMesh.userData.functionType = fn.type;
    fnMesh.name = `function-${fn.type}`;
    cellGroup.add(fnMesh);
  }

  // Cell border (wireframe circle) - optional visual indicator
  const borderGeometry = new THREE.SphereGeometry(cell.radius, 32, 32);
  const borderMaterial = new THREE.LineBasicMaterial({
    color: colors.cellBorder,
    transparent: true,
    opacity: 0.3
  });
  const borderEdges = new THREE.EdgesGeometry(borderGeometry);
  const borderLine = new THREE.LineSegments(borderEdges, borderMaterial);
  borderLine.name = 'border';
  cellGroup.add(borderLine);

  parent.add(cellGroup);
}

/**
 * Add connections (lines) between cells and functions
 */
function addConnections3D(
  parent: THREE.Group,
  cells: Cell[],
  colors: ColorScheme,
  materialCache: Map<string, THREE.Material>
): void {
  // Internal connections: living → functions (within each cell)
  for (const cell of cells) {
    for (const fn of cell.functions) {
      const points = [
        new THREE.Vector3(cell.position.x, cell.position.y, 0),
        new THREE.Vector3(fn.position.x, fn.position.y, 0)
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = getMaterial(
        materialCache,
        colors.functions[fn.type],
        'line',
        1.0
      );
      const line = new THREE.Line(geometry, material);
      line.name = `connection-internal-${fn.type}`;
      parent.add(line);
    }
  }

  // External connections: function → function (between cells)
  for (let i = 0; i < cells.length; i++) {
    const cellA = cells[i];

    for (const fnA of cellA.functions) {
      // Connect to other cells' functions
      for (let j = i + 1; j < cells.length; j++) {
        const cellB = cells[j];

        const points = [
          new THREE.Vector3(fnA.position.x, fnA.position.y, 0),
          new THREE.Vector3(cellB.position.x, cellB.position.y, 0)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = getMaterial(
          materialCache,
          colors.functions[fnA.type],
          'line',
          0.3
        );
        const line = new THREE.Line(geometry, material);
        line.name = `connection-external-${fnA.type}`;
        parent.add(line);
      }
    }
  }
}

/**
 * Get or create a material from cache
 */
function getMaterial(
  cache: Map<string, THREE.Material>,
  color: string | number,
  type: 'phong' | 'line',
  opacity: number = 1.0
): THREE.Material {
  const colorHex = typeof color === 'string' ? color : `#${color.toString(16)}`;
  const cacheKey = `${type}-${colorHex}-${opacity}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  let material: THREE.Material;

  if (type === 'phong') {
    material = new THREE.MeshPhongMaterial({
      color: colorHex,
      shininess: 100
    });
  } else {
    material = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: opacity < 1,
      opacity
    });
  }

  cache.set(cacheKey, material);
  return material;
}

/**
 * Update the 3D scene when cells or colors change
 */
export function updateScene3D(
  scene3D: Scene3D,
  cells: Cell[],
  colors: ColorScheme
): void {
  // Clear existing geometry
  scene3D.cellGroup.clear();
  scene3D.connectionGroup.clear();
  scene3D.cellMeshMap.clear();

  // Rebuild scene
  for (const cell of cells) {
    addCell3D(
      scene3D.cellGroup,
      cell,
      colors,
      scene3D.materialCache,
      scene3D.geometryCache,
      scene3D.cellMeshMap
    );
  }

  // Rebuild connections
  addConnections3D(scene3D.connectionGroup, cells, colors, scene3D.materialCache);
}

/**
 * Resize the 3D scene to fit container
 */
export function resize3DScene(
  scene3D: Scene3D,
  container: HTMLDivElement
): void {
  const width = container.clientWidth;
  const height = container.clientHeight;

  scene3D.camera.aspect = width / height;
  scene3D.camera.updateProjectionMatrix();

  scene3D.renderer.setSize(width, height);
}

/**
 * Render the 3D scene
 */
export function render3D(scene3D: Scene3D): void {
  scene3D.renderer.render(scene3D.scene, scene3D.camera);
}

/**
 * Dispose of all Three.js resources
 */
export function dispose3D(scene3D: Scene3D): void {
  // Dispose of geometries
  scene3D.geometryCache.forEach((geometry) => {
    geometry.dispose();
  });

  // Dispose of materials
  scene3D.materialCache.forEach((material) => {
    material.dispose();
  });

  // Clear scene
  scene3D.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => mat.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Dispose of renderer
  scene3D.renderer.dispose();
  scene3D.renderer.domElement.remove();
}

/**
 * Visualize collisions by marking overlapping cells
 */
export function visualizeCollisions(
  scene3D: Scene3D,
  collisions: Collision[],
  colors: ColorScheme
): void {
  // Clear collision group
  scene3D.collisionGroup.clear();

  // Build set of overlapping cell IDs
  const overlappingCellIds = new Set<string>();
  collisions.forEach(c => {
    overlappingCellIds.add(c.cell1Id);
    overlappingCellIds.add(c.cell2Id);
  });

  // Update living mesh colors using visual state system
  for (const [cellId] of scene3D.cellMeshMap.entries()) {
    if (overlappingCellIds.has(cellId)) {
      updateCellVisual(scene3D, cellId, 'collision', colors);
    } else {
      updateCellVisual(scene3D, cellId, 'normal', colors);
    }
  }
}

/**
 * Clear collision visualization
 */
export function clearCollisionVisualization(scene3D: Scene3D, colors: ColorScheme): void {
  for (const mesh of scene3D.cellMeshMap.values()) {
    const material = mesh.material as THREE.MeshPhongMaterial;
    material.color.copy(new THREE.Color(colors.living));
    material.emissive.setHex(0x000000);
    material.emissiveIntensity = 0;
  }
  scene3D.collisionGroup.clear();
}

/**
 * Reset camera to default isometric view
 */
export function resetCamera3D(scene3D: Scene3D, duration: number = 1000): void {
  const targetPosition = new THREE.Vector3(5, 5, 15);
  const startPosition = scene3D.camera.position.clone();

  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    scene3D.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}
