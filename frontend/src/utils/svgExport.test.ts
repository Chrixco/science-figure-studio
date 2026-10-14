import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, DEFAULT_COLORS, NetworkConfig } from '../types';
import { generateCells } from './cellGeneration';
import { exportNetworkToSVG } from './svgExport';

function build(overrides: Partial<NetworkConfig> = {}, count = 3) {
  const config = { ...DEFAULT_CONFIG, cellCount: count, ...overrides };
  const cells = generateCells(config, 'grid');
  return { cells, config, colors: DEFAULT_COLORS };
}

describe('exportNetworkToSVG', () => {
  it('produces a well-formed standalone SVG document', () => {
    const { cells, config, colors } = build();
    const svg = exportNetworkToSVG(cells, config, colors);

    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(/width="[\d.]+"/.test(svg)).toBe(true);
    expect(/viewBox="0 0 [\d.]+ [\d.]+"/.test(svg)).toBe(true);
  });

  // Regression: the old exporter wrote the literal string "living" as every
  // cell's label, so renaming cells had no effect on the exported figure.
  it('uses each cell\'s own label', () => {
    const { cells, config, colors } = build();
    cells[0].label = 'District Alpha';
    cells[1].label = 'District Beta';

    const svg = exportNetworkToSVG(cells, config, colors);
    expect(svg).toContain('District Alpha');
    expect(svg).toContain('District Beta');
  });

  // Regression: the old exporter emitted the raw function key, ignoring the
  // user's renamed function labels.
  it('uses configured function labels, not raw type keys', () => {
    const { cells, config, colors } = build({
      functionLabels: { ...DEFAULT_CONFIG.functionLabels, water: 'Blue Infrastructure' },
    });

    const svg = exportNetworkToSVG(cells, config, colors);
    expect(svg).toContain('Blue Infrastructure');
  });

  it('honours the configured colours', () => {
    const { cells, config } = build();
    const colors = {
      ...DEFAULT_COLORS,
      background: '#123456',
      living: '#abcdef',
      functions: { ...DEFAULT_COLORS.functions, water: '#ff00ff' },
    };

    const svg = exportNetworkToSVG(cells, config, colors);
    expect(svg).toContain('#123456');
    expect(svg).toContain('#abcdef');
    expect(svg).toContain('#ff00ff');
  });

  it('omits hidden function types entirely', () => {
    const { cells, config, colors } = build({
      functionVisible: { ...DEFAULT_CONFIG.functionVisible, pollution: false },
      functionLabels: { ...DEFAULT_CONFIG.functionLabels, pollution: 'SmogMarker' },
    });

    const svg = exportNetworkToSVG(cells, config, colors);
    expect(svg).not.toContain('SmogMarker');
  });

  it('escapes XML metacharacters in labels', () => {
    const { cells, config, colors } = build();
    cells[0].label = 'A & B <tag> "quoted"';

    const svg = exportNetworkToSVG(cells, config, colors);
    expect(svg).toContain('A &amp; B &lt;tag&gt;');
    expect(svg).not.toContain('<tag>');
  });

  it('emits one circle per visible node', () => {
    const { cells, config, colors } = build({}, 2);
    const svg = exportNetworkToSVG(cells, config, colors);

    const circles = (svg.match(/<circle /g) || []).length;
    // 2 cells: each contributes a bounding circle, a living circle and nine
    // function circles.
    expect(circles).toBe(2 * (1 + 1 + 9));
  });

  it('scales the document with the scale option', () => {
    const { cells, config, colors } = build();
    const widthAt = (scale: number) =>
      Number(/width="([\d.]+)"/.exec(exportNetworkToSVG(cells, config, colors, { scale }))![1]);

    expect(widthAt(120)).toBeGreaterThan(widthAt(60));
  });

  it('draws leader lines only when overlap avoidance is on', () => {
    const withoutAvoid = build({ avoidLabelOverlap: false });
    const withAvoid = build({ avoidLabelOverlap: true, showLabelLeaders: true });

    const a = exportNetworkToSVG(withoutAvoid.cells, withoutAvoid.config, withoutAvoid.colors);
    const b = exportNetworkToSVG(withAvoid.cells, withAvoid.config, withAvoid.colors);

    expect((b.match(/<line /g) || []).length).toBeGreaterThanOrEqual(
      (a.match(/<line /g) || []).length
    );
  });

  it('handles an empty network without throwing', () => {
    const svg = exportNetworkToSVG([], DEFAULT_CONFIG, DEFAULT_COLORS);
    expect(svg).toContain('</svg>');
  });

  it('paints a halo behind each label so overhanging text stays readable', () => {
    const { cells, config, colors } = build({}, 1);
    const svg = exportNetworkToSVG(cells, config, colors);
    // Each label is drawn twice: once as a stroked halo, once filled.
    expect(svg).toContain('fill="none" stroke=');
    expect((svg.match(/<text /g) || []).length % 2).toBe(0);
  });
});
