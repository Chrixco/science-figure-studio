import { Point } from '../types/index';
import { BaubleNode, BaubleEdge, BaubleGraph, LoadedBaubleFile, BaubleConfig } from '../types/bauble';

const CANVAS_SCALE = 10;
const CANVAS_CENTER = CANVAS_SCALE / 2; // 5

/**
 * Random layout — place nodes randomly within canvas bounds
 */
export function randomLayout(nodes: BaubleNode[]): void {
  const padding = 0.5;
  const minX = padding;
  const maxX = CANVAS_SCALE - padding;
  const minY = padding;
  const maxY = CANVAS_SCALE - padding;

  nodes.forEach((node) => {
    node.position = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
  });
}

/**
 * CirclePack layout — place nodes in concentric circles based on hierarchy
 */
export function circlePackLayout(nodes: BaubleNode[], edges: BaubleEdge[], config: BaubleConfig): void {
  const centerX = CANVAS_CENTER;
  const centerY = CANVAS_CENTER;
  const scale = config.circlePackScale;

  // Group nodes by kind and their parent relationships
  const rootNode = nodes.find((n) => n.kind === 'root');
  const motherNodes = nodes.filter((n) => n.kind === 'mother');
  const childNodes = nodes.filter((n) => n.kind === 'child');
  const grandchildNodes = nodes.filter((n) => n.kind === 'grandchild');

  // Root at center
  if (rootNode) {
    rootNode.position = { x: centerX, y: centerY };
  }

  // Mothers in first ring
  const motherRadius = config.motherOrbitRadius * scale;
  motherNodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / motherNodes.length - Math.PI / 2;
    node.position = {
      x: centerX + motherRadius * Math.cos(angle),
      y: centerY + motherRadius * Math.sin(angle),
    };
  });

  // Children around their mothers (second ring)
  const childRadius = config.childOrbitRadius * scale;
  childNodes.forEach((node) => {
    const parentEdge = edges.find((e) => e.toId === node.id);
    const motherNode = parentEdge ? nodes.find((n) => n.id === parentEdge.fromId) : null;

    if (motherNode) {
      const siblingsCount = childNodes.filter((c) =>
        edges.some((e) => e.fromId === motherNode.id && e.toId === c.id)
      ).length;
      const siblingIndex = childNodes
        .filter((c) =>
          edges.some((e) => e.fromId === motherNode.id && e.toId === c.id)
        )
        .indexOf(node);

      const angle = (2 * Math.PI * siblingIndex) / Math.max(1, siblingsCount) - Math.PI / 2;
      node.position = {
        x: motherNode.position.x + childRadius * Math.cos(angle),
        y: motherNode.position.y + childRadius * Math.sin(angle),
      };
    }
  });

  // Grandchildren around their children (third ring)
  const grandchildRadius = config.grandchildOrbitRadius * scale;
  grandchildNodes.forEach((node) => {
    const parentEdge = edges.find((e) => e.toId === node.id);
    const childNode = parentEdge ? nodes.find((n) => n.id === parentEdge.fromId) : null;

    if (childNode) {
      const siblingsCount = grandchildNodes.filter((g) =>
        edges.some((e) => e.fromId === childNode.id && e.toId === g.id)
      ).length;
      const siblingIndex = grandchildNodes
        .filter((g) =>
          edges.some((e) => e.fromId === childNode.id && e.toId === g.id)
        )
        .indexOf(node);

      const angle = (2 * Math.PI * siblingIndex) / Math.max(1, siblingsCount) - Math.PI / 2;
      node.position = {
        x: childNode.position.x + grandchildRadius * Math.cos(angle),
        y: childNode.position.y + grandchildRadius * Math.sin(angle),
      };
    }
  });
}

/**
 * Force-directed layout using spring/repulsion simulation
 * Uses Gephi-style parameters
 */
