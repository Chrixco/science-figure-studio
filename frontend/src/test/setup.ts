import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

/**
 * The jsdom environment here exposes `localStorage`/`sessionStorage` as bare
 * objects with no Storage methods, so anything calling getItem/setItem throws.
 * Install a real in-memory implementation instead.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function install(name: 'localStorage' | 'sessionStorage') {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, name, {
    value: storage,
    writable: true,
    configurable: true,
  });
  return storage;
}

const local = install('localStorage');
const session = install('sessionStorage');

beforeEach(() => {
  local.clear();
  session.clear();
});

/**
 * jsdom ships no canvas implementation, so getContext('2d') returns null and
 * logs "Not implemented" for every call. Anything measuring text would silently
 * fall back to an approximation and never exercise the real branch.
 *
 * A deterministic stub keeps the canvas path under test and the output quiet.
 * Advance width is proportional to font size, which is all the measuring code
 * relies on. Real-browser fidelity is verified separately -- the production
 * path uses the browser's own CanvasRenderingContext2D.
 */
const STUB_ADVANCE_RATIO = 0.5;

HTMLCanvasElement.prototype.getContext = function getContext(
  contextId: string
): CanvasRenderingContext2D | null {
  if (contextId !== '2d') return null;

  let font = '10px sans-serif';
  const context = {
    get font() {
      return font;
    },
    set font(value: string) {
      font = value;
    },
    measureText(text: string) {
      const match = /(\d+(?:\.\d+)?)px/.exec(font);
      const size = match ? Number(match[1]) : 10;
      return { width: text.length * size * STUB_ADVANCE_RATIO } as TextMetrics;
    },
    scale() {},
    clearRect() {},
    fillRect() {},
    fillText() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
  };

  return context as unknown as CanvasRenderingContext2D;
} as typeof HTMLCanvasElement.prototype.getContext;
