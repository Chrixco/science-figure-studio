# Global Camera Controls Component

## Overview
A comprehensive, reusable camera control UI component that provides unified view navigation across the entire application. Works seamlessly with the centralized `useCameraStore` global state.

## Features

### View Controls
- **Zoom In/Out**: 10% increment/decrement with real-time percentage display
- **Pan Navigation**: Four-directional pan with center view shortcut
- **Fit to View**: Instantly reset camera to center with default zoom (0.6)
- **Reset Camera**: Complete reset to initial state (0, 0, 0.6 zoom)

### Integration
- **Layout Tab**: "View Controls" section for Mitosis visualization navigation
- **Graph Tab**: "Graph Navigation" section for Bauble graph navigation
- **Global State**: Both tabs control the same global camera store

## Component API

```typescript
interface CameraControlsProps {
  title?: string;                  // Component heading (default: "Camera Controls")
  showPanControls?: boolean;       // Toggle pan direction buttons (default: true)
  showZoomControls?: boolean;      // Toggle zoom in/out (default: true)
  showResetControls?: boolean;     // Toggle reset button (default: true)
  panStep?: number;                // Pan distance per click in pixels (default: 30)
}
```

### Usage Example

```typescript
import { CameraControls } from './components/ControlPanel';

// In your tab component:
<CameraControls
  title="Graph Navigation"
  showPanControls={true}
  showZoomControls={true}
  showResetControls={true}
  panStep={30}
/>
```

## User Interface

### Zoom Section
- **Zoom Out Button** (🔍−): Decreases zoom by 10%
- **Percentage Display**: Shows current zoom level (e.g., "60%")
- **Zoom In Button** (🔍+): Increases zoom by 10%

### Pan Section
- **Up Button** (↑): Pans view upward
- **Left/Center/Right Buttons**: (←), Center (pan to view), (→)
- **Down Button** (↓): Pans view downward

### Reset Section
- **Reset Camera Button**: Returns to initial state (center at 0,0 with 0.6 zoom)

## Implementation Details

### Global State Integration
Uses `useCameraStore` hooks:
- `zoom`: Current zoom level (0.5-3.0)
- `pan(deltaX, deltaY)`: Pan by relative amount
- `zoomByFactor(factor)`: Multiply zoom by factor
- `moveTo(x, y, zoom)`: Set absolute position and zoom
- `reset()`: Return to default state

### Styling
- Uses centralized `UI_STYLES` from ControlPanel
- IconButton components for precise alignment
- Consistent color scheme (cyan accent for active states)
- Responsive layout with flexbox

### Pan Step Value
- Default: 30 pixels per click
- Adjustable via props to customize pan sensitivity
- Larger values = larger pan distance per click

## Best Practices Implemented

### 1. **Component Reusability**
- Single component handles both Layout and Graph tabs
- Configurable via props (not hardcoded behavior)
- No tab-specific logic embedded in component

### 2. **Global State Management**
- Uses Zustand store for single source of truth
- No prop drilling for camera state
- Automatic re-renders when camera changes

### 3. **User Experience**
- Real-time zoom percentage feedback
- Intuitive directional button layout (arrow formation)
- Center button combines pan-to-center + fit-to-view
- Clear tooltips on all buttons

### 4. **Code Quality**
- TypeScript interfaces for props
- Proper separation of concerns (component vs logic)
- No unused variables or dead code
- Consistent with codebase patterns

### 5. **Accessibility**
- Descriptive button titles (show in hover)
- Icon-only buttons with semantic meanings
- Color contrast follows accessibility guidelines
- Keyboard-accessible (standard button elements)

### 6. **Maintainability**
- Single responsibility: just UI for camera control
- All logic delegated to `useCameraStore`
- Easy to extend (add more buttons, controls, etc.)
- Clear prop names document intended usage

## Customization Examples

### Minimal Controls (Only Zoom)
```typescript
<CameraControls
  title="Zoom Only"
  showPanControls={false}
  showZoomControls={true}
  showResetControls={false}
/>
```

### Enhanced Pan Sensitivity
```typescript
<CameraControls
  title="Fine Pan Control"
  panStep={15}  // Smaller steps for fine control
/>
```

### Compact View
```typescript
<CameraControls
  title="Quick Nav"
  showResetControls={false}  // Hide reset to save space
  panStep={20}
/>
```

## Testing Checklist

- [ ] Zoom In/Out changes zoom level by 10%
- [ ] Pan buttons move view in correct directions
- [ ] Center button resets zoom to 0.6 and centers at (0,0)
- [ ] Reset button fully resets camera state
- [ ] Zoom percentage displays correctly (60%, 72%, 50%, etc.)
- [ ] Works in both Layout and Graph tabs
- [ ] Camera changes persist across tab switches
- [ ] Buttons have proper hover states
- [ ] No console errors on interaction
- [ ] Responsive on different screen sizes

## Integration Points

### ControlPanel.tsx
```typescript
// Import at top
import { useCameraStore } from '../hooks/useCameraStore';

// Use in tabs
<CameraControls title="View Controls" />  // In Layout tab
<CameraControls title="Graph Navigation" />  // In Graph tab
```

### Related Files
- `src/hooks/useCameraStore.ts`: Global camera state management
- `src/components/BaubleCanvas.tsx`: 3D visualization using camera store
- `src/components/ControlPanel.tsx`: UI component containing camera controls

## Future Enhancements

1. **Camera Animation**: Smooth transitions between positions
   ```typescript
   moveTo(x, y, zoom, { duration: 500 })  // Animated move
   ```

2. **Keyboard Shortcuts**: Arrow keys for pan, +/- for zoom
   ```typescript
   // Listen to keyboard in CameraControls effect
   ```

3. **Camera History**: Undo/Redo for camera movements
   ```typescript
   useCameraStore().pushHistory()
   useCameraStore().undo()
   ```

4. **Preset Views**: Named camera positions
   ```typescript
   <CameraControls presets={['zoom', 'overview', 'detail']} />
   ```

5. **Mouse Wheel Integration**: Already works (implemented in BaubleCanvas)

6. **Touch Gestures**: Pinch zoom and pan for mobile
   ```typescript
   // Gesture handling in visualization component
   ```
