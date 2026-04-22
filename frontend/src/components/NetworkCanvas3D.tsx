import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import { Cell, ColorScheme, NetworkConfig } from '../types';
import {
  create3DScene,
  updateScene3D,
  resize3DScene,
  render3D,
  dispose3D,
  resetCamera3D,
  visualizeCollisions,
  clearCollisionVisualization,
  Scene3D,
  updateAllCellVisuals,
  focusOnCell
} from '../utils/geometry3d';
import { detectCollisions, getCollisionStats, Collision, CollisionStats, autoResolveCollisions } from '../utils/collision3d';
import { createInteractionManager, InteractionManager } from '../utils/interaction3d';
import { useNetworkStore } from '../hooks/useNetworkStore';

interface NetworkCanvas3DProps {
  cells: Cell[];
  config: NetworkConfig;
  colors: ColorScheme;
}

export function NetworkCanvas3D({
  cells,
  config,
  colors
}: NetworkCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scene3DRef = useRef<Scene3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const interactionManagerRef = useRef<InteractionManager | null>(null);

  // Store integration
  const { selectedCellIds, setSelectedCells, toggleCellSelection, setCells, undo, redo } = useNetworkStore();

  // Collision detection state
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const [collisionStats, setCollisionStats] = useState<CollisionStats | null>(null);

  // Interaction state
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    cellId: string;
    label: string;
    position: { x: number; y: number };
  } | null>(null);

  // 3D Controls state
  const [lightingIntensity, setLightingIntensity] = useState(0.8);
  const [ambientIntensity, setAmbientIntensity] = useState(0.6);
  const [showCollisions, setShowCollisions] = useState(true);
  const [showShadows, setShowShadows] = useState(true);

  // Buffer for collision resolution (absolute distance units)
  // Calculated from cellSpacing: buffer = cellSpacing * cellRadius
  // Initial value based on avoidOverlap setting
  const [bufferPercent, setBufferPercent] = useState(config.avoidOverlap ? config.cellSpacing : 0);

  // Initialize 3D scene on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene3D = create3DScene(containerRef.current, cells, colors);
    scene3DRef.current = scene3D;

    // Setup orbit controls
    const controls = new OrbitControls(scene3D.camera, scene3D.renderer.domElement);
    controls.target.set(5, 5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.autoRotate = false;
    controls.minDistance = 10;
    controls.maxDistance = 30;
    controls.minPolarAngle = Math.PI * 0.1;
    controls.maxPolarAngle = Math.PI * 0.9;

    controlsRef.current = controls;

    // Create interaction manager for hover/click detection
    const interactionManager = createInteractionManager();
    interactionManagerRef.current = interactionManager;

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current && scene3DRef.current) {
        resize3DScene(scene3DRef.current, containerRef.current);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup (only remove resize listener on unmount)
    return () => {
      window.removeEventListener('resize', handleResize);

      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      if (scene3DRef.current) {
        dispose3D(scene3DRef.current);
        scene3DRef.current = null;
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      interactionManagerRef.current = null;
    };
  }, []);

  // Animation loop and interaction handlers
  useEffect(() => {
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (controlsRef.current && scene3DRef.current && interactionManagerRef.current) {
        controlsRef.current.update();

        // Update all cell visuals based on current interaction state
        const collisionIds = new Set(
          collisionStats?.overlappingCellIds || []
        );
        updateAllCellVisuals(
          scene3DRef.current,
          cells,
          selectedCellIds,
          hoveredCellId,
          collisionIds,
          colors
        );

        render3D(scene3DRef.current);
      }
    };

    animate();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [cells, colors, selectedCellIds, hoveredCellId, collisionStats]);

  // Event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Camera reset
      else if (key === 'r') {
        if (scene3DRef.current) {
          resetCamera3D(scene3DRef.current, 800);
        }
      }
      // Clear selection
      else if (key === 'escape') {
        setSelectedCells([]);
        setHoveredCellId(null);
      }
      // Focus on selected cell
      else if (key === 'f' && selectedCellIds.length > 0) {
        if (scene3DRef.current) {
          focusOnCell(scene3DRef.current, selectedCellIds[0]);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactionManagerRef.current || !scene3DRef.current) return;

      const canvas = scene3DRef.current.renderer.domElement;
      interactionManagerRef.current.updateMousePosition(e.clientX, e.clientY, canvas);

      const cellId = interactionManagerRef.current.detectHover(
        scene3DRef.current.cellGroup,
        scene3DRef.current.camera
      );

      setHoveredCellId(cellId);

      if (cellId) {
        const cell = cells.find(c => c.id === cellId);
        if (cell) {
          setTooltipInfo({
            cellId,
            label: cell.label,
            position: { x: e.clientX, y: e.clientY }
          });
        }
      } else {
        setTooltipInfo(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!interactionManagerRef.current || !scene3DRef.current) return;

      const canvas = scene3DRef.current.renderer.domElement;
      interactionManagerRef.current.updateMousePosition(e.clientX, e.clientY, canvas);

      const cellId = interactionManagerRef.current.detectClick(
        scene3DRef.current.cellGroup,
        scene3DRef.current.camera
      );

      if (cellId) {
        if (e.shiftKey) {
          toggleCellSelection(cellId);
        } else {
          setSelectedCells([cellId]);
        }
      } else {
        if (!e.shiftKey) {
          setSelectedCells([]);
        }
      }
    };

    const handleDoubleClick = (e: MouseEvent) => {
      if (!interactionManagerRef.current || !scene3DRef.current) return;

      const canvas = scene3DRef.current.renderer.domElement;
      interactionManagerRef.current.updateMousePosition(e.clientX, e.clientY, canvas);

      const cellId = interactionManagerRef.current.detectClick(
        scene3DRef.current.cellGroup,
        scene3DRef.current.camera
      );

      if (cellId) {
        focusOnCell(scene3DRef.current, cellId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('dblclick', handleDoubleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [cells, selectedCellIds, setSelectedCells, toggleCellSelection, undo, redo]);

  // Update scene when cells or colors change
  useEffect(() => {
    if (!scene3DRef.current) return;

    updateScene3D(scene3DRef.current, cells, colors);

    // Detect collisions
    const detectedCollisions = detectCollisions(cells);
    setCollisions(detectedCollisions);

    // Calculate statistics
    const stats = getCollisionStats(cells, detectedCollisions);
    setCollisionStats(stats);

    // Visualize collisions
    if (detectedCollisions.length > 0) {
      visualizeCollisions(scene3DRef.current, detectedCollisions, colors);
    } else {
      clearCollisionVisualization(scene3DRef.current, colors);
    }

    render3D(scene3DRef.current);
  }, [cells, colors]);

  // Update scene when config changes (function visibility, weights, etc.)
  useEffect(() => {
    if (!scene3DRef.current) return;

    updateScene3D(scene3DRef.current, cells, colors);
    render3D(scene3DRef.current);
  }, [config]);

  // Handle lighting intensity changes
  useEffect(() => {
    if (!scene3DRef.current) return;

    const directionalLight = scene3DRef.current.scene.children.find(
      (child: any) => child.isDirectionalLight
    ) as any;
    if (directionalLight) {
      directionalLight.intensity = lightingIntensity;
    }

    render3D(scene3DRef.current);
  }, [lightingIntensity]);

  // Handle ambient light intensity changes
  useEffect(() => {
    if (!scene3DRef.current) return;

    const ambientLight = scene3DRef.current.scene.children.find(
      (child: any) => child.isAmbientLight
    ) as any;
    if (ambientLight) {
      ambientLight.intensity = ambientIntensity;
    }

    render3D(scene3DRef.current);
  }, [ambientIntensity]);

  // Handle collision visibility toggle
  useEffect(() => {
    if (!scene3DRef.current) return;

    if (showCollisions && collisions.length > 0) {
      visualizeCollisions(scene3DRef.current, collisions, colors);
    } else {
      clearCollisionVisualization(scene3DRef.current, colors);
    }

    render3D(scene3DRef.current);
  }, [showCollisions, collisions, colors]);

  // Handle theme changes - update 3D scene colors
  useEffect(() => {
    if (!scene3DRef.current) return;

    // Update scene background to match theme
    scene3DRef.current.scene.background = new THREE.Color(colors.background);

    // Update cell colors for theme
    updateScene3D(scene3DRef.current, cells, colors);

    render3D(scene3DRef.current);
  }, [colors]);

  // Update buffer when avoidOverlap or cellSpacing changes in 2D
  useEffect(() => {
    // Auto-sync buffer percentage with cellSpacing from 2D config
    // This ensures consistent behavior when switching between 2D/3D
    if (config.avoidOverlap && config.cellSpacing && Math.abs(config.cellSpacing - bufferPercent) > 0.01) {
      setBufferPercent(config.cellSpacing);
    } else if (!config.avoidOverlap && bufferPercent !== 0) {
      // If avoidOverlap was disabled, reset buffer to 0
      setBufferPercent(0);
    }
  }, [config.avoidOverlap, config.cellSpacing]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: colors.background,
        overflow: 'hidden'
      }}
    >
      {/* Help text overlay */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: config.theme === 'dark'
            ? 'rgba(0, 0, 0, 0.7)'
            : 'rgba(255, 255, 255, 0.8)',
          color: colors.text,
          padding: '10px 15px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 10,
          pointerEvents: 'none',
          textAlign: 'right',
          lineHeight: '1.5',
          maxWidth: '280px',
          border: config.theme === 'dark'
            ? 'none'
            : '1px solid rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#00ffff' }}>CAMERA</div>
        <div>Drag: Rotate</div>
        <div>Wheel: Zoom</div>
        <div>R: Reset</div>

        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px', fontWeight: 'bold', color: '#00ffff' }}>INTERACTION</div>
        <div>Hover: Preview Cell</div>
        <div>Click: Select</div>
        <div>Shift+Click: Multi-Select</div>
        <div>Double-Click: Focus</div>
        <div>F: Focus Selected</div>
        <div>Esc: Clear</div>
        <div>Cmd+Z: Undo</div>
        <div>Cmd+Y: Redo</div>

        {/* Selection Info */}
        {selectedCellIds.length > 0 && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              color: '#00ffff'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>
              Selected: {selectedCellIds.length}
            </div>
          </div>
        )}

        {/* Collision Statistics */}
        {collisionStats && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255,255,255,0.3)',
              color: collisionStats.severity === 'none' ? '#90ee90' : '#ff6666'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              Collisions: {collisionStats.collisionCount}
            </div>
            {collisionStats.collisionCount > 0 && (
              <>
                <div>Severity: {collisionStats.severity.toUpperCase()}</div>
                <div>Overlapping: {collisionStats.overlappingCellCount} cells</div>
                {collisions.length > 0 && collisions.length <= 3 && (
                  <div style={{ marginTop: '5px', fontSize: '11px', color: '#ffcc99' }}>
                    {collisions.map(c => (
                      <div key={c.id}>
                        {c.cell1Label} ↔ {c.cell2Label}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tooltip on hover */}
      {tooltipInfo && (
        <div
          style={{
            position: 'absolute',
            left: tooltipInfo.position.x + 10,
            top: tooltipInfo.position.y + 10,
            background: 'rgba(0, 0, 0, 0.9)',
            color: colors.text,
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
            border: '1px solid #00ffff',
            boxShadow: '0 0 8px rgba(0, 255, 255, 0.3)'
          }}
        >
          <div style={{ fontWeight: 'bold' }}>{tooltipInfo.label}</div>
          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>
            Click to select • Shift+Click for multi
          </div>
        </div>
      )}

      {/* Ultra-thin 3D Controls Bottom Navbar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '32px',
          background: config.theme === 'dark'
            ? 'rgba(0, 0, 0, 0.85)'
            : 'rgba(255, 255, 255, 0.85)',
          borderTop: `1px solid ${config.theme === 'dark'
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(0, 0, 0, 0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          paddingLeft: '12px',
          paddingRight: '12px',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: colors.text,
          zIndex: 100,
          pointerEvents: 'auto'
        }}
      >
        {/* Directional Light Intensity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
          <label style={{ fontSize: '10px', color: config.theme === 'dark' ? '#888' : '#666', whiteSpace: 'nowrap' }}>Light:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={lightingIntensity}
            onChange={(e) => setLightingIntensity(parseFloat(e.target.value))}
            style={{
              width: '60px',
              height: '4px',
              cursor: 'pointer',
              accentColor: '#00ffff'
            }}
            title="Directional Light Intensity"
          />
          <span style={{ fontSize: '10px', color: config.theme === 'dark' ? '#aaa' : '#777', minWidth: '25px' }}>{lightingIntensity.toFixed(1)}</span>
        </div>

        {/* Ambient Light Intensity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
          <label style={{ fontSize: '10px', color: config.theme === 'dark' ? '#888' : '#666', whiteSpace: 'nowrap' }}>Ambient:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ambientIntensity}
            onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
            style={{
              width: '60px',
              height: '4px',
              cursor: 'pointer',
              accentColor: '#00ffff'
            }}
            title="Ambient Light Intensity"
          />
          <span style={{ fontSize: '10px', color: config.theme === 'dark' ? '#aaa' : '#777', minWidth: '25px' }}>{ambientIntensity.toFixed(1)}</span>
        </div>

        {/* Spacing Control (as percentage, converted to absolute distance) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 'max-content' }}>
          <label style={{ fontSize: '10px', color: config.theme === 'dark' ? '#888' : '#666', whiteSpace: 'nowrap' }}>Spacing:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={bufferPercent}
            onChange={(e) => setBufferPercent(parseFloat(e.target.value))}
            style={{
              width: '60px',
              height: '4px',
              cursor: 'pointer',
              accentColor: '#00ff00'
            }}
            title={`Spacing as percentage (${(bufferPercent * 100).toFixed(0)}%) - Converted to absolute distance for collision resolution`}
          />
          <span style={{ fontSize: '10px', color: config.theme === 'dark' ? '#aaa' : '#777', minWidth: '35px' }}>
            {(bufferPercent * 100).toFixed(0)}%
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '16px', background: config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />

        {/* Collision Visibility Toggle */}
        <button
          onClick={() => setShowCollisions(!showCollisions)}
          style={{
            background: showCollisions
              ? config.theme === 'dark' ? 'rgba(255, 100, 100, 0.3)' : 'rgba(255, 100, 100, 0.2)'
              : config.theme === 'dark' ? 'rgba(100, 100, 100, 0.3)' : 'rgba(100, 100, 100, 0.2)',
            border: `1px solid ${showCollisions ? '#ff6666' : config.theme === 'dark' ? '#666666' : '#999999'}`,
            color: showCollisions ? '#ff6666' : config.theme === 'dark' ? '#888888' : '#666666',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace'
          }}
          title="Toggle Collision Visualization"
        >
          {showCollisions ? '✓' : '○'} Collisions
        </button>

        {/* Shadows Toggle */}
        <button
          onClick={() => setShowShadows(!showShadows)}
          style={{
            background: showShadows
              ? config.theme === 'dark' ? 'rgba(100, 150, 255, 0.3)' : 'rgba(100, 150, 255, 0.2)'
              : config.theme === 'dark' ? 'rgba(100, 100, 100, 0.3)' : 'rgba(100, 100, 100, 0.2)',
            border: `1px solid ${showShadows ? '#6496ff' : config.theme === 'dark' ? '#666666' : '#999999'}`,
            color: showShadows ? '#6496ff' : config.theme === 'dark' ? '#888888' : '#666666',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace'
          }}
          title="Toggle Shadows"
        >
          {showShadows ? '✓' : '○'} Shadows
        </button>

        {/* Auto-Resolve Collisions Button */}
        <button
          onClick={() => {
            // Convert percentage to absolute buffer distance
            // buffer = percentage * cellRadius (assuming uniform cells)
            const avgCellRadius = cells.length > 0
              ? cells.reduce((sum, c) => sum + c.radius, 0) / cells.length
              : 1;
            const absoluteBuffer = bufferPercent * avgCellRadius;
            const resolvedCells = autoResolveCollisions(cells, absoluteBuffer, 10);
            setCells(resolvedCells);
          }}
          style={{
            background: config.theme === 'dark' ? 'rgba(0, 200, 100, 0.3)' : 'rgba(0, 200, 100, 0.2)',
            border: `1px solid ${collisions.length > 0 ? '#00cc66' : config.theme === 'dark' ? '#666666' : '#999999'}`,
            color: collisions.length > 0 ? '#00cc66' : config.theme === 'dark' ? '#888888' : '#666666',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: collisions.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '10px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            opacity: collisions.length > 0 ? 1 : 0.5
          }}
          disabled={collisions.length === 0}
          title="Auto-resolve collisions with current buffer distance"
        >
          ⚡ Resolve
        </button>

        {/* Undo/Redo Buttons */}
        <button
          onClick={() => undo()}
          style={{
            background: config.theme === 'dark' ? 'rgba(100, 150, 255, 0.3)' : 'rgba(100, 150, 255, 0.2)',
            border: `1px solid ${config.theme === 'dark' ? '#666666' : '#999999'}`,
            color: config.theme === 'dark' ? '#6496ff' : '#4466cc',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace'
          }}
          title="Undo (Cmd+Z)"
        >
          ↶ Undo
        </button>

        <button
          onClick={() => redo()}
          style={{
            background: config.theme === 'dark' ? 'rgba(100, 150, 255, 0.3)' : 'rgba(100, 150, 255, 0.2)',
            border: `1px solid ${config.theme === 'dark' ? '#666666' : '#999999'}`,
            color: config.theme === 'dark' ? '#6496ff' : '#4466cc',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '10px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace'
          }}
          title="Redo (Cmd+Y)"
        >
          ↷ Redo
        </button>

        {/* Separator */}
        <div style={{ width: '1px', height: '16px', background: config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />

        {/* Info Display */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '10px', color: config.theme === 'dark' ? '#888' : '#666' }}>
            Cells: {cells.length}
          </div>
          {collisionStats && (
            <div style={{ fontSize: '10px', color: collisionStats.collisionCount > 0 ? '#ff6666' : config.theme === 'dark' ? '#90ee90' : '#00aa00' }}>
              Collisions: {collisionStats.collisionCount}
            </div>
          )}
          <div style={{ fontSize: '10px', color: config.theme === 'dark' ? '#888' : '#666' }}>
            Selected: {selectedCellIds.length}
          </div>
        </div>
      </div>
    </div>
  );
}