export function forceDirectedLayout(
  nodes: BaubleNode[],
  edges: BaubleEdge[],
  config: BaubleConfig
): void {
  const attraction = config.forceDirectedAttraction;
  const repulsion = config.forceDirectedRepulsion;
  const gravity = config.forceDirectedGravity;
  const inertia = config.forceDirectedInertia;
  const maxMove = config.forceDirectedMaxMove / 1000; // Normalize to canvas scale

  // Initialize velocities
  const velocities = nodes.map(() => ({ x: 0, y: 0 }));
  const iterations = 50;

  for (let iter = 0; iter < iterations; iter++) {
    // Reset forces
    const forces = nodes.map(() => ({ x: 0, y: 0 }));

    // Repulsive forces between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].position.x - nodes[i].position.x;
        const dy = nodes[j].position.y - nodes[i].position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

        const force = (repulsion / (dist * dist)) * 10;
        forces[i].x -= (force * dx) / dist;
        forces[i].y -= (force * dy) / dist;
        forces[j].x += (force * dx) / dist;
        forces[j].y += (force * dy) / dist;
      }
    }

    // Attractive forces along edges
    edges.forEach((edge) => {
      const fromIdx = nodes.findIndex((n) => n.id === edge.fromId);
      const toIdx = nodes.findIndex((n) => n.id === edge.toId);

      if (fromIdx >= 0 && toIdx >= 0) {
        const dx = nodes[toIdx].position.x - nodes[fromIdx].position.x;
        const dy = nodes[toIdx].position.y - nodes[fromIdx].position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const force = attraction * dist;

        forces[fromIdx].x += (force * dx) / dist;
        forces[fromIdx].y += (force * dy) / dist;
        forces[toIdx].x -= (force * dx) / dist;
        forces[toIdx].y -= (force * dy) / dist;
      }
    });

    // Gravity toward center
    const centerX = CANVAS_CENTER;
    const centerY = CANVAS_CENTER;
    nodes.forEach((node, i) => {
      const dx = centerX - node.position.x;
      const dy = centerY - node.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = gravity * dist;
      forces[i].x += (force * dx) / dist;
      forces[i].y += (force * dy) / dist;
    });

    // Update positions with inertia
    nodes.forEach((node, i) => {
      velocities[i].x = velocities[i].x * inertia + forces[i].x;
      velocities[i].y = velocities[i].y * inertia + forces[i].y;

      const moveLen = Math.sqrt(velocities[i].x ** 2 + velocities[i].y ** 2);
      const limitedMove = Math.min(moveLen, maxMove);
      if (moveLen > 0) {
        velocities[i].x = (velocities[i].x / moveLen) * limitedMove;
        velocities[i].y = (velocities[i].y / moveLen) * limitedMove;
      }

      node.position.x += velocities[i].x;
      node.position.y += velocities[i].y;

      // Keep nodes within bounds
      node.position.x = Math.max(0.5, Math.min(CANVAS_SCALE - 0.5, node.position.x));
      node.position.y = Math.max(0.5, Math.min(CANVAS_SCALE - 0.5, node.position.y));
    });
  }
}

/**
 * Radial Hierarchy (Diamond) layout - arrange nodes in expanding diamond/radial pattern
 */
