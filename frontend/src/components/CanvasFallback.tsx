import { FallbackProps } from 'react-error-boundary';

/**
 * Shown when a canvas throws during render.
 *
 * The 3D view depends on WebGL, which can be unavailable or lost at runtime
 * (driver reset, too many live contexts, headless/remote sessions). Without a
 * boundary that failure unmounts the whole app and leaves a blank page, taking
 * the control panel -- and any unsaved network -- with it.
 */
export function CanvasFallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h2 className="text-lg font-semibold text-gray-100">This view failed to render</h2>
        <p className="text-sm text-gray-400">
          Your network is still loaded — switching views or retrying will not lose it.
        </p>
        <pre className="text-left text-[11px] text-red-300 bg-gray-900 border border-gray-700 rounded p-3 overflow-x-auto whitespace-pre-wrap">
          {message}
        </pre>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-100"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/** Placeholder while a lazily-loaded canvas chunk is fetched. */
export function CanvasLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-gray-500">Loading view…</p>
    </div>
  );
}
