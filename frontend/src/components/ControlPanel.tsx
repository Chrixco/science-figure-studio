import { useState, useRef, useEffect, ReactNode } from 'react';
import { useNetworkStore } from '../hooks/useNetworkStore';
import { useBaubleStore } from '../hooks/useBaubleStore';
import { FUNCTION_TYPES, FUNCTION_LABELS, FunctionType, LayoutTemplate } from '../types';
import { exportToJSON, downloadFile, createShareableURL, exportToGIF } from '../utils/export';
import { exportFigureAsPNG, exportFigureAsPDF, exportFigureAsSVG } from '../utils/figureExport';
import { downloadTemplate } from '../utils/excelTemplate';
import { UI_STYLES } from './ui/styles';
import { Icons } from './ui/Icons';
import {
  CollapsibleSection,
  Slider,
  SliderWithInput,
  Toggle,
  ColorPickerModal,
  ColorPicker,
  ColorInput,
  LineStyleSelect,
  Button,
  IconButton,
} from './ui/controls';
import { LayoutCameraControls } from './CameraControls';
import { GraphTab } from './GraphTab';



// ============================================================================
// REUSABLE UI COMPONENTS
// ============================================================================





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
  onSetMode?: (mode: 'mitosis' | 'graph') => void;
}

export function ControlPanel({ onSetMode }: ControlPanelProps = {}) {
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

  // The header's undo/redo buttons act on whichever tab is active, so the
  // panel keeps a handle on the graph store's history even though the graph
  // controls themselves now live in <GraphTab />.
  const {
    undo: undoBauble,
    redo: redoBauble,
    canUndo: canUndoBauble,
    canRedo: canRedoBauble,
  } = useBaubleStore();

  // Restore the previous session's network, if one was left behind.
  // Declared after the store destructuring so importFromJSON is initialised.
  useEffect(() => {
    const sessionData = sessionStorage.getItem('networkSessionData');
    if (!sessionData) return;
    try {
      importFromJSON(sessionData);
    } catch (error) {
      console.warn('Failed to load session data:', error);
    }
    // Intentionally mount-only: restoring on every importFromJSON identity
    // change would clobber whatever the user has edited since.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>('layout');
  const [layoutSubTab, setLayoutSubTab] = useState<'layout' | 'style' | 'functions' | 'export'>('layout');
  const [sessionCleared, setSessionCleared] = useState(false);
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

  // All three raster/vector paths render the same SVG figure, so what is
  // exported matches what is on screen and the DPI setting genuinely changes
  // the rendered resolution.
  const runExport = async (label: string, task: () => Promise<void>) => {
    try {
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`${label} export failed: ${message}`);
    }
  };

  const handleExportPNG = () =>
    runExport('PNG', () =>
      exportFigureAsPNG(
        cells,
        config,
        colors,
        exportQualityPresets[exportQuality].dpi,
        'circle-network.png'
      )
    );

  const handleExportPDF = () =>
    runExport('PDF', () =>
      exportFigureAsPDF(
        cells,
        config,
        colors,
        exportQualityPresets[exportQuality].dpi,
        'circle-network.pdf'
      )
    );

  const handleExportSVG = () =>
    runExport('SVG', () => exportFigureAsSVG(cells, config, colors, 'circle-network.svg'));

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

  // Template generation is async now that the spreadsheet library is loaded on
  // demand, so surface a failure rather than leaving a rejected promise.
  const handleDownloadTemplate = async (type: 'simple' | 'detailed') => {
    try {
      await downloadTemplate(type);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Could not build the ${type} template: ${message}`);
    }
  };

  const handleDownloadSimpleTemplate = () => {
    void handleDownloadTemplate('simple');
  };

  const handleDownloadDetailedTemplate = () => {
    void handleDownloadTemplate('detailed');
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
      <div className="text-xs font-semibold text-accent-cyan uppercase tracking-wider px-2 py-1">Mitosis Layout</div>

      {/* Quick Actions */}
      <Button onClick={regenerateLayout} icon={Icons.shuffle} className="w-full">
        Randomize Layout
      </Button>

      {/* Layout Templates */}
      <div className="grid grid-cols-4 gap-1.5">
        {templates.map((t) => (
          <button
            key={t.value}
            onClick={() => applyTemplate(t.value)}
            className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-200"
            title={`Arrange cells in a ${t.label.toLowerCase()} layout`}
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

      <CollapsibleSection title="Layout Options" icon={Icons.layout} defaultOpen>
        <div className="space-y-3">
          <Toggle
            label="Avoid Overlap"
            value={config.avoidOverlap}
            onChange={(v) => {
              setConfig({ avoidOverlap: v });
              regenerateLayout();
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
                regenerateLayout();
              }}
            />
          )}

          <Toggle
            label="Lines on Top"
            value={config.linesOnTop}
            onChange={(v) => setConfig({ linesOnTop: v })}
            description="Draw connections above circles"
          />
        </div>
      </CollapsibleSection>

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
            setSessionCleared(true);
          }}
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          Clear Session Data
        </Button>
        <p className="text-[10px] text-gray-600 mt-2 text-center italic">
          {sessionCleared
            ? 'Session cleared — refresh to start fresh.'
            : 'Imported data persists until cleared'}
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

      {/* Text Positioning & Alignment */}
      <CollapsibleSection title="Text Positioning & Alignment">
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Text Position</span>
            <div className="grid grid-cols-2 gap-2">
              {(['inside', 'above', 'below', 'outside'] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setConfig({ textPosition: pos })}
                  className={`p-2 rounded text-xs font-medium transition-all ${
                    config.textPosition === pos
                      ? 'bg-accent-cyan text-gray-900'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {pos.charAt(0).toUpperCase() + pos.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-400">Text Alignment</span>
            <div className="flex gap-2">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => setConfig({ textAlignment: align })}
                  className={`flex-1 p-2 rounded text-xs font-medium transition-all ${
                    config.textAlignment === align
                      ? 'bg-accent-cyan text-gray-900'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {align === 'left' ? '⬅' : align === 'center' ? '⬍' : '➡'}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="Text Offset"
            value={config.textOffset}
            min={0}
            max={30}
            step={1}
            onChange={(v) => setConfig({ textOffset: v })}
            suffix="px"
          />

          <Toggle
            label="Avoid Label Overlap"
            value={config.avoidLabelOverlap}
            onChange={(v) => setConfig({ avoidLabelOverlap: v })}
            description="Nudge colliding labels apart with a force simulation"
          />

          {config.avoidLabelOverlap && (
            <>
              <Slider
                label="Label Spacing"
                value={config.labelOverlapPadding}
                min={0}
                max={20}
                step={1}
                onChange={(v) => setConfig({ labelOverlapPadding: v })}
                suffix="px"
              />

              <Toggle
                label="Leader Lines"
                value={config.showLabelLeaders}
                onChange={(v) => setConfig({ showLabelLeaders: v })}
                description="Connect a label to its node when pushed clear of it"
              />
            </>
          )}
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

      {/* Cell Count Control */}
      <CollapsibleSection title="Cell Count" defaultOpen>
        <Slider
          label="Number of Cells"
          value={config.cellCount}
          min={1}
          max={9}
          step={1}
          onChange={(v) => updateCellCount(v)}
          suffix="cells"
        />
      </CollapsibleSection>

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
          <Button onClick={handleExportPDF} variant="primary" className="justify-center">
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
            onClick={() =>
              runExport('Print', async () => {
                await exportFigureAsPNG(
                  cells,
                  config,
                  colors,
                  exportQualityPresets[exportQuality].dpi,
                  'circle-network-print.png'
                );
              })
            }
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
            <IconButton
              icon={config.theme === 'dark' ? Icons.sun : Icons.moon}
              onClick={toggleTheme}
              title={config.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
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
              onSetMode?.('mitosis');
            }}
          />
          <Tab
            id="graph"
            label="Graph"
            icon={Icons.graph}
            active={activeTab === 'graph'}
            onClick={() => {
              setActiveTab('graph');
              onSetMode?.('graph');
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
            {/* Layout-specific Camera Controls - Always visible in Layout tab */}
            <div className="flex-shrink-0 px-3 py-2 border-b border-gray-800 bg-gray-900/50 pointer-events-auto">
              <LayoutCameraControls
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
                    setLayoutSubTab('layout');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                    layoutSubTab === 'layout'
                      ? 'bg-gray-700 text-accent-cyan'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  Layout
                </button>
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
              {layoutSubTab === 'layout' && renderLayoutTab()}
              {layoutSubTab === 'style' && renderStyleTab()}
              {layoutSubTab === 'functions' && renderFunctionsTab()}
              {layoutSubTab === 'export' && renderExportTab()}
            </div>
          </>
        )}
        {activeTab === 'graph' && (
          <div className="flex-1 overflow-y-auto p-3">
            <GraphTab
              openColorModal={openColorModal}
              exportQuality={exportQuality}
              exportQualityPresets={exportQualityPresets}
            />
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

      {/* Centralized Color Picker Modal (mounted only while open) */}
      {colorModalOpen && (
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
      )}
    </div>
  );
}