export function radialHierarchyLayout(nodes: BaubleNode[], edges: BaubleEdge[], config: BaubleConfig): void {
  const centerX = CANVAS_CENTER;
  const centerY = CANVAS_CENTER;
  const baseRadius = config.radialHierarchyRadius;
  const angularSpread = config.radialHierarchyAngularSpread * (Math.PI / 180); // Convert to radians
  const levelExpansion = config.radialHierarchyLevelExpansion;

  // Find nodes by hierarchy level
  const rootNodes = nodes.filter(n => n.kind === 'root');
  const motherNodes = nodes.filter(n => n.kind === 'mother');
  const childNodes = nodes.filter(n => n.kind === 'child');
  const grandchildNodes = nodes.filter(n => n.kind === 'grandchild');

  // Level 0: Root node at center
  if (rootNodes.length > 0) {
    rootNodes.forEach(node => {
      node.position = { x: centerX, y: centerY };
    });
  }

  // Level 1: Mother nodes in first ring
  if (motherNodes.length > 0) {
    const radius = baseRadius;
    const angleStep = (2 * Math.PI) / motherNodes.length;
    const startAngle = -Math.PI / 2; // Start at top

    motherNodes.forEach((node, i) => {
      const angle = startAngle + i * angleStep;
      node.position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  }

  // Level 2: Child nodes in second ring (spread around their mothers)
  if (childNodes.length > 0) {
    const radius = baseRadius * levelExpansion;
    const childrenByMother = new Map<string, BaubleNode[]>();

    // Group children by mother
    childNodes.forEach(childNode => {
      const edge = edges.find(e => e.toId === childNode.id && e.kind === 'mother-to-child');
      const motherId = edge?.fromId;
      if (motherId) {
        if (!childrenByMother.has(motherId)) {
          childrenByMother.set(motherId, []);
        }
        childrenByMother.get(motherId)!.push(childNode);
      }
    });

    // Position children around their mothers
    motherNodes.forEach((mother, motherIdx) => {
      const children = childrenByMother.get(mother.id) || [];
      if (children.length > 0) {
        const motherAngle = (-Math.PI / 2) + (2 * Math.PI * motherIdx) / motherNodes.length;
        const childAngleSpread = angularSpread;
        const childAngleStep = childAngleSpread / Math.max(1, children.length - 1);

        children.forEach((child, childIdx) => {
          const angleOffset = (childIdx - (children.length - 1) / 2) * childAngleStep;
          const angle = motherAngle + angleOffset;

          child.position = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          };
        });
      }
    });
  }

  // Level 3: Grandchild nodes in third ring
  if (grandchildNodes.length > 0) {
    const radius = baseRadius * levelExpansion * levelExpansion;
    const grandchildrenByChild = new Map<string, BaubleNode[]>();

    grandchildNodes.forEach(gcNode => {
      const edge = edges.find(e => e.toId === gcNode.id && e.kind === 'child-to-grandchild');
      const childId = edge?.fromId;
      if (childId) {
        if (!grandchildrenByChild.has(childId)) {
          grandchildrenByChild.set(childId, []);
        }
        grandchildrenByChild.get(childId)!.push(gcNode);
      }
    });

    // Position grandchildren around their children
    childNodes.forEach((child) => {
      const grandchildren = grandchildrenByChild.get(child.id) || [];
      if (grandchildren.length > 0) {
        // Calculate child's angle
        const childAngle = Math.atan2(child.position.y - centerY, child.position.x - centerX);
        const gcAngleSpread = angularSpread * 0.6;
        const gcAngleStep = gcAngleSpread / Math.max(1, grandchildren.length - 1);

        grandchildren.forEach((gc, gcIdx) => {
          const angleOffset = (gcIdx - (grandchildren.length - 1) / 2) * gcAngleStep;
          const angle = childAngle + angleOffset;

          gc.position = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          };
        });
      }
    });
  }

  // Keep all nodes within bounds
  nodes.forEach(node => {
    node.position.x = Math.max(node.radius, Math.min(CANVAS_SCALE - node.radius, node.position.x));
    node.position.y = Math.max(node.radius, Math.min(CANVAS_SCALE - node.radius, node.position.y));
  });
}

/**
 * Hierarchy (Triangular/Tree) layout - arrange nodes in hierarchical levels
 */
