import { useState, useRef } from 'react';
import { useBaubleStore } from '../hooks/useBaubleStore';
import { BaubleLayoutType, LoadedBaubleFile } from '../types/bauble';
import { parseBaubleExcelFile, getExcelSheetNames, getExcelColumnHeaders } from '../utils/baubleExcelParser';
import {
  exportBaubleGraphToJSON,
  importBaubleGraphFromJSON,
  downloadBaubleGraphJSON,
  exportBaubleGraphToPNG,
  exportBaubleGraphToPDF,
  exportBaubleGraphToSVG,
  downloadBaubleGraphSVG,
} from '../utils/baubleGraphExport';
import { Icons } from './ui/Icons';
import {
  CollapsibleSection,
  Slider,
  SliderWithInput,
  Toggle,
  Select,
  Button,
} from './ui/controls';
import { CameraControls } from './CameraControls';

export interface GraphTabProps {
  /** Opens the panel-wide colour picker modal. Owned by ControlPanel so only
   *  one modal exists no matter which tab requested it. */
  openColorModal: (label: string, currentColor: string, callback: (color: string) => void) => void;
  /** Export DPI preset, shared with the Layout tab's export controls. */
  exportQuality: 'screen' | 'web' | 'print' | 'high';
  exportQualityPresets: Record<string, { dpi: number; label: string; description: string }>;
}

/**
 * Controls for the hierarchical "bauble" graph: workbook loading, node
 * styling, layout and export.
 *
 * Split out of ControlPanel, which had grown to ~3,500 lines with every tab as
 * a closure in one component body.
 */
export function GraphTab({ openColorModal, exportQuality, exportQualityPresets }: GraphTabProps) {
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

  return (
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
                setBaubleConfig({ layoutType: e.target.value as BaubleLayoutType });
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

      {/* Stats */}
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
    </div>
  );
}
