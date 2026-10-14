import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore } from './useNetworkStore';
import { DEFAULT_CONFIG, DEFAULT_COLORS } from '../types';
import { generateNetwork } from '../utils/geometry';

/** Reset to a known 3-cell network with an empty history. */
function reset() {
  useNetworkStore.setState({
    cells: generateNetwork({ ...DEFAULT_CONFIG, cellCount: 3 }),
    config: { ...DEFAULT_CONFIG, cellCount: 3 },
    colors: DEFAULT_COLORS,
    selectedCellIds: [],
    isDragging: false,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    layoutVersion: 0,
  });
}

/** A stable fingerprint of the current network. */
function snapshot() {
  return useNetworkStore
    .getState()
    .cells.map((c) => `${c.id}:${c.position.x.toFixed(4)},${c.position.y.toFixed(4)}`)
    .join('|');
}

function moveFirstCell(dx: number) {
  const { cells, moveCell } = useNetworkStore.getState();
  const cell = cells[0];
  useNetworkStore.getState().saveToHistory();
  moveCell(cell.id, { x: cell.position.x + dx, y: cell.position.y });
}

describe('undo/redo', () => {
  beforeEach(reset);

  it('restores the previous state', () => {
    const before = snapshot();
    moveFirstCell(1);
    expect(snapshot()).not.toBe(before);

    useNetworkStore.getState().undo();
    expect(snapshot()).toBe(before);
  });

  it('round-trips a single edit', () => {
    const before = snapshot();
    moveFirstCell(1);
    const after = snapshot();

    useNetworkStore.getState().undo();
    expect(snapshot()).toBe(before);

    useNetworkStore.getState().redo();
    expect(snapshot()).toBe(after);
  });

  it('round-trips several edits in order', () => {
    const states = [snapshot()];
    for (let i = 0; i < 3; i++) {
      moveFirstCell(1);
      states.push(snapshot());
    }

    // Walk all the way back.
    for (let i = states.length - 1; i > 0; i--) {
      useNetworkStore.getState().undo();
      expect(snapshot()).toBe(states[i - 1]);
    }

    // And all the way forward again.
    for (let i = 1; i < states.length; i++) {
      useNetworkStore.getState().redo();
      expect(snapshot()).toBe(states[i]);
    }
  });

  it('does nothing when there is no history', () => {
    const before = snapshot();
    useNetworkStore.getState().undo();
    useNetworkStore.getState().redo();
    expect(snapshot()).toBe(before);
  });

  it('reports canUndo/canRedo consistently', () => {
    expect(useNetworkStore.getState().canUndo).toBe(false);

    moveFirstCell(1);
    expect(useNetworkStore.getState().canUndo).toBe(true);

    useNetworkStore.getState().undo();
    expect(useNetworkStore.getState().canRedo).toBe(true);

    useNetworkStore.getState().redo();
    expect(useNetworkStore.getState().canRedo).toBe(false);
  });

  it('drops the redo stack once a new edit is made', () => {
    moveFirstCell(1);
    useNetworkStore.getState().undo();
    expect(useNetworkStore.getState().canRedo).toBe(true);

    moveFirstCell(5);
    expect(useNetworkStore.getState().canRedo).toBe(false);
  });
});
