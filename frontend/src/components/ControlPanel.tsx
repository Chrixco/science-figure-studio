import { useState, useRef, useEffect, ReactNode } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useBaubleStore } from '../hooks/useBaubleStore';
import { useCameraStore } from '../hooks/useCameraStore';
import { FUNCTION_TYPES, FUNCTION_LABELS, FunctionType, LayoutTemplate, LineStyle } from '../types';
import { LoadedBaubleFile } from '../types/bauble';
import { exportToPNG, exportToPDF, exportToSVG, exportToJSON, downloadFile, createShareableURL, exportToGIF } from '../utils/export';
import { downloadTemplate } from '../utils/excelTemplate';
import { parseBaubleExcelFile, getExcelSheetNames, getExcelColumnHeaders } from '../utils/baubleExcelParser';
import { exportBaubleGraphToJSON, importBaubleGraphFromJSON, downloadBaubleGraphJSON, exportBaubleGraphToPNG, exportBaubleGraphToPDF, exportBaubleGraphToSVG, downloadBaubleGraphSVG } from '../utils/baubleGraphExport';

// ============================================================================
// CENTRALIZED UI STYLING SYSTEM
// ============================================================================

const UI_STYLES = {
  // Typography
  typography: {
    heading: 'text-base font-semibold text-white',
    subheading: 'text-sm font-medium text-gray-300',
    label: 'text-xs text-gray-400',
    caption: 'text-[10px] text-gray-500',
    body: 'text-xs text-gray-300',
  },

  // Spacing & Layout
  spacing: {
    px: 'px-3',
    py: 'py-2.5',
    gap: 'gap-2',
    section: 'space-y-3',
  },

  // Colors
  colors: {
    background: 'bg-gray-900',
    border: 'border-gray-800',
    text: 'text-white',
    textSecondary: 'text-gray-300',
    hover: 'hover:bg-gray-800',
    active: 'bg-gray-700 text-accent-cyan',
  },

  // Buttons & Controls
  button: {
    primary: 'px-3 py-2 rounded-lg bg-accent-cyan text-gray-900 font-medium text-sm hover:bg-accent-cyan/90 transition-all',
    secondary: 'px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:text-white transition-all text-xs font-medium',
    small: 'px-2 py-1.5 rounded text-xs font-medium transition-all',
  },

  // Input fields
  input: 'w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan',

  // Toggle/Checkbox
  toggle: 'w-4 h-4 rounded accent-accent-cyan cursor-pointer',

  // Slider
  slider: 'w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan',
};

// ============================================================================
// ICONS - Simple SVG icons for better visual communication
// ============================================================================

const Icons = {
  layout: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  style: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  functions: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="5" cy="12" r="2" />
    </svg>
  ),
  export: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  undo: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  ),
  redo: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
    </svg>
  ),
  sun: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  moon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  grid: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  shuffle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  save: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 12m4-4v12" />
    </svg>
  ),
  download: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  cube: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.325 3.675L12 1.5l-8.325 2.175M12 1.5v18m0 0L3.675 17.325M12 19.5l8.325-2.175M3.675 6.675L12 8.85m0 0l8.325-2.175M12 8.85v10" />
    </svg>
  ),
  link: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  eye: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  eyeOff: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ),
  graph: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="16" r="2" />
      <line x1="7" y1="7" x2="11" y2="15" />
      <line x1="17" y1="7" x2="13" y2="15" />
    </svg>
  ),
  // Camera control icons
  zoomIn: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 8v6m3-3H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  zoomOut: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  fitView: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M4 8V4m0 0h4m-4 0l5 5m11-5v4m0-4h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  moveUp: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M7 16.5L12 11.5l5 5m-5-5V4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  moveDown: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17 7.5L12 12.5l-5-5m5 5v11.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  moveLeft: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M16.5 17L11.5 12l5-5m-5 5H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  moveRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M7.5 7l5 5-5 5m5-5h11.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  centerView: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
};

// ============================================================================
// REUSABLE UI COMPONENTS
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1 text-sm font-medium text-gray-200">{title}</span>
        {badge !== undefined && (
          <span className="px-1.5 py-0.5 text-xs bg-accent-cyan/20 text-accent-cyan rounded">
            {badge}
          </span>
        )}
        <span className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          {Icons.chevronDown}
        </span>
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 bg-gray-900/30">
          {children}
        </div>
      )}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;
}

function Slider({ label, value, min, max, step, onChange, suffix = '' }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500 font-mono">{value.toFixed(step < 1 ? 2 : 0)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan"
      />
    </div>
  );
}

interface SliderWithInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderWithInput({ label, value, min, max, step, onChange }: SliderWithInputProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-14 px-2 py-0.5 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs text-center focus:outline-none focus:border-accent-cyan"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan"
      />
    </div>
  );
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

function Toggle({ label, value, onChange, description }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-accent-cyan' : 'bg-gray-600'}`}>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
        </div>
      </div>
      <div className="flex-1">
        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// Color palette presets - curated colors for scientific figures
const COLOR_PALETTE = [
  // Row 1: Vibrant
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653',
  // Row 2: Blues & Purples
  '#1d3557', '#457b9d', '#a8dadc', '#6b5b95', '#b8a9c9',
  // Row 3: Nature
  '#606c38', '#283618', '#dda15e', '#bc6c25', '#344e41',
  // Row 4: Modern
  '#0077b6', '#00b4d8', '#90e0ef', '#ff6b6b', '#4ecdc4',
  // Row 5: Neutrals
  '#212529', '#495057', '#adb5bd', '#f8f9fa', '#ffffff',
];

// ============================================================================
// CENTRALIZED COLOR PICKER MODAL
// ============================================================================
interface ColorPickerModalProps {
  isOpen: boolean;
  label: string;
  value: string;
  onClose: () => void;
  onColorChange: (color: string) => void;
}

function ColorPickerModal({ isOpen, label, value, onClose, onColorChange }: ColorPickerModalProps) {
  const [customColor, setCustomColor] = useState(value || '#000000');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomColor(value || '#000000');
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Blur background */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Centered modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          ref={modalRef}
          className="bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl p-6 w-96 pointer-events-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-100">{label}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
              title="Close (or click outside)"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preset Palette */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 mb-2">Preset Colors</p>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setCustomColor(color);
                    onColorChange(color);
                  }}
                  className={`w-8 h-8 rounded-lg cursor-pointer transition-all hover:scale-110 ${
                    value && value.toLowerCase() === color.toLowerCase()
                      ? 'ring-2 ring-accent-cyan ring-offset-2 ring-offset-gray-800'
                      : 'border border-gray-600 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-4" />

          {/* Custom Color */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-3">Custom Color</p>
            <div className="space-y-3">
              {/* Color Picker + Hex Input */}
              <div className="flex gap-3">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    onColorChange(e.target.value);
                  }}
                  className="w-12 h-12 rounded-lg cursor-pointer border border-gray-600"
                  title="Click to pick a color"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomColor(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        onColorChange(val);
                      }
                    }}
                    placeholder="#000000"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono focus:outline-none focus:border-accent-cyan transition-colors"
                    title="Enter hex color code"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 italic">Format: #RRGGBB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-[10px] text-gray-500 text-center">
              Click outside or close button to dismiss
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onOpenModal?: () => void;
}

function ColorPicker({ value, label, onOpenModal }: ColorPickerProps) {
  // This component is now just a button that opens the modal
  return (
    <button
      onClick={onOpenModal}
      className="w-7 h-7 rounded cursor-pointer border-2 border-gray-600 hover:border-gray-400 transition-all hover:scale-110 shadow-sm active:scale-95"
      style={{ backgroundColor: value }}
      title={label ? `Click to pick ${label}` : 'Click to pick a color'}
    />
  );
}

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onOpenModal?: () => void;
}

function ColorInput({ label, value, onChange, onOpenModal }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <ColorPicker value={value} onChange={onChange} label={label} onOpenModal={onOpenModal} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

interface LineStyleSelectProps {
  value: LineStyle;
  onChange: (value: LineStyle) => void;
}

function LineStyleSelect({ value, onChange }: LineStyleSelectProps) {
  const styles: LineStyle[] = ['solid', 'dashed', 'dotted'];
  const dashArrays = { solid: 'none', dashed: '6,3', dotted: '2,3' };

  return (
    <div className="flex gap-1">
      {styles.map((style) => (
        <button
          key={style}
          onClick={() => onChange(style)}
          className={`flex-1 py-1.5 rounded transition-all ${
            value === style
              ? 'bg-accent-cyan text-gray-900'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
          }`}
          title={style.charAt(0).toUpperCase() + style.slice(1)}
        >
          <svg width="100%" height="8" viewBox="0 0 40 8" preserveAspectRatio="xMidYMid meet">
            <line
              x1="4" y1="4" x2="36" y2="4"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={dashArrays[style]}
              strokeLinecap="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-400 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  title?: string;
}

function Button({ children, onClick, variant = 'secondary', icon, disabled, className = '', title }: ButtonProps) {
  const variants = {
    primary: 'bg-accent-cyan hover:bg-cyan-500 text-gray-900 font-medium',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    danger: 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50',
    ghost: 'bg-transparent hover:bg-gray-700/50 text-gray-400 hover:text-gray-200',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps {
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}

function IconButton({ icon, onClick, disabled, title, active }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-accent-cyan text-gray-900'
          : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-gray-200'
      }`}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// CAMERA CONTROLS COMPONENT
