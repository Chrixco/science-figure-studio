import { useEffect, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cell, ColorScheme, NetworkConfig } from '../types';
import {
  create3DScene,
  updateScene3D,
  resize3DScene,
  render3D,
  dispose3D,
  resetCamera3D,
  Scene3D
} from '../utils/geometry3d';

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
    controls.enablePan = false; // Disable panning - rotate and zoom only
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.autoRotate = false;

    // Zoom limits
    controls.minDistance = 10;
    controls.maxDistance = 30;

    // Rotation limits (prevent weird angles)
    controls.minPolarAngle = Math.PI * 0.1; // Prevent flipping
    controls.maxPolarAngle = Math.PI * 0.9; // Keep above horizon

    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (controlsRef.current && scene3DRef.current) {
        controlsRef.current.update();
        render3D(scene3DRef.current);
      }
    };

    animate();

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        // Reset camera
        if (scene3DRef.current) {
          resetCamera3D(scene3DRef.current, 800);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Handle window resize
    const handleResize = () => {
      if (containerRef.current && scene3DRef.current) {
        resize3DScene(scene3DRef.current, containerRef.current);
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
    };
  }, []);

  // Update scene when cells or colors change
  useEffect(() => {
    if (!scene3DRef.current) return;

    updateScene3D(scene3DRef.current, cells, colors);
    render3D(scene3DRef.current);
  }, [cells, colors]);

  // Update scene when config changes (function visibility, weights, etc.)
  useEffect(() => {
    if (!scene3DRef.current) return;

    updateScene3D(scene3DRef.current, cells, colors);
    render3D(scene3DRef.current);
  }, [config]);

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
          background: 'rgba(0, 0, 0, 0.7)',
          color: colors.text,
          padding: '10px 15px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 10,
          pointerEvents: 'none',
          textAlign: 'right',
          lineHeight: '1.5'
        }}
      >
        <div>Drag: Rotate</div>
        <div>Wheel: Zoom</div>
        <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '5px' }}>
          R: Reset Camera
        </div>
      </div>
    </div>
  );
}
