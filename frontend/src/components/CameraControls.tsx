import { useCameraStore } from '../hooks/useCameraStore';
import { useViewState } from '../hooks/useViewState';
import { Icons } from './ui/Icons';
import { Button, IconButton } from './ui/controls';

// ============================================================================
// CAMERA CONTROLS COMPONENT
// ============================================================================

export interface CameraControlsProps {
  title?: string;
  showPanControls?: boolean;
  showZoomControls?: boolean;
  showResetControls?: boolean;
  panStep?: number;
}

export function CameraControls({
  title = 'Camera Controls',
  showPanControls = true,
  showZoomControls = true,
  showResetControls = true,
  panStep = 30,
}: CameraControlsProps) {
  const {
    zoom,
    pan,
    zoomByFactor,
    moveTo,
    reset,
  } = useCameraStore();

  const handlePan = (deltaX: number, deltaY: number) => {
    pan(deltaX, deltaY);
  };

  const handleZoom = (factor: number) => {
    zoomByFactor(factor);
  };

  const handleFitView = () => {
    moveTo(0, 0, 0.6);
  };

  const handleReset = () => {
    reset();
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider px-2 py-1">
        {title}
      </div>

      {/* Zoom Controls */}
      {showZoomControls && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <IconButton
              icon={Icons.zoomOut}
              onClick={() => handleZoom(0.9)}
              title="Zoom Out (smaller view)"
            />
            <div className="flex-1 flex items-center justify-center px-2 py-2 bg-gray-800/50 rounded-lg">
              <span className="text-xs text-gray-400">
                {(zoom * 100).toFixed(0)}%
              </span>
            </div>
            <IconButton
              icon={Icons.zoomIn}
              onClick={() => handleZoom(1.1)}
              title="Zoom In (larger view)"
            />
          </div>
        </div>
      )}

      {/* Pan Controls */}
      {showPanControls && (
        <div className="space-y-2">
          {/* Up */}
          <div className="flex justify-center">
            <IconButton
              icon={Icons.moveUp}
              onClick={() => handlePan(0, -panStep)}
              title="Pan Up"
            />
          </div>

          {/* Left, Center, Right */}
          <div className="flex gap-1.5 justify-center">
            <IconButton
              icon={Icons.moveLeft}
              onClick={() => handlePan(panStep, 0)}
              title="Pan Left"
            />
            <IconButton
              icon={Icons.centerView}
              onClick={handleFitView}
              title="Center View (fit to view)"
            />
            <IconButton
              icon={Icons.moveRight}
              onClick={() => handlePan(-panStep, 0)}
              title="Pan Right"
            />
          </div>

          {/* Down */}
          <div className="flex justify-center">
            <IconButton
              icon={Icons.moveDown}
              onClick={() => handlePan(0, panStep)}
              title="Pan Down"
            />
          </div>
        </div>
      )}

      {/* Reset Controls */}
      {showResetControls && (
        <div className="pt-2 border-t border-gray-800">
          <Button
            onClick={handleReset}
            variant="secondary"
            icon={Icons.centerView}
            className="w-full"
          >
            Reset Camera
          </Button>
        </div>
      )}
    </div>
  );
}

// Layout-specific camera controls (uses useViewState instead of useCameraStore)
export function LayoutCameraControls({
  title = 'View Controls',
  showPanControls = true,
  showZoomControls = true,
  showResetControls = true,
  panStep = 30,
}: CameraControlsProps) {
  const {
    zoom,
    panX,
    panY,
    setView,
  } = useViewState();

  const handlePan = (deltaX: number, deltaY: number) => {
    setView(zoom, panX + deltaX, panY + deltaY);
  };

  const handleZoom = (factor: number) => {
    const newZoom = zoom * factor;
    setView(newZoom, panX, panY);
  };

  const handleReset = () => {
    setView(1, 0, 0);
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider px-2 py-1">
        {title}
      </div>

      {/* Zoom Controls */}
      {showZoomControls && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <IconButton
              icon={Icons.zoomOut}
              onClick={() => handleZoom(0.8)}
              title="Zoom Out (smaller view)"
            />
            <div className="flex-1 flex items-center justify-center px-2 py-2 bg-gray-800/50 rounded-lg">
              <span className="text-xs text-gray-400">
                {(zoom * 100).toFixed(0)}%
              </span>
            </div>
            <IconButton
              icon={Icons.zoomIn}
              onClick={() => handleZoom(1.25)}
              title="Zoom In (larger view)"
            />
          </div>
        </div>
      )}

      {/* Pan Controls */}
      {showPanControls && (
        <div className="space-y-2">
          {/* Up */}
          <div className="flex justify-center">
            <IconButton
              icon={Icons.moveUp}
              onClick={() => handlePan(0, -panStep)}
              title="Pan Up"
            />
          </div>

          {/* Left, Reset, Right */}
          <div className="flex gap-1.5">
            <IconButton
              icon={Icons.moveLeft}
              onClick={() => handlePan(-panStep, 0)}
              title="Pan Left"
            />
            {showResetControls && (
              <Button onClick={handleReset} variant="secondary" className="flex-1">
                Reset
              </Button>
            )}
            <IconButton
              icon={Icons.moveRight}
              onClick={() => handlePan(panStep, 0)}
              title="Pan Right"
            />
          </div>

          {/* Down */}
          <div className="flex justify-center">
            <IconButton
              icon={Icons.moveDown}
              onClick={() => handlePan(0, panStep)}
              title="Pan Down"
            />
          </div>
        </div>
      )}
    </div>
  );
}