// ============================================================================

interface CameraControlsProps {
  title?: string;
  showPanControls?: boolean;
  showZoomControls?: boolean;
  showResetControls?: boolean;
  panStep?: number;
}

function CameraControls({
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

// ============================================================================
// TAB COMPONENTS
// ============================================================================

type TabId = 'layout' | 'graph';

interface TabProps {
  id: TabId;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}

function Tab({ label, icon, active, onClick }: TabProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${
        active
          ? UI_STYLES.colors.active
          : `${UI_STYLES.colors.textSecondary} hover:text-gray-300 hover:bg-gray-800/50`
      }`}
    >
      {icon}
      <span className={UI_STYLES.typography.caption}>{label}</span>
    </button>
  );
}

// ============================================================================
// MAIN CONTROL PANEL COMPONENT
// ============================================================================

interface ControlPanelProps {
  onSetGraphMode?: (active: boolean) => void;
}

export function ControlPanel({ onSetGraphMode }: ControlPanelProps = {}) {
  // Load session data on mount
  useEffect(() => {
    const sessionData = sessionStorage.getItem('networkSessionData');
    if (sessionData) {
      try {
        importFromJSON(sessionData);
      } catch (error) {
        console.warn('Failed to load session data:', error);
      }
    }
  }, []);

  const {
    cells,
    config,
    colors,
    presets,
    canUndo,
    canRedo,
    renderMode,
    setConfig,
    setColors,
    setFunctionColor,
    setFunctionTextColor,
    setFunctionBackgroundColor,
    setFunctionLabel,
    setFunctionVisible,
    setFunctionWeight,
    setCellLabel,
    regenerateLayout,
    applyTemplate,
    randomizeColors,
    updateCellCount,
    toggleTheme,
    setRenderMode,
    undo,
    redo,
    savePreset,
    loadPreset,
    deletePreset,
    importFromJSON,
    importFromCSV,
    importFromExcel,
    reset
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<TabId>('layout');
  const [layoutSubTab, setLayoutSubTab] = useState<'style' | 'functions' | 'export'>('style');
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [exportQuality, setExportQuality] = useState<'screen' | 'web' | 'print' | 'high'>('print');

  // Centralized color picker modal state
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [colorModalLabel, setColorModalLabel] = useState('');
  const [colorModalValue, setColorModalValue] = useState('#000000');
  const [colorModalCallback, setColorModalCallback] = useState<((color: string) => void) | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Helper to open color modal
  const openColorModal = (label: string, currentColor: string, callback: (color: string) => void) => {
    setColorModalLabel(label);
    setColorModalValue(currentColor);
    setColorModalCallback(() => callback);
    setColorModalOpen(true);
  };

  // Export quality presets
  const exportQualityPresets = {
    screen: { dpi: 72, label: 'Screen (72 DPI)', description: 'Web/digital display' },
    web: { dpi: 150, label: 'Web (150 DPI)', description: 'Online usage' },
    print: { dpi: 300, label: 'Print (300 DPI)', description: 'Professional printing' },
    high: { dpi: 600, label: 'High Quality (600 DPI)', description: 'Advanced printing' },
  };

  // Event handlers
  const handlePlayAnimation = () => {
    window.dispatchEvent(new CustomEvent('playAnimation'));
  };

  const handleExportGIF = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    setIsExportingGif(true);
    setGifProgress(0);

    try {
      await exportToGIF(canvas, cells, config, colors, (progress) => setGifProgress(Math.round(progress * 100)));
    } catch (error) {
      console.error('GIF export failed:', error);
      alert('GIF export failed. Please try again.');
    } finally {
      setIsExportingGif(false);
      setGifProgress(0);
    }
  };

  const handleExportPNG = async () => {
    const canvas = document.querySelector('canvas');
    if (canvas) await exportToPNG(canvas, 'circle-network.png', exportQualityPresets[exportQuality].dpi);
  };

  const handleExportSVG = () => {
    const svg = exportToSVG(cells, config, colors, 1000, 1000);
    downloadFile(svg, 'circle-network.svg', 'image/svg+xml');
  };

  const handleExportJSON = () => {
    const json = exportToJSON(cells, config, colors);
    downloadFile(json, 'circle-network.json', 'application/json');
  };

  const handleShare = async () => {
    const url = createShareableURL(cells, config, colors);
    try {
      await navigator.clipboard.writeText(url);
      alert('Shareable URL copied to clipboard!');
    } catch {
      prompt('Copy this URL:', url);
    }
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      savePreset(presetName.trim());
      setPresetName('');
      setShowPresetInput(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (!importFromJSON(content)) {
          alert('Invalid JSON file format');
        } else {
          // Save to session storage for reload persistence
          sessionStorage.setItem('networkSessionData', content);
          console.log('Session data saved to browser storage');
        }
      };
      reader.readAsText(file);
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (!importFromCSV(content)) alert('Invalid CSV format. Expected: x, y columns (0-1 range)');
      };
      reader.readAsText(file);
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await importFromExcel(file);
        if (!result.success) {
          alert('Import errors:\n' + result.errors.join('\n'));
        } else if (result.errors.length > 0) {
          // Success with warnings
          alert('Imported with warnings:\n' + result.errors.join('\n'));
        } else {
          alert('Excel file imported successfully!');
        }
      } catch (error) {
        alert('Failed to import Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const handleDownloadSimpleTemplate = () => {
    downloadTemplate('simple');
  };

  const handleDownloadDetailedTemplate = () => {
    downloadTemplate('detailed');
  };

  const templates: { value: LayoutTemplate; label: string; icon: ReactNode }[] = [
    { value: 'random', label: 'Random', icon: Icons.shuffle },
    { value: 'grid', label: 'Grid', icon: Icons.grid },
    { value: 'circle', label: 'Circle', icon: <span className="text-xs">◯</span> },
    { value: 'cluster', label: 'Cluster', icon: <span className="text-xs">⬡</span> },
  ];

  const connectionFilterOptions: { value: FunctionType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Connections' },
    ...FUNCTION_TYPES.map(fn => ({ value: fn, label: FUNCTION_LABELS[fn] }))
  ];

  // ============================================================================
  // TAB CONTENT
  // ============================================================================

  // Note: CameraControls is now rendered directly in the Layout tab (above the sub-navbar)
  // This function is kept for reference but is not currently used
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _renderLayoutTabLegacy = () => (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider px-2 py-1">Mitosis Controls</div>
      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button onClick={regenerateLayout} icon={Icons.shuffle} className="flex-1">
          Randomize
        </Button>
        <Button onClick={handlePlayAnimation} variant="primary" icon={Icons.play} className="flex-1">
          Animate
        </Button>
      </div>

      {/* Layout Templates */}
      <div className="grid grid-cols-4 gap-1.5">
        {templates.map((t) => (
          <button
            key={t.value}
            onClick={() => applyTemplate(t.value)}
            className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
            title={t.label}
          >
            {t.icon}
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Cell Count */}
      <SliderWithInput
        label="Number of Cells"
        value={config.cellCount}
        min={1}
        max={30}
        step={1}
        onChange={(count) => {
          updateCellCount(count);
          // Auto-regenerate layout with new cell count
          setTimeout(() => regenerateLayout(), 0);
        }}
      />

      {/* Toggles */}
      <CollapsibleSection title="Layout Options" icon={Icons.layout} defaultOpen>
        <div className="space-y-3">
          <Toggle
            label="Avoid Overlap"
            value={config.avoidOverlap}
            onChange={(v) => {
              setConfig({ avoidOverlap: v });
              setTimeout(regenerateLayout, 0);
            }}
            description="Prevent cells from overlapping"
          />

          {config.avoidOverlap && (
            <Slider
              label="Cell Spacing"
              value={config.cellSpacing}
              min={0.0}
              max={1.0}
              step={0.05}
              onChange={(v) => {
                setConfig({ cellSpacing: v });
                setTimeout(() => regenerateLayout(), 0);
              }}
            />
          )}

          <Toggle
            label="Show External Connections"
            value={config.showExternalConnections}
            onChange={(v) => setConfig({ showExternalConnections: v })}
            description="Connect cells to other cells' functions"
          />

          <Toggle
            label="Lines on Top"
            value={config.linesOnTop}
            onChange={(v) => setConfig({ linesOnTop: v })}
            description="Draw connections above circles"
          />
        </div>
      </CollapsibleSection>

      {/* Grid Settings */}
      <CollapsibleSection title="Grid" icon={Icons.grid}>
        <div className="space-y-3">
          <Toggle
            label="Show Grid"
            value={config.showGrid}
            onChange={(v) => setConfig({ showGrid: v })}
          />

          <Toggle
            label="Snap to Grid"
            value={config.snapToGrid}
            onChange={(v) => setConfig({ snapToGrid: v })}
            description="Align cells to grid when dragging"
          />

          {(config.showGrid || config.snapToGrid) && (
            <Slider
              label="Grid Size"
              value={config.gridSize}
              min={0.1}
              max={1.0}
              step={0.05}
              onChange={(v) => setConfig({ gridSize: v })}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Cell Names */}
      <CollapsibleSection title="Cell Names" badge={cells.length}>
        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
          {cells.map((cell, index) => (
            <div key={cell.id} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-4 text-right">{index + 1}</span>
              <input
                type="text"
                value={cell.label}
                onChange={(e) => setCellLabel(cell.id, e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
                placeholder={`Cell ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Session Management */}
      <div className="border-t border-gray-800 pt-3 mt-3">
        <Button
          onClick={() => {
            sessionStorage.removeItem('networkSessionData');
            console.log('Session data cleared');
            alert('Session data cleared. Refresh to start fresh.');
          }}
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          Clear Session Data
        </Button>
        <p className="text-[10px] text-gray-600 mt-2 text-center italic">
          Imported data persists until cleared
        </p>
      </div>
    </div>
  );

  const renderStyleTab = () => (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider px-2 py-1">Mitosis Style</div>
      {/* Connection Lines */}
      <CollapsibleSection title="Connection Lines" icon={Icons.link} defaultOpen>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Line Style</span>
            <LineStyleSelect
              value={config.lineStyle}
              onChange={(v) => setConfig({ lineStyle: v })}
            />
          </div>

          <Slider
            label="Line Width"
            value={config.lineWidth}
            min={0.5}
            max={4}
            step={0.1}
            onChange={(v) => setConfig({ lineWidth: v })}
            suffix="px"
          />

          <Slider
            label="Line Opacity"
            value={config.lineOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig({ lineOpacity: v })}
            suffix="%"
          />

          <Slider
            label="Overlap Opacity"
            value={config.lineOverlapOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig({ lineOverlapOpacity: v })}
            suffix="%"
          />

          <Toggle
            label="Width by Weight"
            value={config.lineWidthByWeight}
            onChange={(v) => setConfig({ lineWidthByWeight: v })}
            description="Thicker lines for heavier functions"
          />

          <Slider
            label="Width Variation"
            value={config.lineWidthJitter}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setConfig({ lineWidthJitter: v })}
          />

          <div className="space-y-1">
            <span className="text-xs text-gray-400">Connection Filter</span>
            <select
              value={config.connectionFilter}
              onChange={(e) => setConfig({ connectionFilter: e.target.value as FunctionType | 'all' })}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
            >
              {connectionFilterOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Circle Styles */}
      <CollapsibleSection title="Circle Outlines" icon={Icons.style}>
        <div className="space-y-4">
          {/* Living Circle */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-300">Living Circle</span>
            <Slider
              label="Outline Width"
              value={config.livingOutlineWidth}
              min={1}
              max={6}
              step={0.5}
              onChange={(v) => setConfig({ livingOutlineWidth: v })}
              suffix="px"
            />
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Outline Style</span>
              <LineStyleSelect
                value={config.livingOutlineStyle}
                onChange={(v) => setConfig({ livingOutlineStyle: v })}
              />
            </div>
          </div>

          {/* Function Circles */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-300">Function Circles</span>
            <Slider
              label="Outline Width"
              value={config.functionOutlineWidth}
              min={1}
              max={6}
              step={0.5}
              onChange={(v) => setConfig({ functionOutlineWidth: v })}
              suffix="px"
            />
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Outline Style</span>
              <LineStyleSelect
                value={config.functionOutlineStyle}
                onChange={(v) => setConfig({ functionOutlineStyle: v })}
              />
            </div>
          </div>

          {/* Cell Border */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-300">Cell Border</span>
            <Slider
              label="Border Width"
              value={config.cellOutlineWidth}
              min={1}
              max={6}
              step={0.5}
              onChange={(v) => setConfig({ cellOutlineWidth: v })}
              suffix="px"
            />
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Border Style</span>
              <LineStyleSelect
                value={config.cellOutlineStyle}
                onChange={(v) => setConfig({ cellOutlineStyle: v })}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Typography */}
      <CollapsibleSection title="Typography">
        <div className="space-y-3">
          <Slider
            label="Living Label Size"
            value={config.livingFontSize}
            min={8}
            max={24}
            step={1}
            onChange={(v) => setConfig({ livingFontSize: v })}
            suffix="px"
          />
          <Slider
            label="Function Label Size"
            value={config.functionFontSize}
            min={6}
            max={18}
            step={1}
            onChange={(v) => setConfig({ functionFontSize: v })}
            suffix="px"
          />
        </div>
      </CollapsibleSection>

      {/* Colors */}
      <CollapsibleSection title="Colors" icon={Icons.style}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ColorInput
              label="Living Fill"
              value={colors.living}
              onChange={(v) => setColors({ living: v })}
              onOpenModal={() => openColorModal('Living Fill', colors.living, (v) => setColors({ living: v }))}
            />
            <ColorInput
              label="Living Outline"
              value={colors.livingOutline}
              onChange={(v) => setColors({ livingOutline: v })}
              onOpenModal={() => openColorModal('Living Outline', colors.livingOutline, (v) => setColors({ livingOutline: v }))}
            />
            <ColorInput
              label="Living Text"
              value={colors.livingText}
              onChange={(v) => setColors({ livingText: v })}
              onOpenModal={() => openColorModal('Living Text', colors.livingText, (v) => setColors({ livingText: v }))}
            />
            <ColorInput
              label="Cell Border"
              value={colors.cellBorder}
              onChange={(v) => setColors({ cellBorder: v })}
              onOpenModal={() => openColorModal('Cell Border', colors.cellBorder, (v) => setColors({ cellBorder: v }))}
            />
            <ColorInput
              label="Background"
              value={colors.background}
              onChange={(v) => setColors({ background: v })}
              onOpenModal={() => openColorModal('Background', colors.background, (v) => setColors({ background: v }))}
            />
          </div>

          <Button onClick={randomizeColors} icon={Icons.shuffle} className="w-full">
            Randomize Colors
          </Button>
        </div>
      </CollapsibleSection>

      {/* Animation */}
      <CollapsibleSection title="Animation" icon={Icons.play}>
        <div className="space-y-3">
          <Slider
            label="Animation Duration"
            value={config.animationDuration}
            min={1}
            max={10}
            step={0.5}
            onChange={(v) => setConfig({ animationDuration: v })}
            suffix="s"
          />

          <div className="flex gap-2">
            <Button onClick={handlePlayAnimation} variant="primary" icon={Icons.play} className="flex-1">
              Play
            </Button>
            <Button
              onClick={handleExportGIF}
              disabled={isExportingGif}
              className="flex-1"
            >
              {isExportingGif ? `${gifProgress}%` : 'Export GIF'}
            </Button>
          </div>

          {isExportingGif && (
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-purple transition-all duration-100"
                style={{ width: `${gifProgress}%` }}
              />
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );

  const renderFunctionsTab = () => (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider px-2 py-1">Mitosis Functions</div>
      {/* Quick Labels */}
      <CollapsibleSection title="Living Circle Label" defaultOpen>
        <input
          type="text"
          value={config.livingLabel}
          onChange={(e) => setConfig({ livingLabel: e.target.value })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-accent-cyan"
          placeholder="Living"
        />
      </CollapsibleSection>

      {/* Functions List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-gray-400">Functions</span>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>Line</span>
            <span>Fill</span>
            <span>Text</span>
          </div>
        </div>

        <div className="space-y-1.5">
          {FUNCTION_TYPES.map((fn) => (
            <div key={fn} className="bg-gray-800/50 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                {/* Visibility Toggle */}
                <button
                  onClick={() => setFunctionVisible(fn, !config.functionVisible[fn])}
                  className={`p-1 rounded transition-colors ${
                    config.functionVisible[fn]
                      ? 'text-accent-cyan hover:text-cyan-300'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                  title={config.functionVisible[fn] ? 'Hide' : 'Show'}
                >
                  {config.functionVisible[fn] ? Icons.eye : Icons.eyeOff}
                </button>

                {/* Function Name */}
                <span className={`flex-1 text-sm ${config.functionVisible[fn] ? 'text-gray-300' : 'text-gray-500'}`}>
                  {FUNCTION_LABELS[fn]}
                </span>

                {/* Color Pickers */}
                <div className="flex gap-1.5">
                  <ColorPicker
                    value={colors.functions[fn]}
                    onChange={(v) => setFunctionColor(fn, v)}
                    label={`${FUNCTION_LABELS[fn]} Line`}
                    onOpenModal={() => openColorModal(`${FUNCTION_LABELS[fn]} Line`, colors.functions[fn], (v) => setFunctionColor(fn, v))}
                  />
                  <ColorPicker
                    value={colors.functionBackground[fn]}
                    onChange={(v) => setFunctionBackgroundColor(fn, v)}
                    label={`${FUNCTION_LABELS[fn]} Fill`}
                    onOpenModal={() => openColorModal(`${FUNCTION_LABELS[fn]} Fill`, colors.functionBackground[fn], (v) => setFunctionBackgroundColor(fn, v))}
                  />
                  <ColorPicker
                    value={colors.functionText[fn]}
                    onChange={(v) => setFunctionTextColor(fn, v)}
                    label={`${FUNCTION_LABELS[fn]} Text`}
                    onOpenModal={() => openColorModal(`${FUNCTION_LABELS[fn]} Text`, colors.functionText[fn], (v) => setFunctionTextColor(fn, v))}
                  />
                </div>
              </div>

              {/* Weight Slider & Label Input */}
              {config.functionVisible[fn] && (
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={config.functionLabels[fn]}
                    onChange={(e) => setFunctionLabel(fn, e.target.value)}
                    className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-gray-400 text-xs focus:outline-none focus:border-accent-cyan"
                    placeholder="Label"
                  />
                  <div className="flex items-center gap-1.5 w-24">
                    <input
                      type="range"
                      min={0.3}
                      max={2.0}
                      step={0.1}
                      value={config.functionWeights[fn]}
                      onChange={(e) => setFunctionWeight(fn, parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan"
                      title="Size Weight"
                    />
                    <span className="text-[10px] text-gray-500 w-6 text-right font-mono">
                      {config.functionWeights[fn].toFixed(1)}x
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-3">
      {/* Export Formats */}
      {/* Export Quality Configuration */}
      <CollapsibleSection title="Export Quality" icon={Icons.download} defaultOpen>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(exportQualityPresets) as Array<[typeof exportQuality, typeof exportQualityPresets[typeof exportQuality]]>).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => setExportQuality(key)}
                className={`p-2 rounded transition-all ${
                  exportQuality === key
                    ? 'bg-accent-cyan text-gray-900 ring-2 ring-accent-cyan'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
              >
                <div className="text-xs font-medium">{preset.label}</div>
                <div className="text-[10px] text-opacity-75 mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
            <strong>Selected:</strong> {exportQualityPresets[exportQuality].label} - {exportQualityPresets[exportQuality].dpi} DPI
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Export Image" icon={Icons.download} defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleExportPNG} variant="primary" className="justify-center">
            PNG ({exportQualityPresets[exportQuality].dpi} DPI)
          </Button>
          <Button
            onClick={async () => {
              const canvas = document.querySelector('[data-network-canvas]');
              if (canvas) await exportToPDF(canvas as HTMLCanvasElement, 'circle-network.pdf', exportQualityPresets[exportQuality].dpi);
            }}
            variant="primary"
            className="justify-center"
          >
            PDF ({exportQualityPresets[exportQuality].dpi} DPI)
          </Button>
          <Button onClick={handleExportSVG} variant="primary" className="justify-center">
            SVG (Vector)
          </Button>
          <Button onClick={handleExportGIF} disabled={isExportingGif} className="justify-center">
            {isExportingGif ? `GIF ${gifProgress}%` : 'Animated GIF'}
          </Button>
        </div>

        {isExportingGif && (
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-accent-purple transition-all duration-100"
              style={{ width: `${gifProgress}%` }}
            />
          </div>
        )}
      </CollapsibleSection>

      {/* Data Export */}
      <CollapsibleSection title="Export Data" icon={Icons.save}>
        <div className="space-y-2">
          <Button onClick={handleExportJSON} icon={Icons.download} className="w-full justify-center">
            Export JSON
          </Button>
          <Button onClick={handleShare} icon={Icons.link} className="w-full justify-center">
            Copy Share URL
          </Button>
          <Button
            onClick={async () => {
              const canvas = document.querySelector('[data-network-canvas]') as HTMLCanvasElement;
              if (canvas) {
                await exportToPNG(canvas, 'circle-network-print.png', exportQualityPresets[exportQuality].dpi);
                setTimeout(() => window.print(), 100);
              }
            }}
            className="w-full justify-center"
          >
            Print / PDF ({exportQualityPresets[exportQuality].dpi} DPI)
          </Button>
        </div>
      </CollapsibleSection>

      {/* Import */}
      <CollapsibleSection title="Import" icon={Icons.upload}>
        <input ref={jsonInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
        <input ref={csvInputRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
        <input ref={excelInputRef} type="file" accept=".xlsx" onChange={handleImportExcel} className="hidden" />

        <div className="space-y-2">
          <Button onClick={() => jsonInputRef.current?.click()} icon={Icons.upload} className="w-full justify-center">
            Import JSON
          </Button>
          <Button onClick={() => csvInputRef.current?.click()} icon={Icons.upload} className="w-full justify-center">
            Import CSV
          </Button>
          <Button onClick={() => excelInputRef.current?.click()} icon={Icons.upload} className="w-full justify-center">
            Import Excel (.xlsx)
          </Button>

          <div className="text-[10px] text-gray-500 mt-3 pt-2 border-t border-gray-700">
            <p className="text-gray-400 font-medium mb-1">Download Templates:</p>
            <div className="space-y-1">
              <Button onClick={handleDownloadSimpleTemplate} variant="secondary" className="w-full justify-center text-xs py-1">
                Simple Template
              </Button>
              <Button onClick={handleDownloadDetailedTemplate} variant="secondary" className="w-full justify-center text-xs py-1">
                Detailed Template
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 text-center mt-2">
            CSV format: x, y columns (0-1 range), optional label
          </p>
        </div>
      </CollapsibleSection>

      {/* Presets */}
      <CollapsibleSection title="Presets" icon={Icons.save} badge={presets.length || undefined}>
        <div className="space-y-2">
          {showPresetInput ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                placeholder="Preset name..."
                className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
                autoFocus
              />
              <Button onClick={handleSavePreset} variant="primary" className="px-2">
                Save
              </Button>
              <Button onClick={() => { setShowPresetInput(false); setPresetName(''); }} className="px-2">
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowPresetInput(true)} variant="primary" icon={Icons.save} className="w-full justify-center">
              Save Current Preset
            </Button>
          )}

          {presets.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1 mt-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1.5 p-1.5 bg-gray-800/50 rounded group">
                  <button
                    onClick={() => loadPreset(preset.id)}
                    className="flex-1 text-left text-xs text-gray-400 hover:text-white truncate"
                  >
                    {preset.name}
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    {Icons.trash}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Danger Zone */}
      <div className="pt-3 border-t border-gray-700/50">
        <Button onClick={reset} variant="danger" icon={Icons.trash} className="w-full justify-center">
          Reset to Defaults
        </Button>
      </div>
    </div>
  );

  // ============================================================================
  // BAUBLE GRAPH TAB
  // ============================================================================

  const {
    files,
    graph,
    config: baubleConfig,
    addFile,
    removeFile,
    renameMotherLabel,
    deleteAllFiles,
    setRootEnabled,
    setRootLabel,
    regenerateLayout: regenerateBaubleLayout,
    setConfig: setBaubleConfig,
    setNodeColor,
    loadFromExport,
    undo: undoBauble,
    redo: redoBauble,
    canUndo: canUndoBauble,
    canRedo: canRedoBauble,
  } = useBaubleStore();



  const baubleFileInputRef = useRef<HTMLInputElement>(null);
  const baubleImportRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; parsed: LoadedBaubleFile }[] | null>(null);
  const [selectedParentChildNodeId, setSelectedParentChildNodeId] = useState<string>('');
  const [sheetSelectionDialogOpen, setSheetSelectionDialogOpen] = useState(false);
  const [pendingFileForSheetSelection, setPendingFileForSheetSelection] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [columnSelectionDialogOpen, setColumnSelectionDialogOpen] = useState(false);
  const [pendingFileForColumnSelection, setPendingFileForColumnSelection] = useState<File | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedSheetForColumn, setSelectedSheetForColumn] = useState<string>('');

  const [deleteAllFilesConfirmOpen, setDeleteAllFilesConfirmOpen] = useState(false);

  const handleBaubleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    // For single file, check if it has multiple sheets
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      const sheets = await getExcelSheetNames(file);

      if (sheets.length > 1) {
        // Show sheet selection dialog
        setPendingFileForSheetSelection(file);
        setAvailableSheets(sheets);
        setSelectedSheet(sheets[0]);
        setSheetSelectionDialogOpen(true);

        // Reset input
        if (baubleFileInputRef.current) {
          baubleFileInputRef.current.value = '';
        }
        return;
      }
    }

    // For single-sheet file, ask about column selection
    if (selectedFiles.length === 1) {
      const file = selectedFiles[0];
      const columns = await getExcelColumnHeaders(file);
      if (columns.length > 0) {
        // Show column selection dialog
        setPendingFileForColumnSelection(file);
        setSelectedSheetForColumn('');
        setAvailableColumns(columns);
        setSelectedColumn(columns[0]);
        setColumnSelectionDialogOpen(true);

        // Reset input
        if (baubleFileInputRef.current) {
          baubleFileInputRef.current.value = '';
        }
        return;
      }
    }

    // Process files normally (multiple files)
    const parsedFiles: { file: File; parsed: LoadedBaubleFile }[] = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const result = await parseBaubleExcelFile(file);
      if (result) {
        const { result: loadedFile, errors } = result;
        if (errors.length > 0) {
          console.warn(`Warnings importing ${file.name}:`, errors);
        }
        parsedFiles.push({ file, parsed: loadedFile });
      } else {
        failedFiles.push(file.name);
      }
    }

    if (failedFiles.length > 0) {
      alert(`Failed to parse: ${failedFiles.join(', ')}`);
    }

    if (parsedFiles.length > 0) {
      setPendingFiles(parsedFiles);
      setSelectedParentChildNodeId('');
    }

    // Reset input
    if (baubleFileInputRef.current) {
      baubleFileInputRef.current.value = '';
    }
  };

  const handleConfirmSheetSelection = async () => {
    if (!pendingFileForSheetSelection) return;

    // Get available columns for the selected sheet
    const columns = await getExcelColumnHeaders(pendingFileForSheetSelection, selectedSheet);
    if (columns.length === 0) {
      alert('Could not read columns from selected sheet');
      return;
    }

    // Show column selection dialog
    setPendingFileForColumnSelection(pendingFileForSheetSelection);
    setSelectedSheetForColumn(selectedSheet);
    setAvailableColumns(columns);
    setSelectedColumn(columns[0]); // Default to first column
    setColumnSelectionDialogOpen(true);
    setSheetSelectionDialogOpen(false);
  };

  const handleConfirmColumnSelection = async () => {
    if (!pendingFileForColumnSelection) return;

    const result = await parseBaubleExcelFile(
      pendingFileForColumnSelection,
      selectedSheetForColumn,
      selectedColumn,
      selectedSheetForColumn // Use sheet name as mother label
    );
    if (result) {
      const { result: loadedFile, errors } = result;
      if (errors.length > 0) {
        console.warn(`Warnings importing ${pendingFileForColumnSelection.name}:`, errors);
      }
      setPendingFiles([{ file: pendingFileForColumnSelection, parsed: loadedFile }]);
      setSelectedParentChildNodeId('');
    } else {
      alert('Failed to parse selected column');
    }

    setColumnSelectionDialogOpen(false);
    setPendingFileForColumnSelection(null);
    setSelectedSheetForColumn('');
    setAvailableColumns([]);
    setSelectedColumn('');

    // Reset input
    if (baubleFileInputRef.current) {
      baubleFileInputRef.current.value = '';
    }
  };

  const handleConfirmFiles = () => {
    if (!pendingFiles) return;

    pendingFiles.forEach((fileData) => {
      const fileToAdd = { ...fileData.parsed };
      if (selectedParentChildNodeId) {
        fileToAdd.parentChildNodeId = selectedParentChildNodeId;
      }
      addFile(fileToAdd);
    });

    setPendingFiles(null);
    setSelectedParentChildNodeId('');
  };

  const handleExportBaubleGraph = () => {
    const jsonString = exportBaubleGraphToJSON(files, graph, baubleConfig);
    downloadBaubleGraphJSON(jsonString, 'bauble-graph.json');
  };

  const handleImportBaubleGraph = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const jsonString = event.target?.result as string;
      const imported = importBaubleGraphFromJSON(jsonString);

      if (imported) {
        loadFromExport(imported.files, imported.config, imported.nodeColors, imported.nodePositions);
        alert('Bauble graph imported successfully!');
      } else {
        alert('Failed to import bauble graph. Invalid JSON format.');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (baubleImportRef.current) {
      baubleImportRef.current.value = '';
    }
  };

  const renderGraphTab = () => (
    <div className="space-y-3">
      {/* Camera Controls for Graph Navigation */}
      <CameraControls
        title="Graph Navigation"
        showPanControls={true}
        showZoomControls={true}
        showResetControls={true}
        panStep={30}
      />

      <div className="text-xs font-semibold text-accent-purple uppercase tracking-wider px-2 py-1">Graph Controls</div>
      {/* Root Node */}
      <CollapsibleSection title="Root Node" defaultOpen>
        <Toggle
          label="Enable Root Node"
          value={baubleConfig.rootEnabled}
          onChange={setRootEnabled}
        />
        {baubleConfig.rootEnabled && (
          <div className="space-y-2">
            <input
              type="text"
              value={baubleConfig.rootLabel}
              onChange={(e) => setRootLabel(e.target.value)}
              placeholder="God node name"
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-1">Color:</span>
              <button
                onClick={() => {
                  const godNode = graph.nodes.find((n) => n.id === 'root');
                  if (godNode) {
                    openColorModal('Root Node Color', godNode.color, (color) =>
                      setNodeColor('god', color)
                    );
                  }
                }}
                className="w-10 h-6 rounded border border-gray-600 transition-colors hover:border-accent-cyan"
                style={{
                  backgroundColor: graph.nodes.find((n) => n.id === 'root')?.color || baubleConfig.rootColor,
                }}
              />
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Loaded Files / Mother Nodes */}
      <CollapsibleSection title="Mother Nodes" badge={files.length || undefined} defaultOpen>
        {files.length === 0 && (
          <p className="text-xs text-gray-500 italic">No files loaded yet</p>
        )}
        <div className="space-y-2">
          {files.map((file) => {
            const isRootMother = !file.parentChildNodeId;
            const motherIndex = files.filter((f) => !f.parentChildNodeId).indexOf(file);
            const motherNode = isRootMother
              ? graph.nodes.find((n) => n.id === `mother-${motherIndex}`)
              : null;
            const parentMother = file.parentChildNodeId
              ? files.find((f) => f.fileId === file.parentChildNodeId)
              : null;

            return (
              <div
                key={file.fileId}
                className={`flex items-center gap-2 p-2 rounded ${
                  isRootMother ? 'bg-gray-800/50' : 'bg-gray-800/30 ml-4 border-l-2 border-gray-600'
                }`}
              >
                <input
                  type="text"
                  value={file.motherLabel}
                  onChange={(e) => renameMotherLabel(file.fileId, e.target.value)}
                  className="flex-1 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
                />
                {isRootMother && (
                  <button
                    onClick={() => {
                      if (motherNode) {
                        openColorModal(`Color: ${file.motherLabel}`, motherNode.color, (color) =>
                          setNodeColor(motherNode.id, color)
                        );
                      }
                    }}
                    className="w-6 h-6 rounded border border-gray-600 transition-colors hover:border-accent-cyan"
                    style={{
                      backgroundColor: motherNode?.color || baubleConfig.motherColor,
                    }}
                    title="Change color"
                  />
                )}
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {file.childNames.length} {file.childNames.length === 1 ? 'child' : 'children'}
                </span>
                {parentMother && (
                  <span className="text-[10px] text-gray-600 italic">
                    → {parentMother.motherLabel}
                  </span>
                )}
                <button
                  onClick={() => removeFile(file.fileId)}
                  className="text-red-400 hover:text-red-300 text-sm"
                  title="Remove file"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        {files.length > 0 && (
          <button
            onClick={() => setDeleteAllFilesConfirmOpen(true)}
            className="w-full mt-2 px-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-700 rounded text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
            title="Delete all mother nodes"
          >
            Delete All
          </button>
        )}
      </CollapsibleSection>

      {/* Load Files */}
      <CollapsibleSection title="Load Excel Files" defaultOpen>
        <input
          ref={baubleFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={handleBaubleFileSelect}
          className="hidden"
        />
        <Button
          onClick={() => baubleFileInputRef.current?.click()}
          icon={Icons.upload}
          className="w-full justify-center"
        >
          Load Excel Files
        </Button>
        <p className="text-[10px] text-gray-500 text-center mt-2">
          Create new mothers or link files to existing mothers.
        </p>
      </CollapsibleSection>

      {/* Sheet Selection Dialog */}
      {sheetSelectionDialogOpen && availableSheets.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm mx-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">
              Select Sheet to Import
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              {pendingFileForSheetSelection?.name} has multiple sheets. Which one would you like to import?
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">
                  Available Sheets:
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
                >
                  {availableSheets.map((sheet) => (
                    <option key={sheet} value={sheet}>
                      {sheet}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmSheetSelection}
                  variant="primary"
                  className="flex-1 justify-center"
                >
                  Next
                </Button>
                <Button
                  onClick={() => {
                    setSheetSelectionDialogOpen(false);
                    setPendingFileForSheetSelection(null);
                    setAvailableSheets([]);
                    setSelectedSheet('');
                    if (baubleFileInputRef.current) {
                      baubleFileInputRef.current.value = '';
                    }
                  }}
                  className="flex-1 justify-center"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Column Selection Dialog */}
      {columnSelectionDialogOpen && availableColumns.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm mx-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">
              Select Column for Names
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Which column contains the names/items you want to import?
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">
                  Available Columns:
                </label>
                <select
                  value={selectedColumn}
                  onChange={(e) => setSelectedColumn(e.target.value)}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
                >
                  {availableColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmColumnSelection}
                  variant="primary"
                  className="flex-1 justify-center"
                >
                  Continue
                </Button>
                <Button
                  onClick={() => {
                    setColumnSelectionDialogOpen(false);
                    setPendingFileForColumnSelection(null);
                    setSelectedSheetForColumn('');
                    setAvailableColumns([]);
                    setSelectedColumn('');
                    if (baubleFileInputRef.current) {
                      baubleFileInputRef.current.value = '';
                    }
                  }}
                  className="flex-1 justify-center"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Link Dialog - Batch */}
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm mx-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">
              Import {pendingFiles.length} Excel File{pendingFiles.length > 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Create all as new mothers or link them all to an existing one?
            </p>

            {/* File List */}
            <div className="bg-gray-800/50 rounded p-2 mb-4 max-h-32 overflow-y-auto">
              {pendingFiles.map((fileData, idx) => (
                <div key={idx} className="text-xs text-gray-400 py-1">
                  • {fileData.file.name}
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-2">
                  {selectedParentChildNodeId ? 'Link all to Child:' : 'Create all as:'}
                </label>
                <select
                  value={selectedParentChildNodeId}
                  onChange={(e) => setSelectedParentChildNodeId(e.target.value)}
                  className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
                >
                  <option value="">New Mother Nodes</option>
                  {graph.nodes
                    .filter((n) => n.kind === 'child')
                    .map((child) => {
                      const motherNode = graph.nodes.find((n) => n.id.startsWith('mother-'));
                      const motherLabel = motherNode?.label || 'Unknown';
                      return (
                        <option key={child.id} value={child.id}>
                          Grandchild of {motherLabel} → {child.label}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmFiles}
                  variant="primary"
                  className="flex-1 justify-center"
                >
                  Import
                </Button>
                <Button
                  onClick={() => {
                    setPendingFiles(null);
                    setSelectedParentChildNodeId('');
                  }}
                  className="flex-1 justify-center"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Files Confirmation Dialog */}
      {deleteAllFilesConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm mx-4 border border-red-700">
            <h3 className="text-sm font-semibold text-red-400 mb-3">
              Delete All Mother Nodes?
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              This will remove all {files.length} loaded file{files.length > 1 ? 's' : ''} and their associated data. This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  deleteAllFiles();
                  setDeleteAllFilesConfirmOpen(false);
                }}
                variant="primary"
                className="flex-1 justify-center bg-red-900 hover:bg-red-800 border border-red-700"
              >
                Delete All
              </Button>
              <Button
                onClick={() => setDeleteAllFilesConfirmOpen(false)}
                className="flex-1 justify-center"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Layout Controls */}
      <CollapsibleSection title="Layout" defaultOpen>
        <div className="space-y-3">
          {/* Layout Type Selection */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Layout Algorithm</label>
            <select
              value={baubleConfig.layoutType}
              onChange={(e) => {
                setBaubleConfig({ layoutType: e.target.value as any });
                setTimeout(regenerateBaubleLayout, 0);
              }}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
            >
              <option value="circular">Circular</option>
              <option value="random">Random</option>
              <option value="circlepack">CirclePack</option>
              <option value="hierarchy">Hierarchy (Tree)</option>
              <option value="radialhierarchy">Radial Hierarchy (Diamond)</option>
              <option value="forcedirected">Force Directed</option>
              <option value="forceatlas2">ForceAtlas2</option>
              <option value="noverlap">Noverlap</option>
            </select>
          </div>

          {/* Circular & Random: Center + Scale */}
          {(baubleConfig.layoutType === 'circular' || baubleConfig.layoutType === 'random') && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">
                  Center: {baubleConfig.layoutCenter.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={baubleConfig.layoutCenter}
                  onChange={(e) => {
                    setBaubleConfig({ layoutCenter: parseFloat(e.target.value) });
                    setTimeout(regenerateBaubleLayout, 0);
                  }}
                  className="w-full accent-accent-cyan"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">
                  Scale: {baubleConfig.layoutScale.toFixed(0)}
                </label>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={baubleConfig.layoutScale}
                  onChange={(e) => {
                    setBaubleConfig({ layoutScale: parseFloat(e.target.value) });
                    setTimeout(regenerateBaubleLayout, 0);
                  }}
                  className="w-full accent-accent-cyan"
                />
              </div>
            </>
          )}

          {/* CirclePack: Scale only */}
          {baubleConfig.layoutType === 'circlepack' && (
            <div className="space-y-1">
              <label className="text-xs text-gray-400">
                Scale: {baubleConfig.circlePackScale.toFixed(2)}
              </label>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                value={baubleConfig.circlePackScale}
                onChange={(e) => {
                  setBaubleConfig({ circlePackScale: parseFloat(e.target.value) });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
                className="w-full accent-accent-cyan"
              />
            </div>
          )}

          {/* Force Directed parameters */}
          {baubleConfig.layoutType === 'forcedirected' && (
            <>
              <SliderWithInput
                label="Attraction"
                value={baubleConfig.forceDirectedAttraction}
                min={0.00001}
                max={0.01}
                step={0.00001}
                onChange={(value) => {
                  setBaubleConfig({ forceDirectedAttraction: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Repulsion"
                value={baubleConfig.forceDirectedRepulsion}
                min={0.01}
                max={1}
                step={0.01}
                onChange={(value) => {
                  setBaubleConfig({ forceDirectedRepulsion: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Gravity"
                value={baubleConfig.forceDirectedGravity}
                min={0.00001}
                max={0.1}
                step={0.00001}
                onChange={(value) => {
                  setBaubleConfig({ forceDirectedGravity: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Inertia"
                value={baubleConfig.forceDirectedInertia}
                min={0}
                max={1}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ forceDirectedInertia: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Maximum Move"
                value={baubleConfig.forceDirectedMaxMove}
                min={10}
                max={500}
                step={10}
                onChange={(value) => {
                  setBaubleConfig({ forceDirectedMaxMove: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
            </>
          )}

          {/* ForceAtlas2 parameters */}
          {baubleConfig.layoutType === 'forceatlas2' && (
            <>
              <SliderWithInput
                label="Gravity"
                value={baubleConfig.forceAtlas2Gravity}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2Gravity: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Edge Weight Influence"
                value={baubleConfig.forceAtlas2EdgeWeightInfluence}
                min={0}
                max={5}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2EdgeWeightInfluence: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Scaling Ratio"
                value={baubleConfig.forceAtlas2ScalingRatio}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2ScalingRatio: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Barnes Hut Theta"
                value={baubleConfig.forceAtlas2BarnesHutTheta}
                min={0.1}
                max={2}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2BarnesHutTheta: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Slow Down"
                value={baubleConfig.forceAtlas2SlowDown}
                min={0.1}
                max={10}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2SlowDown: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <Toggle
                label="Adjust Sizes"
                value={baubleConfig.forceAtlas2AdjustSizes}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2AdjustSizes: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <Toggle
                label="Barnes Hut Optimize"
                value={baubleConfig.forceAtlas2BarnesHutOptimize}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2BarnesHutOptimize: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <Toggle
                label="Lin-Log Mode"
                value={baubleConfig.forceAtlas2LinLogMode}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2LinLogMode: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <Toggle
                label="Strong Gravity Mode"
                value={baubleConfig.forceAtlas2StrongGravityMode}
                onChange={(value) => {
                  setBaubleConfig({ forceAtlas2StrongGravityMode: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
            </>
          )}

          {/* Noverlap parameters */}
          {baubleConfig.layoutType === 'noverlap' && (
            <>
              <SliderWithInput
                label="Grid Size"
                value={baubleConfig.noverlabGridSize}
                min={5}
                max={100}
                step={5}
                onChange={(value) => {
                  setBaubleConfig({ noverlabGridSize: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Margin"
                value={baubleConfig.noverlabMargin}
                min={1}
                max={50}
                step={1}
                onChange={(value) => {
                  setBaubleConfig({ noverlabMargin: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Expansion"
                value={baubleConfig.noverlabExpansion}
                min={1.0}
                max={3.0}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ noverlabExpansion: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Ratio"
                value={baubleConfig.noverlabRatio}
                min={0.1}
                max={5}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ noverlabRatio: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Speed"
                value={baubleConfig.noverlabSpeed}
                min={1}
                max={20}
                step={1}
                onChange={(value) => {
                  setBaubleConfig({ noverlabSpeed: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
            </>
          )}

          {/* Hierarchy (Tree) parameters */}
          {baubleConfig.layoutType === 'hierarchy' && (
            <>
              <SliderWithInput
                label="Vertical Spacing"
                value={baubleConfig.hierarchyVerticalSpacing}
                min={0.5}
                max={3}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ hierarchyVerticalSpacing: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Horizontal Spacing"
                value={baubleConfig.hierarchyHorizontalSpacing}
                min={0.3}
                max={2}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ hierarchyHorizontalSpacing: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Node Spacing"
                value={baubleConfig.hierarchyNodeSpacing}
                min={0.2}
                max={1.5}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ hierarchyNodeSpacing: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
            </>
          )}

          {/* Radial Hierarchy (Diamond) parameters */}
          {baubleConfig.layoutType === 'radialhierarchy' && (
            <>
              <SliderWithInput
                label="Base Radius"
                value={baubleConfig.radialHierarchyRadius}
                min={0.5}
                max={3}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ radialHierarchyRadius: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Angular Spread (°)"
                value={baubleConfig.radialHierarchyAngularSpread}
                min={15}
                max={180}
                step={5}
                onChange={(value) => {
                  setBaubleConfig({ radialHierarchyAngularSpread: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
              <SliderWithInput
                label="Level Expansion"
                value={baubleConfig.radialHierarchyLevelExpansion}
                min={1.0}
                max={3}
                step={0.1}
                onChange={(value) => {
                  setBaubleConfig({ radialHierarchyLevelExpansion: value });
                  setTimeout(regenerateBaubleLayout, 0);
                }}
              />
            </>
          )}

          {/* Regenerate Button */}
          <Button
            onClick={regenerateBaubleLayout}
            className="w-full justify-center"
          >
            Regenerate Layout
          </Button>
        </div>
      </CollapsibleSection>

      {/* Style */}
      <CollapsibleSection title="Style">
        <div className="space-y-3">
          {/* Colors */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Root Color</label>
            <button
              onClick={() =>
                openColorModal('Root Node Color', baubleConfig.rootColor, (color) =>
                  setBaubleConfig({ rootColor: color })
                )
              }
              className="w-full h-8 rounded border border-gray-700 transition-colors hover:border-accent-cyan"
              style={{ backgroundColor: baubleConfig.rootColor }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Mother Color</label>
            <button
              onClick={() =>
                openColorModal('Mother Node Color', baubleConfig.motherColor, (color) =>
                  setBaubleConfig({ motherColor: color })
                )
              }
              className="w-full h-8 rounded border border-gray-700 transition-colors hover:border-accent-cyan"
              style={{ backgroundColor: baubleConfig.motherColor }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Child Color</label>
            <button
              onClick={() =>
                openColorModal('Child Node Color', baubleConfig.childColor, (color) =>
                  setBaubleConfig({ childColor: color })
                )
              }
              className="w-full h-8 rounded border border-gray-700 transition-colors hover:border-accent-cyan"
              style={{ backgroundColor: baubleConfig.childColor }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Grandchild Color</label>
            <button
              onClick={() =>
                openColorModal('Grandchild Node Color', baubleConfig.grandchildColor, (color) =>
                  setBaubleConfig({ grandchildColor: color })
                )
              }
              className="w-full h-8 rounded border border-gray-700 transition-colors hover:border-accent-cyan"
              style={{ backgroundColor: baubleConfig.grandchildColor }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Background Color</label>
            <button
              onClick={() =>
                openColorModal('Background Color', baubleConfig.backgroundColor || '#1a1a1a', (color) =>
                  setBaubleConfig({ backgroundColor: color })
                )
              }
              className="w-full h-8 rounded border border-gray-700 transition-colors hover:border-accent-cyan"
              style={{ backgroundColor: baubleConfig.backgroundColor || '#1a1a1a' }}
            />
          </div>

          <Slider
            label="Edge Width"
            value={baubleConfig.edgeWidth}
            min={0.5}
            max={5}
            step={0.5}
            onChange={(value) => setBaubleConfig({ edgeWidth: value })}
          />
          <Toggle
            label="Show Labels"
            value={baubleConfig.showLabels}
            onChange={(value) => setBaubleConfig({ showLabels: value })}
          />
          <Slider
            label="Mother Circle Size"
            value={baubleConfig.motherRadiusMultiplier}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={(value) => setBaubleConfig({ motherRadiusMultiplier: value })}
          />
          <Slider
            label="Child Circle Size"
            value={baubleConfig.childRadiusMultiplier}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={(value) => setBaubleConfig({ childRadiusMultiplier: value })}
          />
          <Slider
            label="Grandchild Circle Size"
            value={baubleConfig.grandchildRadiusMultiplier}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={(value) => setBaubleConfig({ grandchildRadiusMultiplier: value })}
          />

          {/* Root Node Font */}
          <div className="border-t border-gray-700 pt-3 mt-2">
            <p className="text-xs text-gray-400 font-medium mb-2">Root Node Font</p>
            <Select
              label="Font Family"
              value={baubleConfig.rootFontFamily}
              options={['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']}
              onChange={(value) => setBaubleConfig({ rootFontFamily: value })}
            />
            <SliderWithInput
              label="Font Size (px)"
              value={baubleConfig.rootFontSize}
              min={8}
              max={20}
              step={1}
              onChange={(value) => setBaubleConfig({ rootFontSize: value })}
            />
          </div>

          {/* Mother Node Font */}
          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 font-medium mb-2">Mother Node Font</p>
            <Select
              label="Font Family"
              value={baubleConfig.motherFontFamily}
              options={['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']}
              onChange={(value) => setBaubleConfig({ motherFontFamily: value })}
            />
            <SliderWithInput
              label="Font Size (px)"
              value={baubleConfig.motherFontSize}
              min={8}
              max={20}
              step={1}
              onChange={(value) => setBaubleConfig({ motherFontSize: value })}
            />
          </div>

          {/* Child Node Font */}
          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 font-medium mb-2">Child Node Font</p>
            <Select
              label="Font Family"
              value={baubleConfig.childFontFamily}
              options={['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']}
              onChange={(value) => setBaubleConfig({ childFontFamily: value })}
            />
            <SliderWithInput
              label="Font Size (px)"
              value={baubleConfig.childFontSize}
              min={8}
              max={20}
              step={1}
              onChange={(value) => setBaubleConfig({ childFontSize: value })}
            />
          </div>

          {/* Grandchild Node Font */}
          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 font-medium mb-2">Grandchild Node Font</p>
            <Select
              label="Font Family"
              value={baubleConfig.grandchildFontFamily}
              options={['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']}
              onChange={(value) => setBaubleConfig({ grandchildFontFamily: value })}
            />
            <SliderWithInput
              label="Font Size (px)"
              value={baubleConfig.grandchildFontSize}
              min={8}
              max={20}
              step={1}
              onChange={(value) => setBaubleConfig({ grandchildFontSize: value })}
            />
          </div>

          {/* Text Position */}
          <div className="border-t border-gray-700 pt-3 mt-3">
            <p className="text-xs text-gray-400 font-medium mb-2">Text Position</p>

            {/* Set All Button */}
            <div className="mb-3 p-2 bg-gray-800/50 rounded">
              <label className="text-xs text-gray-500 block mb-2">Apply to All Node Types:</label>
              <div className="flex gap-1">
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() =>
                      setBaubleConfig({
                        rootTextPosition: pos,
                        motherTextPosition: pos,
                        childTextPosition: pos,
                        grandchildTextPosition: pos,
                      })
                    }
                    className="flex-1 px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-gray-300 hover:text-white transition-colors capitalize"
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Node Type Controls */}
            <div className="space-y-2">
              <Select
                label="Root Node Text"
                value={baubleConfig.rootTextPosition}
                options={['top', 'bottom', 'left', 'right']}
                onChange={(value) => setBaubleConfig({ rootTextPosition: value as 'top' | 'bottom' | 'left' | 'right' })}
              />
              <Select
                label="Mother Node Text"
                value={baubleConfig.motherTextPosition}
                options={['top', 'bottom', 'left', 'right']}
                onChange={(value) => setBaubleConfig({ motherTextPosition: value as 'top' | 'bottom' | 'left' | 'right' })}
              />
              <Select
                label="Child Node Text"
                value={baubleConfig.childTextPosition}
                options={['top', 'bottom', 'left', 'right']}
                onChange={(value) => setBaubleConfig({ childTextPosition: value as 'top' | 'bottom' | 'left' | 'right' })}
              />
              <Select
                label="Grandchild Node Text"
                value={baubleConfig.grandchildTextPosition}
                options={['top', 'bottom', 'left', 'right']}
                onChange={(value) => setBaubleConfig({ grandchildTextPosition: value as 'top' | 'bottom' | 'left' | 'right' })}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Connections */}
      <CollapsibleSection title="Connections" defaultOpen>
        <div className="space-y-2">
          <Toggle
            label="Root → Mother Connections"
            value={baubleConfig.showRootToMotherConnections}
            onChange={(value) => setBaubleConfig({ showRootToMotherConnections: value })}
          />
          <Toggle
            label="Mother → Child Connections"
            value={baubleConfig.showMotherToChildConnections}
            onChange={(value) => setBaubleConfig({ showMotherToChildConnections: value })}
          />
          <Toggle
            label="Mother ↔ Mother Connections"
            value={baubleConfig.showMotherToMotherConnections}
            onChange={(value) => setBaubleConfig({ showMotherToMotherConnections: value })}
          />
          <Toggle
            label="Child → Grandchild Connections"
            value={baubleConfig.showChildToGrandchildConnections}
            onChange={(value) => setBaubleConfig({ showChildToGrandchildConnections: value })}
          />
        </div>
      </CollapsibleSection>

      {/* Import/Export */}
      <CollapsibleSection title="Import/Export" defaultOpen>
        <div className="space-y-2">
          {/* JSON Export/Import */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold">Graph Data</p>
            <Button
              onClick={handleExportBaubleGraph}
              icon={Icons.download}
              className="w-full justify-center"
            >
              Export Graph (JSON)
            </Button>
            <input
              ref={baubleImportRef}
              type="file"
              accept=".json"
              onChange={handleImportBaubleGraph}
              className="hidden"
            />
            <Button
              onClick={() => baubleImportRef.current?.click()}
              icon={Icons.upload}
              className="w-full justify-center"
            >
              Import Graph (JSON)
            </Button>
          </div>

          {/* Image/Vector Export */}
          <div className="space-y-2 pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-400 font-semibold">Visualizations</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  console.log('PNG export button clicked');
                  const canvas =
                    document.querySelector('[data-bauble-canvas]') as HTMLCanvasElement ||
                    document.querySelector('[data-network-canvas-3d]') as HTMLCanvasElement ||
                    document.querySelector('[data-network-canvas]') as HTMLCanvasElement;

                  console.log('Canvas found:', canvas, 'Dimensions:', canvas?.width, 'x', canvas?.height);

                  if (canvas && canvas.width > 0 && canvas.height > 0) {
                    exportBaubleGraphToPNG(canvas, 'bauble-graph.png', exportQualityPresets[exportQuality].dpi);
                  } else {
                    alert('❌ Canvas not found or invalid - make sure the visualization is loaded');
                  }
                }}
                className="w-full justify-center text-xs"
              >
                PNG
              </Button>
              <Button
                onClick={() => {
                  const canvas =
                    document.querySelector('[data-bauble-canvas]') as HTMLCanvasElement ||
                    document.querySelector('[data-network-canvas-3d]') as HTMLCanvasElement ||
                    document.querySelector('[data-network-canvas]') as HTMLCanvasElement;

                  if (canvas) {
                    exportBaubleGraphToPDF(canvas, 'bauble-graph.pdf', exportQualityPresets[exportQuality].dpi);
                  } else {
                    alert('❌ Canvas not found - make sure the visualization is loaded');
                  }
                }}
                className="w-full justify-center text-xs"
              >
                PDF
              </Button>
              <Button
                onClick={() => {
                  const svg = exportBaubleGraphToSVG(graph, baubleConfig, 1200, 1200);
                  downloadBaubleGraphSVG(svg, 'bauble-graph.svg');
                }}
                className="w-full justify-center text-xs"
              >
                SVG
              </Button>
              <Button
                onClick={() => {
                  const json = exportBaubleGraphToJSON(files, graph, baubleConfig);
                  downloadBaubleGraphJSON(json, 'bauble-graph.json');
                }}
                className="w-full justify-center text-xs"
              >
                JSON
              </Button>
            </div>
            <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
              <strong>Quality:</strong> {exportQualityPresets[exportQuality].label} ({exportQualityPresets[exportQuality].dpi} DPI)
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Stats - Show appropriate stats based on active mode */}
      {activeTab === 'graph' && (
        <CollapsibleSection title="Graph Statistics">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Total Nodes:</span>
              <span className="text-gray-300 font-mono">{graph.nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Edges:</span>
              <span className="text-gray-300 font-mono">{graph.edges.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Mother Nodes:</span>
              <span className="text-gray-300 font-mono">{files.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Children:</span>
              <span className="text-gray-300 font-mono">
                {files.reduce((sum, f) => sum + f.childNames.length, 0)}
              </span>
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className={`flex-shrink-0 px-4 py-3 border-b ${UI_STYLES.colors.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={UI_STYLES.typography.heading}>Science Figure Studio</h1>
            <p className={UI_STYLES.typography.caption}>Network Visualization</p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon={Icons.undo}
              onClick={() => {
                if (activeTab === 'graph') {
                  undoBauble();
                } else {
                  undo();
                }
              }}
              disabled={activeTab === 'graph' ? !canUndoBauble : !canUndo}
              title="Undo (Ctrl+Z)"
            />
            <IconButton
              icon={Icons.redo}
              onClick={() => {
                if (activeTab === 'graph') {
                  redoBauble();
                } else {
                  redo();
                }
              }}
              disabled={activeTab === 'graph' ? !canRedoBauble : !canRedo}
              title="Redo (Ctrl+Y)"
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 px-2 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex gap-1">
          <Tab
            id="layout"
            label="Layout"
            icon={Icons.layout}
            active={activeTab === 'layout'}
            onClick={() => {
              setActiveTab('layout');
              onSetGraphMode?.(false);
            }}
          />
          <Tab
            id="graph"
            label="Graph"
            icon={Icons.graph}
            active={activeTab === 'graph'}
            onClick={() => {
              setActiveTab('graph');
              onSetGraphMode?.(true);
            }}
          />
        </div>
      </div>

      {/* Ultra-thin 3D Controls Bar - Always visible at bottom */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-gray-800 bg-gray-900/70 hover:bg-gray-900 transition-colors">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.325 3.675L12 1.5l-8.325 2.175M12 1.5v18m0 0L3.675 17.325M12 19.5l8.325-2.175M3.675 6.675L12 8.85m0 0l8.325-2.175M12 8.85v10" />
          </svg>
          <button
            onClick={() => setRenderMode('2d')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-all ${
              renderMode === '2d'
                ? 'bg-accent-cyan text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            2D
          </button>
          <button
            onClick={() => setRenderMode('3d')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-all ${
              renderMode === '3d'
                ? 'bg-accent-cyan text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            3D
          </button>
          {renderMode === '3d' && (
            <div className="flex-1 text-[9px] text-gray-500 text-right pr-1 font-medium">
              Drag to rotate • Wheel to zoom
            </div>
          )}
        </div>
      </div>

      {/* Tab Content - Fixed width scrolling container */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ scrollbarGutter: 'stable', width: '320px' }}>
        {activeTab === 'layout' && (
          <>
            {/* Global Camera Controls - Always visible in Layout tab */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-gray-800 bg-gray-900/50 pointer-events-auto">
              <CameraControls
                title="View Controls"
                showPanControls={true}
                showZoomControls={true}
                showResetControls={true}
                panStep={30}
              />
            </div>

            {/* Sub-navbar for Layout options */}
            <div className="flex-shrink-0 px-2 py-2 border-b border-gray-800 bg-gray-900/50 pointer-events-auto">
              <div className="flex gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayoutSubTab('style');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                    layoutSubTab === 'style'
                      ? 'bg-gray-700 text-accent-cyan'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  Style
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayoutSubTab('functions');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                    layoutSubTab === 'functions'
                      ? 'bg-gray-700 text-accent-cyan'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  Functions
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayoutSubTab('export');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                    layoutSubTab === 'export'
                      ? 'bg-gray-700 text-accent-cyan'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  Export
                </button>
              </div>
            </div>
            {/* Sub-tab content */}
            <div className="flex-1 overflow-y-auto p-3">
              {layoutSubTab === 'style' && renderStyleTab()}
              {layoutSubTab === 'functions' && renderFunctionsTab()}
              {layoutSubTab === 'export' && renderExportTab()}
            </div>
          </>
        )}
        {activeTab === 'graph' && (
          <div className="flex-1 overflow-y-auto p-3">
            {renderGraphTab()}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-gray-800 bg-gray-900/50">
        {activeTab === 'graph' ? (
          <div className="text-[10px] text-gray-600 space-y-1">
            <p className="text-center">
              <span className="text-gray-400 font-semibold">Bauble Canvas:</span>
            </p>
            <p className="text-center">
              Drag node • Middle-click/trackpad drag to pan • Scroll/2-finger to zoom • Click-drag to select
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-gray-600 text-center">
            Drag to move • Scroll to zoom • Shift+click to multi-select
          </p>
        )}
      </div>

      {/* Centralized Color Picker Modal */}
      <ColorPickerModal
        isOpen={colorModalOpen}
        label={colorModalLabel}
        value={colorModalValue}
        onClose={() => setColorModalOpen(false)}
        onColorChange={(color) => {
          setColorModalValue(color);
          colorModalCallback?.(color);
        }}
      />
    </div>
  );
}
