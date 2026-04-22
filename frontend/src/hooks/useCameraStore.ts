import { create } from 'zustand';

export interface CameraState {
  // Pan position (world coordinates)
  panX: number;
  panY: number;

  // Zoom level
  zoom: number;

  // Camera bounds/constraints
  minZoom: number;
  maxZoom: number;
}

export interface CameraActions {
  // Basic pan/zoom controls
  pan: (deltaX: number, deltaY: number) => void;
  setPan: (x: number, y: number) => void;
  getPan: () => { x: number; y: number };

  // Zoom controls
  zoomByFactor: (factor: number) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number;

  // Combined movement
  moveTo: (x: number, y: number, zoom?: number) => void;

  // Reset to default
  reset: () => void;

  // Get all state
  getState: () => CameraState;

  // Set bounds
  setBounds: (minZoom: number, maxZoom: number) => void;
}

const DEFAULT_ZOOM = 0.6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

export const useCameraStore = create<CameraState & CameraActions>((set, get) => ({
  // Initial state
  panX: 0,
  panY: 0,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,

  // Pan actions
  pan: (deltaX: number, deltaY: number) => {
    set((state) => ({
      panX: state.panX - deltaX,
      panY: state.panY + deltaY,
    }));
  },

  setPan: (x: number, y: number) => {
    set({ panX: x, panY: y });
  },

  getPan: () => {
    const state = get();
    return { x: state.panX, y: state.panY };
  },

  // Zoom actions
  zoomByFactor: (factor: number) => {
    set((state) => {
      const newZoom = Math.max(
        state.minZoom,
        Math.min(state.maxZoom, state.zoom * factor)
      );
      return { zoom: newZoom };
    });
  },

  setZoom: (zoom: number) => {
    set((state) => ({
      zoom: Math.max(
        state.minZoom,
        Math.min(state.maxZoom, zoom)
      ),
    }));
  },

  getZoom: () => get().zoom,

  // Combined movement
  moveTo: (x: number, y: number, zoom?: number) => {
    set((state) => ({
      panX: x,
      panY: y,
      zoom: zoom !== undefined
        ? Math.max(state.minZoom, Math.min(state.maxZoom, zoom))
        : state.zoom,
    }));
  },

  // Reset camera
  reset: () => {
    set({
      panX: 0,
      panY: 0,
      zoom: DEFAULT_ZOOM,
    });
  },

  // Get entire state
  getState: () => {
    const state = get();
    return {
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom,
      minZoom: state.minZoom,
      maxZoom: state.maxZoom,
    };
  },

  // Set zoom bounds
  setBounds: (minZoom: number, maxZoom: number) => {
    set({
      minZoom,
      maxZoom,
      zoom: Math.max(minZoom, Math.min(maxZoom, get().zoom)),
    });
  },
}));
