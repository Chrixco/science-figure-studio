import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { LayoutCanvas } from './LayoutCanvas';
import { ControlPanel } from './ControlPanel';
import { CanvasFallback, CanvasLoading } from './CanvasFallback';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useBaubleStore } from '../hooks/useBaubleStore';
import { parseShareableURL } from '../utils/export';
import { loadDefaultBaubleFiles } from '../utils/loadDefaultBaubleFiles';

// Both pull in three.js, which dominates the bundle. Loading them on demand
// keeps the default 2D view off that cost entirely.
const BaubleCanvas = lazy(() =>
  import('./BaubleCanvas').then((m) => ({ default: m.BaubleCanvas }))
);
const NetworkCanvas3D = lazy(() =>
  import('./NetworkCanvas3D').then((m) => ({ default: m.NetworkCanvas3D }))
);

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appMode, setAppMode] = useState<'mitosis' | 'graph'>('mitosis');
  const { loadState, cells, config, colors, renderMode } = useNetworkStore();
  const { addFile } = useBaubleStore();
  // StrictMode runs mount effects twice in development. Without a guard the
  // default workbooks are parsed and added twice, so the graph shows six
  // duplicate mother nodes instead of three.
  const defaultsRequested = useRef(false);

  // Load from URL on mount
  useEffect(() => {
    const urlState = parseShareableURL();
    if (urlState) {
      loadState(urlState.cells, urlState.config, urlState.colors);
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadState]);

  // Load default bauble files on mount
  useEffect(() => {
    if (defaultsRequested.current) return;
    defaultsRequested.current = true;

    const loadDefaults = async () => {
      const files = await loadDefaultBaubleFiles();
      for (const file of files) {
        addFile(file);
      }
    };
    void loadDefaults();
  }, [addFile]);

  const renderCanvas = () => {
    if (appMode === 'graph') return <BaubleCanvas />;
    // The control panel's 2D/3D switch writes renderMode; honour it here.
    if (renderMode === '3d') {
      return <NetworkCanvas3D cells={cells} config={config} colors={colors} />;
    }
    return <LayoutCanvas />;
  };

  return (
    <div className="h-screen w-screen flex bg-canvas overflow-hidden">
      {/* Sidebar Toggle (Mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-canvas-dark rounded-lg text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative z-40 h-full w-80
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden'}
        `}
      >
        <ControlPanel onSetMode={(mode) => setAppMode(mode)} />
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Canvas Area */}
      <main className="flex-1 h-full bg-canvas-dark flex flex-col">
        {/* Remount the boundary when the view changes so a failure in one view
            does not keep the next one from mounting. */}
        <ErrorBoundary FallbackComponent={CanvasFallback} resetKeys={[appMode, renderMode]}>
          <Suspense fallback={<CanvasLoading />}>{renderCanvas()}</Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