export function hierarchyLayout(nodes: BaubleNode[], edges: BaubleEdge[], config: BaubleConfig): void {
  const verticalSpacing = config.hierarchyVerticalSpacing;
  const horizontalSpacing = config.hierarchyHorizontalSpacing;
  const nodeSpacing = config.hierarchyNodeSpacing;

  // Find all nodes by hierarchy level
  const rootNodes = nodes.filter(n => n.kind === 'root');
  const motherNodes = nodes.filter(n => n.kind === 'mother');
  const childNodes = nodes.filter(n => n.kind === 'child');
  const grandchildNodes = nodes.filter(n => n.kind === 'grandchild');

  // Calculate positions starting from top
  let currentY = 0.5;
  const centerX = CANVAS_CENTER;

  // Level 0: Root node
  if (rootNodes.length > 0) {
    rootNodes.forEach(node => {
      node.position = { x: centerX, y: currentY };
    });
    currentY += verticalSpacing;
  }

  // Level 1: Mother nodes (spread horizontally)
  if (motherNodes.length > 0) {
    const totalWidth = (motherNodes.length - 1) * horizontalSpacing;
    const startX = centerX - totalWidth / 2;

    motherNodes.forEach((node, i) => {
      node.position = {
        x: startX + i * horizontalSpacing,
        y: currentY,
      };
    });
    currentY += verticalSpacing;
  }

  // Level 2: Child nodes (clustered under mothers)
  if (childNodes.length > 0) {
    const childrenByMother = new Map<string, BaubleNode[]>();

    // Group children by their mother
    childNodes.forEach(childNode => {
      const edge = edges.find(e => e.toId === childNode.id && e.kind === 'mother-to-child');
      const motherId = edge?.fromId;
      if (motherId) {
        if (!childrenByMother.has(motherId)) {
          childrenByMother.set(motherId, []);
        }
        childrenByMother.get(motherId)!.push(childNode);
      }
    });

    // Position children under their mothers
    motherNodes.forEach(mother => {
      const children = childrenByMother.get(mother.id) || [];
      if (children.length > 0) {
        const childWidth = (children.length - 1) * (horizontalSpacing * nodeSpacing);
        const childStartX = mother.position.x - childWidth / 2;

        children.forEach((child, i) => {
          child.position = {
            x: childStartX + i * (horizontalSpacing * nodeSpacing),
            y: currentY,
          };
        });
      }
    });

    if (childrenByMother.size > 0) {
      currentY += verticalSpacing;
    }
  }

  // Level 3: Grandchild nodes (clustered under children)
  if (grandchildNodes.length > 0) {
    const grandchildrenByChild = new Map<string, BaubleNode[]>();

    grandchildNodes.forEach(gcNode => {
      const edge = edges.find(e => e.toId === gcNode.id && e.kind === 'child-to-grandchild');
      const childId = edge?.fromId;
      if (childId) {
        if (!grandchildrenByChild.has(childId)) {
          grandchildrenByChild.set(childId, []);
        }
        grandchildrenByChild.get(childId)!.push(gcNode);
      }
    });

    childNodes.forEach(child => {
      const grandchildren = grandchildrenByChild.get(child.id) || [];
      if (grandchildren.length > 0) {
        const gcWidth = (grandchildren.length - 1) * (horizontalSpacing * nodeSpacing * 0.6);
        const gcStartX = child.position.x - gcWidth / 2;

        grandchildren.forEach((gc, i) => {
          gc.position = {
            x: gcStartX + i * (horizontalSpacing * nodeSpacing * 0.6),
            y: currentY,
          };
        });
      }
    });
  }

  // Keep all nodes within bounds
  nodes.forEach(node => {
    node.position.x = Math.max(node.radius, Math.min(CANVAS_SCALE - node.radius, node.position.x));
    node.position.y = Math.max(node.radius, Math.min(CANVAS_SCALE - node.radius, node.position.y));
  });
}

/**
 * Noverlap layout - anti-collision layout algorithm
 */
export function noverlabLayout(nodes: BaubleNode[], config: BaubleConfig): void {
  const gridSize = config.noverlabGridSize;
  const margin = config.noverlabMargin / 100; // Normalize
  const expansion = config.noverlabExpansion;
  const speed = config.noverlabSpeed / 100;

  // Grid-based collision detection and resolution
  for (let iteration = 0; iteration < 10; iteration++) {
    // Create grid for spatial hashing
    const cellSize = CANVAS_SCALE / gridSize;
    const grid = new Map<string, BaubleNode[]>();

    nodes.forEach((node) => {
      const cellX = Math.floor(node.position.x / cellSize);
      const cellY = Math.floor(node.position.y / cellSize);
      const key = `${cellX},${cellY}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(node);
    });

    // Check collisions and separate overlapping nodes
    nodes.forEach((node) => {
      const cellX = Math.floor(node.position.x / cellSize);
      const cellY = Math.floor(node.position.y / cellSize);

      // Check neighboring cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cellX + dx},${cellY + dy}`;
          const neighbors = grid.get(key) || [];

          neighbors.forEach((other) => {
            if (node === other) return;

            const diffX = node.position.x - other.position.x;
            const diffY = node.position.y - other.position.y;
            const dist = Math.sqrt(diffX * diffX + diffY * diffY);
            const minDist = (node.radius + other.radius) * expansion + margin;

            if (dist < minDist && dist > 0) {
              const pushDist = (minDist - dist) / 2;
              const angle = Math.atan2(diffY, diffX);
              node.position.x += Math.cos(angle) * pushDist * speed;
              node.position.y += Math.sin(angle) * pushDist * speed;
            }
          });
        }
      }

      // Keep within bounds
      node.position.x = Math.max(node.radius, Math.min(CANVAS_SCALE - node.radius, node.position.x));
      node.position.y = Math.max(node.radius, Math.min(CANVAS_SCALE - node.radius, node.position.y));
    });
  }
}

