import { useEffect, useState } from 'react';
import { NetworkCanvas } from './NetworkCanvas';
import { ControlPanel } from './ControlPanel';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { parseShareableURL } from '../utils/export';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { loadState } = useNetworkStore();

  // Load from URL on mount
  useEffect(() => {
    const urlState = parseShareableURL();
    if (urlState) {
      loadState(urlState.cells, urlState.config, urlState.colors);
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadState]);

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
        <ControlPanel />
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Canvas Area */}
      <main className="flex-1 h-full">
        <NetworkCanvas />
      </main>
    </div>
  );
}
