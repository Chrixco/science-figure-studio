import { useState, useRef, useEffect, ReactNode } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { FUNCTION_TYPES, FUNCTION_LABELS, FunctionType, LayoutTemplate, LineStyle } from '../types';
import { exportToPNG, exportToSVG, exportToJSON, downloadFile, createShareableURL, exportToGIF } from '../utils/export';

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

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState(value);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update custom color when value changes externally
  useEffect(() => {
    setCustomColor(value);
  }, [value]);

  return (
    <div className="relative" ref={pickerRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-7 h-7 rounded cursor-pointer border-2 border-gray-600 hover:border-gray-400 transition-colors shadow-sm"
          style={{ backgroundColor: value }}
          title="Click to open color picker"
        />
        {label && <span className="text-xs text-gray-400">{label}</span>}
      </div>

      {isOpen && (
        <div className="absolute z-50 top-9 left-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-56">
          {/* Palette Grid */}
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onChange(color);
                  setCustomColor(color);
                }}
                className={`w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 ${
                  value.toLowerCase() === color.toLowerCase()
                    ? 'ring-2 ring-accent-cyan ring-offset-1 ring-offset-gray-800'
                    : 'border border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-2" />

          {/* Custom Color Input */}
          <div className="space-y-2">
            <span className="text-xs text-gray-400">Custom Color</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  onChange(e.target.value);
                }}
                className="w-10 h-8 rounded cursor-pointer border border-gray-600 bg-transparent"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomColor(val);
                  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    onChange(val);
                  }
                }}
                placeholder="#000000"
                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-gray-300 text-xs font-mono focus:outline-none focus:border-accent-cyan"
              />
            </div>
          </div>

          {/* Close hint */}
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            Click outside to close
          </p>
        </div>
      )}
    </div>
  );
}

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  return <ColorPicker value={value} onChange={onChange} label={label} />;
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
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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
// TAB COMPONENTS
// ============================================================================

type TabId = 'layout' | 'style' | 'functions' | 'export';

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
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-all ${
        active
          ? 'bg-gray-700 text-accent-cyan'
          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// ============================================================================
// MAIN CONTROL PANEL COMPONENT
// ============================================================================

export function ControlPanel() {
  const {
    cells,
    config,
    colors,
    presets,
    canUndo,
    canRedo,
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
    undo,
    redo,
    savePreset,
    loadPreset,
    deletePreset,
    importFromJSON,
    importFromCSV,
    reset
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<TabId>('layout');
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) exportToPNG(canvas, 'circle-network.png', 3);
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
        if (!importFromJSON(content)) alert('Invalid JSON file format');
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

  const renderLayoutTab = () => (
    <div className="space-y-3">
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
        onChange={updateCellCount}
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
              min={0.3}
              max={0.9}
              step={0.05}
              onChange={(v) => setConfig({ cellSpacing: v })}
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
    </div>
  );

  const renderStyleTab = () => (
    <div className="space-y-3">
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
            />
            <ColorInput
              label="Living Outline"
              value={colors.livingOutline}
              onChange={(v) => setColors({ livingOutline: v })}
            />
            <ColorInput
              label="Living Text"
              value={colors.livingText}
              onChange={(v) => setColors({ livingText: v })}
            />
            <ColorInput
              label="Cell Border"
              value={colors.cellBorder}
              onChange={(v) => setColors({ cellBorder: v })}
            />
            <ColorInput
              label="Background"
              value={colors.background}
              onChange={(v) => setColors({ background: v })}
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
                  />
                  <ColorPicker
                    value={colors.functionBackground[fn]}
                    onChange={(v) => setFunctionBackgroundColor(fn, v)}
                  />
                  <ColorPicker
                    value={colors.functionText[fn]}
                    onChange={(v) => setFunctionTextColor(fn, v)}
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
      <CollapsibleSection title="Export Image" icon={Icons.download} defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleExportPNG} variant="primary" className="justify-center">
            PNG
          </Button>
          <Button onClick={handleExportSVG} variant="primary" className="justify-center">
            SVG
          </Button>
          <Button onClick={handleExportGIF} disabled={isExportingGif} className="col-span-2 justify-center">
            {isExportingGif ? `Exporting GIF... ${gifProgress}%` : 'Animated GIF'}
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
            onClick={() => {
              const canvas = document.querySelector('canvas');
              if (canvas) {
                exportToPNG(canvas, 'circle-network-print.png', 4);
                setTimeout(() => window.print(), 100);
              }
            }}
            className="w-full justify-center"
          >
            Print / PDF
          </Button>
        </div>
      </CollapsibleSection>

      {/* Import */}
      <CollapsibleSection title="Import" icon={Icons.upload}>
        <input ref={jsonInputRef} type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
        <input ref={csvInputRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />

        <div className="space-y-2">
          <Button onClick={() => jsonInputRef.current?.click()} icon={Icons.upload} className="w-full justify-center">
            Import JSON
          </Button>
          <Button onClick={() => csvInputRef.current?.click()} icon={Icons.upload} className="w-full justify-center">
            Import CSV
          </Button>
          <p className="text-[10px] text-gray-500 text-center">
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
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Science Figure Studio</h1>
            <p className="text-[10px] text-gray-500">Network Visualization</p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              icon={Icons.undo}
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            />
            <IconButton
              icon={Icons.redo}
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            />
            <div className="w-px h-6 bg-gray-700 mx-1" />
            <IconButton
              icon={config.theme === 'dark' ? Icons.sun : Icons.moon}
              onClick={toggleTheme}
              title={`Switch to ${config.theme === 'dark' ? 'light' : 'dark'} mode`}
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
            onClick={() => setActiveTab('layout')}
          />
          <Tab
            id="style"
            label="Style"
            icon={Icons.style}
            active={activeTab === 'style'}
            onClick={() => setActiveTab('style')}
          />
          <Tab
            id="functions"
            label="Functions"
            icon={Icons.functions}
            active={activeTab === 'functions'}
            onClick={() => setActiveTab('functions')}
          />
          <Tab
            id="export"
            label="Export"
            icon={Icons.export}
            active={activeTab === 'export'}
            onClick={() => setActiveTab('export')}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'layout' && renderLayoutTab()}
        {activeTab === 'style' && renderStyleTab()}
        {activeTab === 'functions' && renderFunctionsTab()}
        {activeTab === 'export' && renderExportTab()}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-gray-800 bg-gray-900/50">
        <p className="text-[10px] text-gray-600 text-center">
          Drag to move • Scroll to zoom • Shift+click to multi-select
        </p>
      </div>
    </div>
  );
}