/**
 * Scale child radius down if a mother has many children to prevent overlap.
 * Formula: if childCount > threshold, shrink radius proportionally.
 * Also applies the childRadiusMultiplier from config.
 */
export function scaledChildRadius(childCount: number, config: BaubleConfig): number {
  if (childCount === 0) return 0;

  const baseRadius = config.childRadius * config.childRadiusMultiplier;
  const MIN_RADIUS = 0.05;

  // If child orbit radius and child radius would cause overlap with ~10+ children
  // shrink the child radius
  const threshold = 8;
  if (childCount <= threshold) {
    return baseRadius;
  }

  // Scale down as count increases beyond threshold
  const scaleFactor = Math.max(0.5, 1 - (childCount - threshold) * 0.03);
  return Math.max(MIN_RADIUS, baseRadius * scaleFactor);
}

/**
 * Circular layout - place all nodes in a single circle around the canvas
 */
export function circularLayout(nodes: BaubleNode[], config: BaubleConfig): void {
  if (nodes.length === 0) return;

  const centerX = CANVAS_CENTER;
  const centerY = CANVAS_CENTER;
  const radius = (config.layoutCenter / 10) * (CANVAS_SCALE / 2 - 0.5);

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    node.position = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

/**
 * Place N mother nodes evenly around a circle centred at (5,5).
 * Returns positions in CANVAS_SCALE space.
 */
export function placeMothers(count: number, config: BaubleConfig): Point[] {
  if (count === 0) return [];

  const positions: Point[] = [];
  const orbitRadius = config.rootEnabled ? config.motherOrbitRadius : 3.0;

  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2; // Start at top
    const x = CANVAS_CENTER + orbitRadius * Math.cos(angle);
    const y = CANVAS_CENTER + orbitRadius * Math.sin(angle);
    positions.push({ x, y });
  }

  return positions;
}

/**
 * Place N children around their mother position in a mini-circle.
 */
export function placeChildren(motherPos: Point, childCount: number, config: BaubleConfig): Point[] {
  if (childCount === 0) return [];

  const positions: Point[] = [];
  const orbitRadius = config.childOrbitRadius;

  for (let i = 0; i < childCount; i++) {
    const angle = (2 * Math.PI * i) / childCount - Math.PI / 2;
    const x = motherPos.x + orbitRadius * Math.cos(angle);
    const y = motherPos.y + orbitRadius * Math.sin(angle);
    positions.push({ x, y });
  }

  return positions;
}

/**
 * Place N grandchildren around their child position in a mini-circle.
 */
export function placeGrandchildren(childPos: Point, count: number, config: BaubleConfig): Point[] {
  if (count === 0) return [];

  const positions: Point[] = [];
  const orbitRadius = config.grandchildOrbitRadius;

  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = childPos.x + orbitRadius * Math.cos(angle);
    const y = childPos.y + orbitRadius * Math.sin(angle);
    positions.push({ x, y });
  }

  return positions;
}

/**
 * Apply layout algorithm to nodes in-place
 */
function applyLayout(nodes: BaubleNode[], edges: BaubleEdge[], config: BaubleConfig): void {
  switch (config.layoutType) {
    case 'random':
      randomLayout(nodes);
      break;
    case 'circlepack':
      circlePackLayout(nodes, edges, config);
      break;
    case 'forcedirected':
      forceDirectedLayout(nodes, edges, config);
      break;
    case 'forceatlas2':
      // ForceAtlas2 uses similar physics but with different parameters
      forceDirectedLayout(nodes, edges, config);
      break;
    case 'noverlap':
      noverlabLayout(nodes, config);
      break;
    case 'hierarchy':
      hierarchyLayout(nodes, edges, config);
      break;
    case 'radialhierarchy':
      radialHierarchyLayout(nodes, edges, config);
      break;
    case 'circular':
    default:
      // Place all nodes in a single circle
      circularLayout(nodes, config);
      break;
  }
}

/**
 * Build a complete BaubleGraph from the current file list and config.
 * This is the single source-of-truth for graph construction.
 * Handles root mothers and grandchild Excel files linked to specific child nodes.
 */
