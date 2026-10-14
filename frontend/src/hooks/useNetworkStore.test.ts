import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore } from './useNetworkStore';
import { DEFAULT_CONFIG, DEFAULT_COLORS } from '../types';
import { generateNetwork, CANVAS_SCALE } from '../utils/geometry';

describe('useNetworkStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useNetworkStore.setState({
      cells: generateNetwork(DEFAULT_CONFIG),
      config: DEFAULT_CONFIG,
      colors: DEFAULT_COLORS,
      selectedCellIds: [],
      isDragging: false,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  describe('updateCellCount', () => {
    it('records the requested count in config', () => {
      useNetworkStore.getState().updateCellCount(3);
      expect(useNetworkStore.getState().config.cellCount).toBe(3);
    });

    // Regression: placement used a fixed 10x10 domain. At default settings each
    // cell needs 4.725 units of separation but the usable box was 5.5x5.5, so
    // the sampler gave up and returned 2-3 cells whatever the slider said.
    it.each([1, 3, 6, 12, 30])('produces exactly %i cells', (count) => {
      useNetworkStore.getState().updateCellCount(count);
      expect(useNetworkStore.getState().cells).toHaveLength(count);
    });

    // Regression: updateCellCount used to pre-multiply livingRadius and
    // functionRadius by CANVAS_SCALE before calling generateNetwork(), but
    // generateCells() applies CANVAS_SCALE itself -- so every radius came out
    // 100x instead of 10x. Earlier UI code hid this by firing a second
    // regenerateLayout() on a setTimeout.
    it('scales radii exactly once', () => {
      useNetworkStore.getState().updateCellCount(4);
      const { cells } = useNetworkStore.getState();

      const expected = DEFAULT_CONFIG.livingRadius * CANVAS_SCALE;
      for (const cell of cells) {
        expect(cell.livingRadius).toBeCloseTo(expected, 6);
      }
    });

    it('matches what regenerateLayout produces for the same count', () => {
      useNetworkStore.getState().updateCellCount(5);
      const viaCount = useNetworkStore.getState().cells[0].livingRadius;

      useNetworkStore.getState().regenerateLayout();
      const viaRegenerate = useNetworkStore.getState().cells[0].livingRadius;

      expect(viaCount).toBeCloseTo(viaRegenerate, 6);
    });

    it('is a no-op when the count is unchanged', () => {
      const before = useNetworkStore.getState().cells;
      useNetworkStore.getState().updateCellCount(before.length);
      expect(useNetworkStore.getState().cells).toBe(before);
    });
  });

  describe('setFunctionWeight', () => {
    it('records the weight and recomputes cell geometry', () => {
      const radiusBefore = useNetworkStore.getState().cells[0].radius;
      useNetworkStore.getState().setFunctionWeight('water', 2.0);

      const { config, cells } = useNetworkStore.getState();
      expect(config.functionWeights.water).toBe(2.0);
      expect(cells[0].radius).not.toBe(radiusBefore);
    });
  });

  describe('toggleTheme', () => {
    it('swaps theme and palette together', () => {
      expect(useNetworkStore.getState().config.theme).toBe('dark');

      useNetworkStore.getState().toggleTheme();
      expect(useNetworkStore.getState().config.theme).toBe('light');
      expect(useNetworkStore.getState().colors.background).toBe('#ffffff');

      useNetworkStore.getState().toggleTheme();
      expect(useNetworkStore.getState().config.theme).toBe('dark');
      expect(useNetworkStore.getState().colors.background).toBe('#000000');
    });
  });

  describe('selection', () => {
    it('replaces the selection with setSelectedCell', () => {
      const [a, b] = useNetworkStore.getState().cells;
      useNetworkStore.getState().setSelectedCell(a.id);
      useNetworkStore.getState().setSelectedCell(b.id);
      expect(useNetworkStore.getState().selectedCellIds).toEqual([b.id]);
    });

    it('adds and removes with toggleCellSelection', () => {
      const [a, b] = useNetworkStore.getState().cells;
      const { toggleCellSelection } = useNetworkStore.getState();

      toggleCellSelection(a.id);
      toggleCellSelection(b.id);
      expect(useNetworkStore.getState().selectedCellIds).toEqual([a.id, b.id]);

      toggleCellSelection(a.id);
      expect(useNetworkStore.getState().selectedCellIds).toEqual([b.id]);
    });

    it('clears the selection when passed null', () => {
      const [a] = useNetworkStore.getState().cells;
      useNetworkStore.getState().setSelectedCell(a.id);
      useNetworkStore.getState().setSelectedCell(null);
      expect(useNetworkStore.getState().selectedCellIds).toEqual([]);
    });
  });

  describe('moveSelectedCells', () => {
    it('moves only the selected cells', () => {
      const [a, b] = useNetworkStore.getState().cells;
      const bStart = { ...b.position };
      useNetworkStore.getState().setSelectedCell(a.id);
      useNetworkStore.getState().moveSelectedCells(1, 2);

      const after = useNetworkStore.getState().cells;
      const movedA = after.find((c) => c.id === a.id)!;
      const untouchedB = after.find((c) => c.id === b.id)!;

      expect(movedA.position.x).toBeCloseTo(a.position.x + 1, 6);
      expect(movedA.position.y).toBeCloseTo(a.position.y + 2, 6);
      expect(untouchedB.position).toEqual(bStart);
    });
  });

  describe('importFromJSON', () => {
    it('rejects malformed input without mutating state', () => {
      const before = useNetworkStore.getState().cells;
      expect(useNetworkStore.getState().importFromJSON('not json')).toBe(false);
      expect(useNetworkStore.getState().importFromJSON('{"cells":[]}')).toBe(false);
      expect(useNetworkStore.getState().cells).toBe(before);
    });

    it('accepts a well-formed payload', () => {
      const payload = JSON.stringify({
        cells: generateNetwork({ ...DEFAULT_CONFIG, cellCount: 2 }),
        config: DEFAULT_CONFIG,
        colors: DEFAULT_COLORS,
      });
      expect(useNetworkStore.getState().importFromJSON(payload)).toBe(true);
      expect(useNetworkStore.getState().cells).toHaveLength(2);
    });
  });
});
