import { create } from 'zustand';

interface ViewState {
  zoom: number;
  panX: number;
  panY: number;

  // Actions
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPan: (x: number, y: number) => void;
  pan: (dx: number, dy: number) => void;
  setView: (zoom: number, panX: number, panY: number) => void;
  recenter: () => void;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

export const useViewState = create<ViewState>((set) => ({
  zoom: 0.1, // Start zoomed out to see the larger canvas
  panX: 0,
  panY: 0,

  setZoom: (zoom) => set({
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
  }),

  zoomIn: () => set((state) => ({
    zoom: Math.min(MAX_ZOOM, state.zoom * 1.25)
  })),

  zoomOut: () => set((state) => ({
    zoom: Math.max(MIN_ZOOM, state.zoom / 1.25)
  })),

  setPan: (x, y) => set({ panX: x, panY: y }),

  pan: (dx, dy) => set((state) => ({
    panX: state.panX + dx,
    panY: state.panY + dy
  })),

  setView: (zoom, panX, panY) => set({
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
    panX,
    panY
  }),

  recenter: () => set({ zoom: 0.1, panX: 0, panY: 0 })
}));
