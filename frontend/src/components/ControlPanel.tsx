import { useState, useRef } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { FUNCTION_TYPES, FUNCTION_LABELS, FunctionType, LayoutTemplate, LineStyle } from '../types';
import { exportToPNG, exportToSVG, exportToJSON, downloadFile, createShareableURL, exportToGIF } from '../utils/export';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (isNaN(newValue) || newValue < min) {
      onChange(min);
    } else if (newValue > max) {
      onChange(max);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-300">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-200 text-right text-sm focus:outline-none focus:border-accent-cyan"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
      />
    </div>
  );
}

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
      />
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  );
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, value, onChange }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-accent-cyan' : 'bg-gray-600'}`}>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
        </div>
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function TextInput({ label, value, onChange }: TextInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm focus:outline-none focus:border-accent-cyan"
      />
      <span className="text-sm text-gray-400 w-20 truncate">{label}</span>
    </div>
  );
}

interface LineStyleSelectProps {
  label: string;
  value: LineStyle;
  onChange: (value: LineStyle) => void;
}

function LineStyleSelect({ label, value, onChange }: LineStyleSelectProps) {
  const lineStyles: { value: LineStyle; label: string }[] = [
    { value: 'solid', label: 'Solid' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'dotted', label: 'Dotted' }
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex gap-1">
        {lineStyles.map((style) => (
          <button
            key={style.value}
            onClick={() => onChange(style.value)}
            className={`flex-1 py-1.5 px-2 rounded text-xs transition-colors flex items-center justify-center gap-1 ${
              value === style.value
                ? 'bg-accent-cyan text-gray-900'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            <svg width="24" height="8" viewBox="0 0 24 8">
              <line
                x1="0"
                y1="4"
                x2="24"
                y2="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={
                  style.value === 'dashed' ? '6,3' :
                  style.value === 'dotted' ? '2,3' :
                  'none'
                }
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

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

  const [isExportingGif, setIsExportingGif] = useState(false);
  const [gifProgress, setGifProgress] = useState(0);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handlePlayAnimation = () => {
    // Dispatch a custom event that NetworkCanvas can listen for
    window.dispatchEvent(new CustomEvent('playAnimation'));
  };

  const handleExportGIF = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    setIsExportingGif(true);
    setGifProgress(0);

    try {
      await exportToGIF(
        canvas,
        cells,
        config,
        colors,
        (progress) => setGifProgress(Math.round(progress * 100))
      );
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
    if (canvas) {
      exportToPNG(canvas, 'circle-network.png', 3);
    }
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
        if (!importFromCSV(content)) {
          alert('Invalid CSV file format. Expected columns: x, y (and optionally label)');
        }
      };
      reader.readAsText(file);
    }
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const handleExportPDF = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      // High quality export then trigger print dialog
      exportToPNG(canvas, 'circle-network-print.png', 4);
      setTimeout(() => window.print(), 100);
    }
  };

  const templates: { value: LayoutTemplate; label: string }[] = [
    { value: 'random', label: 'Random' },
    { value: 'grid', label: 'Grid' },
    { value: 'circle', label: 'Circle' },
    { value: 'cluster', label: 'Cluster' }
  ];

  const connectionFilterOptions: { value: FunctionType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Connections' },
    ...FUNCTION_TYPES.map(fn => ({ value: fn, label: FUNCTION_LABELS[fn] }))
  ];

  return (
    <div className="h-full overflow-y-auto bg-canvas-dark text-white p-4 space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-accent-cyan">Circle Network</h1>
        <p className="text-sm text-gray-400">Urban Planning Visualization</p>

        {/* Undo/Redo and Theme Toggle */}
        <div className="flex justify-center gap-2 mt-3">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm transition-colors"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm transition-colors"
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          <button
            onClick={toggleTheme}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            title="Toggle Theme"
          >
            {config.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {/* Layout Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Layout</h2>

        <SliderWithInput
          label="Cells"
          value={config.cellCount}
          min={1}
          max={30}
          step={1}
          onChange={(v) => updateCellCount(v)}
        />

        <Slider
          label="Cell Spacing"
          value={config.cellSpacing}
          min={0.3}
          max={0.9}
          step={0.05}
          onChange={(v) => setConfig({ cellSpacing: v })}
        />

        <Toggle
          label="Avoid Overlap"
          value={config.avoidOverlap}
          onChange={(v) => {
            setConfig({ avoidOverlap: v });
            // Regenerate layout when toggling to apply the change
            setTimeout(() => regenerateLayout(), 0);
          }}
        />

        <Toggle
          label="External Connections"
          value={config.showExternalConnections}
          onChange={(v) => setConfig({ showExternalConnections: v })}
        />

        <Toggle
          label="Lines on Top"
          value={config.linesOnTop}
          onChange={(v) => setConfig({ linesOnTop: v })}
        />

        {/* Layout Templates */}
        <div className="grid grid-cols-4 gap-1">
          {templates.map((t) => (
            <button
              key={t.value}
              onClick={() => applyTemplate(t.value)}
              className="py-1.5 px-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>

        <Toggle
          label="Show Grid"
          value={config.showGrid}
          onChange={(v) => setConfig({ showGrid: v })}
        />

        <Toggle
          label="Snap to Grid"
          value={config.snapToGrid}
          onChange={(v) => setConfig({ snapToGrid: v })}
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

        <button
          onClick={regenerateLayout}
          className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          Randomize Layout
        </button>
      </section>

      {/* Line Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Connection Lines</h2>

        <LineStyleSelect
          label="Line Style"
          value={config.lineStyle}
          onChange={(v) => setConfig({ lineStyle: v })}
        />

        <Slider
          label="Line Width"
          value={config.lineWidth}
          min={0.5}
          max={4}
          step={0.1}
          onChange={(v) => setConfig({ lineWidth: v })}
        />

        <Slider
          label="Line Opacity"
          value={config.lineOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setConfig({ lineOpacity: v })}
        />

        <Slider
          label="Overlap Opacity"
          value={config.lineOverlapOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setConfig({ lineOverlapOpacity: v })}
        />

        <Slider
          label="Width Jitter"
          value={config.lineWidthJitter}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setConfig({ lineWidthJitter: v })}
        />

        <Toggle
          label="Width by Function Weight"
          value={config.lineWidthByWeight}
          onChange={(v) => setConfig({ lineWidthByWeight: v })}
        />

        {/* Connection Filter */}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-300">Connection Filter</span>
          <select
            value={config.connectionFilter}
            onChange={(e) => setConfig({ connectionFilter: e.target.value as FunctionType | 'all' })}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm focus:outline-none focus:border-accent-cyan"
          >
            {connectionFilterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Animation Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Animation</h2>

        <Slider
          label="Duration (sec)"
          value={config.animationDuration}
          min={1}
          max={10}
          step={0.5}
          onChange={(v) => setConfig({ animationDuration: v })}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePlayAnimation}
            className="py-2 px-4 bg-accent-cyan hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg text-sm transition-colors"
          >
            Play
          </button>
          <button
            onClick={handleExportGIF}
            disabled={isExportingGif}
            className="py-2 px-4 bg-accent-purple hover:bg-purple-600 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isExportingGif ? 'Exporting...' : 'Export GIF'}
          </button>
        </div>

        {isExportingGif && (
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-purple transition-all duration-100"
              style={{ width: `${gifProgress}%` }}
            />
          </div>
        )}
      </section>

      {/* Size Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Sizes & Outlines</h2>

        <Slider
          label="Living Font Size"
          value={config.livingFontSize}
          min={8}
          max={24}
          step={1}
          onChange={(v) => setConfig({ livingFontSize: v })}
        />

        <Slider
          label="Function Font Size"
          value={config.functionFontSize}
          min={6}
          max={18}
          step={1}
          onChange={(v) => setConfig({ functionFontSize: v })}
        />

        <Slider
          label="Living Outline"
          value={config.livingOutlineWidth}
          min={1}
          max={6}
          step={0.5}
          onChange={(v) => setConfig({ livingOutlineWidth: v })}
        />

        <LineStyleSelect
          label="Living Outline Style"
          value={config.livingOutlineStyle}
          onChange={(v) => setConfig({ livingOutlineStyle: v })}
        />

        <Slider
          label="Function Outline"
          value={config.functionOutlineWidth}
          min={1}
          max={6}
          step={0.5}
          onChange={(v) => setConfig({ functionOutlineWidth: v })}
        />

        <LineStyleSelect
          label="Function Outline Style"
          value={config.functionOutlineStyle}
          onChange={(v) => setConfig({ functionOutlineStyle: v })}
        />

        <Slider
          label="Cell Border"
          value={config.cellOutlineWidth}
          min={1}
          max={6}
          step={0.5}
          onChange={(v) => setConfig({ cellOutlineWidth: v })}
        />

        <LineStyleSelect
          label="Cell Border Style"
          value={config.cellOutlineStyle}
          onChange={(v) => setConfig({ cellOutlineStyle: v })}
        />
      </section>

      {/* Color Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Colors</h2>

        <ColorInput
          label="Living"
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

        <button
          onClick={randomizeColors}
          className="w-full py-2 px-4 bg-accent-purple hover:bg-purple-600 rounded-lg text-sm transition-colors"
        >
          Randomize Colors
        </button>
      </section>

      {/* Function Settings */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Functions</h2>

        {/* Color picker labels */}
        <div className="flex items-center gap-2 text-xs text-gray-500 px-2">
          <span className="w-4"></span>
          <span className="w-6 text-center">Line</span>
          <span className="w-6 text-center">Fill</span>
          <span className="w-6 text-center">Text</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {FUNCTION_TYPES.map((fn) => (
            <div key={fn} className="p-2 bg-gray-800/50 rounded space-y-2">
              <div className="flex items-center gap-2">
                {/* Visibility toggle */}
                <input
                  type="checkbox"
                  checked={config.functionVisible[fn]}
                  onChange={(e) => setFunctionVisible(fn, e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-cyan"
                  title="Show/hide"
                />
                {/* Outline color */}
                <input
                  type="color"
                  value={colors.functions[fn]}
                  onChange={(e) => setFunctionColor(fn, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Outline color"
                />
                {/* Background color */}
                <input
                  type="color"
                  value={colors.functionBackground[fn]}
                  onChange={(e) => setFunctionBackgroundColor(fn, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Background color"
                />
                {/* Text color */}
                <input
                  type="color"
                  value={colors.functionText[fn]}
                  onChange={(e) => setFunctionTextColor(fn, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Text color"
                />
                <span className="text-sm text-gray-300 flex-1">{FUNCTION_LABELS[fn]}</span>
                {/* Weight value */}
                <span className="text-xs text-gray-500 w-8 text-right">{config.functionWeights[fn].toFixed(1)}x</span>
              </div>
              {/* Weight slider */}
              <input
                type="range"
                min={0.3}
                max={2.0}
                step={0.1}
                value={config.functionWeights[fn]}
                onChange={(e) => setFunctionWeight(fn, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan"
                title="Size weight"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Labels */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Labels</h2>

        <TextInput
          label="Living"
          value={config.livingLabel}
          onChange={(v) => setConfig({ livingLabel: v })}
        />

        <div className="grid grid-cols-1 gap-2">
          {FUNCTION_TYPES.map((fn) => (
            <TextInput
              key={fn}
              label={FUNCTION_LABELS[fn]}
              value={config.functionLabels[fn]}
              onChange={(v) => setFunctionLabel(fn, v)}
            />
          ))}
        </div>
      </section>

      {/* Cell Names */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Cell Names</h2>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {cells.map((cell, index) => (
            <div key={cell.id} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-6">{index + 1}</span>
              <input
                type="text"
                value={cell.label}
                onChange={(e) => setCellLabel(cell.id, e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm focus:outline-none focus:border-accent-cyan"
                placeholder={`Cell ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Presets */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Presets</h2>

        {showPresetInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              placeholder="Preset name..."
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-gray-200 text-sm focus:outline-none focus:border-accent-cyan"
              autoFocus
            />
            <button
              onClick={handleSavePreset}
              className="px-3 py-1 bg-accent-cyan hover:bg-cyan-600 text-gray-900 rounded text-sm transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setShowPresetInput(false); setPresetName(''); }}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPresetInput(true)}
            className="w-full py-2 px-4 bg-accent-cyan hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg text-sm transition-colors"
          >
            Save Current as Preset
          </button>
        )}

        {presets.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-2 p-2 bg-gray-800/50 rounded">
                <button
                  onClick={() => loadPreset(preset.id)}
                  className="flex-1 text-left text-sm text-gray-300 hover:text-white truncate"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="text-red-400 hover:text-red-300 text-sm px-2"
                  title="Delete preset"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Import */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Import</h2>

        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          className="hidden"
        />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          onChange={handleImportCSV}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => jsonInputRef.current?.click()}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Import JSON
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Import CSV
          </button>
        </div>
        <p className="text-xs text-gray-500">CSV: x,y columns (0-1 range), optional label column</p>
      </section>

      {/* Export Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Export</h2>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportPNG}
            className="py-2 px-4 bg-accent-cyan hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg text-sm transition-colors"
          >
            PNG
          </button>
          <button
            onClick={handleExportSVG}
            className="py-2 px-4 bg-accent-cyan hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg text-sm transition-colors"
          >
            SVG
          </button>
          <button
            onClick={handleExportJSON}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            JSON
          </button>
          <button
            onClick={handleExportPDF}
            className="py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Print/PDF
          </button>
        </div>

        <button
          onClick={handleShare}
          className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        >
          Share URL
        </button>
      </section>

      {/* Reset */}
      <section className="pt-4 border-t border-gray-700">
        <button
          onClick={reset}
          className="w-full py-2 px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors"
        >
          Reset to Defaults
        </button>
      </section>

      {/* Footer */}
      <div className="text-center pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">Drag cells to reposition • Shift+click for multi-select</p>
      </div>
    </div>
  );
}