export function buildBaubleGraph(files: LoadedBaubleFile[], config: BaubleConfig): BaubleGraph {
  const nodes: BaubleNode[] = [];
  const edges: BaubleEdge[] = [];

  // 1. Create Root node if enabled
  if (config.rootEnabled) {
    nodes.push({
      id: 'root',
      kind: 'root',
      label: config.rootLabel,
      position: { x: CANVAS_CENTER, y: CANVAS_CENTER },
      radius: config.rootRadius,
      color: config.rootColor,
    });
  }

  // 2. Filter to get only root mothers (not linked to a child node)
  const rootMothers = files.filter((f) => !f.parentChildNodeId);
  const motherPositions = placeMothers(rootMothers.length, config);

  // Apply motherRadiusMultiplier to mother radius
  const scaledMotherRadius = config.motherRadius * config.motherRadiusMultiplier;

  const motherNodes: BaubleNode[] = rootMothers.map((file, index) => ({
    id: `mother-${rootMothers.indexOf(file)}`,
    kind: 'mother',
    label: file.motherLabel,
    position: motherPositions[index],
    radius: scaledMotherRadius,
    color: config.motherColor,
  }));

  nodes.push(...motherNodes);

  // 3. Create child nodes around each mother (from mother's own childNames only)
  const childNodes: BaubleNode[] = [];
  rootMothers.forEach((motherFile, motherIndex) => {
    const motherPos = motherPositions[motherIndex];
    const childPositions = placeChildren(
      motherPos,
      motherFile.childNames.length,
      config
    );

    motherFile.childNames.forEach((childName, childIndex) => {
      childNodes.push({
        id: `child-${motherIndex}-${childIndex}`,
        kind: 'child',
        label: childName,
        position: childPositions[childIndex],
        radius: scaledChildRadius(motherFile.childNames.length, config),
        color: config.childColor,
      });
    });
  });

  nodes.push(...childNodes);

  // 4. Create grandchild nodes for files linked to child nodes
  const grandchildFiles = files.filter((f) => !!f.parentChildNodeId);
  grandchildFiles.forEach((gcFile) => {
    const parentChildNode = nodes.find((n) => n.id === gcFile.parentChildNodeId);
    if (!parentChildNode) return; // Stale reference — skip gracefully

    const gcPositions = placeGrandchildren(
      parentChildNode.position,
      gcFile.childNames.length,
      config
    );

    gcFile.childNames.forEach((name, idx) => {
      nodes.push({
        id: `grandchild-${gcFile.fileId}-${idx}`,
        kind: 'grandchild',
        label: name,
        position: gcPositions[idx],
        radius: config.grandchildRadius * config.grandchildRadiusMultiplier,
        color: config.grandchildColor,
      });
    });
  });

  // 5. Build edges

  // Root → Mothers
  if (config.rootEnabled && rootMothers.length > 0) {
    for (let i = 0; i < rootMothers.length; i++) {
      edges.push({
        fromId: 'root',
        toId: `mother-${i}`,
        kind: 'root-to-mother',
      });
    }
  }

  // Mother → Children
  rootMothers.forEach((motherFile, motherIndex) => {
    for (let childIndex = 0; childIndex < motherFile.childNames.length; childIndex++) {
      edges.push({
        fromId: `mother-${motherIndex}`,
        toId: `child-${motherIndex}-${childIndex}`,
        kind: 'mother-to-child',
      });
    }
  });

  // Mother ↔ Mother (all pairs, deduplicated)
  for (let i = 0; i < rootMothers.length; i++) {
    for (let j = i + 1; j < rootMothers.length; j++) {
      edges.push({
        fromId: `mother-${i}`,
        toId: `mother-${j}`,
        kind: 'mother-to-mother',
      });
    }
  }

  // Child → Grandchildren
  grandchildFiles.forEach((gcFile) => {
    if (!gcFile.parentChildNodeId) return;
    gcFile.childNames.forEach((_, idx) => {
      edges.push({
        fromId: gcFile.parentChildNodeId!,
        toId: `grandchild-${gcFile.fileId}-${idx}`,
        kind: 'child-to-grandchild',
      });
    });
  });

  // 6. Apply layout algorithm
  applyLayout(nodes, edges, config);

  return { nodes, edges };
}

/**
 * Regenerate layout by calling buildBaubleGraph.
 * Returns a fresh BaubleGraph with new positions but same IDs.
 */
export function regenerateBaubleLayout(files: LoadedBaubleFile[], config: BaubleConfig): BaubleGraph {
  return buildBaubleGraph(files, config);
}
