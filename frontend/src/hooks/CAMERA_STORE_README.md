# Global Camera Store (useCameraStore)

## Overview
A centralized Zustand-based state management system for camera control (pan and zoom) across the entire application. This enables programmatic camera control from any component without prop drilling.

## Usage

### Import the store
```typescript
import { useCameraStore } from '../hooks/useCameraStore';
```

### Access camera state and methods
```typescript
const {
  // State
  zoom,      // Current zoom level (0.5 - 3)
  panX,      // Horizontal pan position
  panY,      // Vertical pan position
  minZoom,   // Minimum zoom constraint (0.5)
  maxZoom,   // Maximum zoom constraint (3)
  
  // Methods
  pan,           // pan(deltaX, deltaY) - Move camera by delta
  setPan,        // setPan(x, y) - Set exact pan position
  getPan,        // getPan() -> { x, y }
  zoomByFactor,  // zoomByFactor(factor) - Multiply zoom by factor (e.g., 1.1x)
  setZoom,       // setZoom(zoom) - Set exact zoom level
  getZoom,       // getZoom() -> number
  moveTo,        // moveTo(x, y, zoom?) - Combined movement with optional zoom
  reset,         // reset() - Reset to default (0, 0, 0.6)
  getState,      // getState() -> CameraState
  setBounds,     // setBounds(minZoom, maxZoom) - Update zoom constraints
} = useCameraStore();
```

## Current Integration

### BaubleCanvas (src/components/BaubleCanvas.tsx)
- Uses global camera store for all pan/zoom operations
- handlePointerMove: Calls `pan(deltaX, deltaY)` for middle-mouse panning
- handleWheel: Calls `zoomByFactor(factor)` for scroll-based zooming
- Rendering loop continuously applies camera state to Three.js camera

## Default Values
- **Initial Zoom**: 0.6 (zoomed out to see full graph)
- **Zoom Range**: 0.5 - 3.0
- **Initial Pan**: (0, 0) - centered

## Future Use Cases

1. **Camera Controls UI**: Create buttons to trigger camera movements
   ```typescript
   // Pan to center
   useCameraStore().moveTo(0, 0);
   
   // Zoom to fit all content
   useCameraStore().setZoom(0.6);
   
   // Smooth zoom in/out
   useCameraStore().zoomByFactor(1.2);
   ```

2. **Keyboard Shortcuts**: Bind to camera store methods
   ```typescript
   // Press 'Home' to reset camera
   if (key === 'Home') useCameraStore().reset();
   ```

3. **Undo/Redo**: Store camera state history
   ```typescript
   const cameraState = useCameraStore().getState();
   // Later restore it
   const { panX, panY, zoom } = cameraState;
   useCameraStore().moveTo(panX, panY, zoom);
   ```

4. **Multi-visualization sync**: Share camera across multiple views
   ```typescript
   // Automatically sync camera position across different visualization modes
   ```

## Technical Details

- **Store**: Zustand (lightweight state management)
- **Zoom Bounds**: Enforced at set time (min/max constraints)
- **Pan**: Stored as world coordinates (not screen coordinates)
- **Rendering**: Three.js orthographic camera updated each frame
- **Interactions**: Mouse events (pointer events) trigger store updates
