import sys
import random
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.widgets import Slider, Button, TextBox

"""
Interactive GUI to explore the multicell network:
- Drag any cell to reposition it; lines and circles update live.
- Adjust line width and jitter.
- Randomize line colours / layout.
- Export current view to PNG or SVG.
"""


# ---------------------------------------------------------
# CONFIGURATION DEFAULTS
# ---------------------------------------------------------
N_CELLS = 6
FUNCTIONS = [
    "water", "education", "green", "work", "streets",
    "tree", "temperature", "biodiversity", "pollution"
]

BASE_FUNC_COLOR_MAP = {
    "water": "#00b7ff",
    "education": "#ff007c",
    "green": "#25ff00",
    "work": "#ff8c00",
    "streets": "#ffd000",
    "tree": "#13ff9d",
    "temperature": "#ff2e00",
    "biodiversity": "#8b00ff",
    "pollution": "#00ffd5"
}

LIVING_COLOR = "#f3c6e5"
LIVING_OUTLINE = "#ff48c4"
CELL_BORDER_COLOR = "#57c5c8"
CELL_RADIUS = 0.22
LIVING_RADIUS = 0.10
FUNCTION_RADIUS = 0.05
PLOT_MARGIN = 0.08


# ---------------------------------------------------------
# POSITION HELPERS
# ---------------------------------------------------------
def random_cell_positions(n, min_dist=0.55, max_attempts=6000, relax_factor=0.9):
    centres = []
    attempts = 0

    while len(centres) < n:
        p = (random.uniform(0.15, 0.85), random.uniform(0.15, 0.85))
        if all(np.linalg.norm(np.array(p) - np.array(c)) > min_dist for c in centres):
            centres.append(p)
            attempts = 0
            continue

        attempts += 1
        if attempts >= max_attempts:
            min_dist *= relax_factor
            attempts = 0
            sys.stdout.write(f"\nRelaxing cell spacing to {min_dist:.3f} to place remaining cells\n")

    return centres


def ring_positions_inside_cell(center, cell_radius, n_items, item_radius):
    # Keep a small gap to the outer border and to the living circle in the middle
    outer_limit = cell_radius - item_radius - 0.01
    inner_limit = LIVING_RADIUS + item_radius + 0.002

    ring_radius = max(inner_limit, outer_limit * 0.95)
    ring_radius = min(ring_radius, outer_limit)
    if ring_radius <= 0:
        ring_radius = cell_radius * 0.5

    start_angle = random.uniform(0, 2*np.pi)
    angles = start_angle + np.linspace(0, 2*np.pi, n_items, endpoint=False)
    return [
        (
            center[0] + ring_radius * np.cos(a),
            center[1] + ring_radius * np.sin(a)
        )
        for a in angles
    ]


# ---------------------------------------------------------
# GEOMETRY AND DRAWING
# ---------------------------------------------------------
def segment_circle_intersection(p1, p2, center, radius):
    p1 = np.array(p1)
    p2 = np.array(p2)
    c = np.array(center)

    d = p2 - p1
    f = p1 - c

    a = np.dot(d, d)
    b = 2 * np.dot(f, d)
    c_val = np.dot(f, f) - radius**2

    disc = b*b - 4*a*c_val
    if disc < 0:
        return None

    disc = np.sqrt(disc)
    t1 = (-b - disc) / (2*a)
    t2 = (-b + disc) / (2*a)

    pts = []
    if 0 <= t1 <= 1:
        pts.append(tuple(p1 + t1*d))
    if 0 <= t2 <= 1:
        pts.append(tuple(p1 + t2*d))

    return pts if pts else None


def draw_smart_line(ax, p1, p2, circle_centers, circle_radii, color,
                    lw_out=1.6, lw_in=1.2, zorder_base=10):
    segments = [(p1, p2, True)]

    for center, radius in zip(circle_centers, circle_radii):
        new_segments = []
        for (a, b, outside) in segments:
            inter = segment_circle_intersection(a, b, center, radius)
            if not inter:
                new_segments.append((a, b, outside))
                continue

            inter = sorted(inter)
            pts = [a] + inter + [b]

            for s, e in zip(pts[:-1], pts[1:]):
                mid = ((s[0] + e[0]) / 2, (s[1] + e[1]) / 2)
                inside = np.hypot(mid[0] - center[0], mid[1] - center[1]) < radius
                new_segments.append((s, e, not inside))

        segments = new_segments

    for (a, b, outside) in segments:
        ax.plot(
            [a[0], b[0]], [a[1], b[1]],
            color=color,
            linewidth=lw_out if outside else lw_in,
            alpha=1.00 if outside else 0.25,
            zorder=zorder_base
        )


# ---------------------------------------------------------
# GUI CLASS
# ---------------------------------------------------------
class MultiCellGUI:
    def __init__(self):
        self.func_color_map = BASE_FUNC_COLOR_MAP.copy()
        self.n_cells = N_CELLS
        self.cell_spacing = 0.55
        self.avoid_overlap = True
        self.line_width_base = 1.8
        self.line_width_jitter = 0.35
        self.font_size_living = 10
        self.font_size_function = 8
        self.font_color_living = "black"
        self.font_color_function = "auto"   # auto → match outline colour
        self.outline_width_living = 3.0
        self.outline_width_function = 3.6
        self.outline_width_cell = 2.6
        self.living_outline_color = LIVING_OUTLINE
        self.cell_border_color = CELL_BORDER_COLOR
        self.lines_on_top = False

        self.fig = plt.figure(figsize=(10, 10))
        self.fig.patch.set_facecolor("#0b1221")
        # Main drawing axis
        self.ax_main = self.fig.add_axes([0.05, 0.15, 0.9, 0.8])
        self.ax_main.set_xlim(0 - PLOT_MARGIN, 1 + PLOT_MARGIN)
        self.ax_main.set_ylim(0 - PLOT_MARGIN, 1 + PLOT_MARGIN)
        self.ax_main.set_aspect("equal")
        self.ax_main.axis("off")
        self.ax_main.set_facecolor("#0f172a")

        self.dragging_idx = None
        self.last_xy = None

        self._init_layout()
        self._init_controls()
        self._connect_events()
        self._layout_controls()
        self.redraw()

    # ----- layout state -----
    def _init_layout(self):
        min_dist = self.cell_spacing if self.avoid_overlap else 0.05
        self.cell_centres = random_cell_positions(self.n_cells, min_dist=min_dist)
        self.living_centres = self.cell_centres.copy()
        self.function_centres = [
            ring_positions_inside_cell(c, CELL_RADIUS, len(FUNCTIONS), FUNCTION_RADIUS)
            for c in self.cell_centres
        ]

    # ----- controls -----
    def _init_controls(self):
        ax_lw = self.fig.add_axes([0.05, 0.06, 0.3, 0.025])
        self.slider_lw = Slider(ax_lw, "Line width", 0.5, 4.5, valinit=self.line_width_base, valstep=0.1)
        self.slider_lw.on_changed(self._on_linewidth_change)
        self._style_slider(self.slider_lw)

        ax_jitter = self.fig.add_axes([0.05, 0.03, 0.3, 0.025])
        self.slider_jitter = Slider(ax_jitter, "Width jitter", 0.0, 1.0, valinit=self.line_width_jitter, valstep=0.05)
        self.slider_jitter.on_changed(self._on_linewidth_change)
        self._style_slider(self.slider_jitter)

        ax_rand_col = self.fig.add_axes([0.40, 0.06, 0.12, 0.04])
        self.btn_rand_col = Button(ax_rand_col, "Random colours", color="#111827", hovercolor="#1f2937")
        self.btn_rand_col.on_clicked(self._on_random_colours)
        self._style_button(self.btn_rand_col)

        ax_rand_layout = self.fig.add_axes([0.40, 0.015, 0.12, 0.04])
        self.btn_rand_layout = Button(ax_rand_layout, "Random layout", color="#111827", hovercolor="#1f2937")
        self.btn_rand_layout.on_clicked(self._on_random_layout)
        self._style_button(self.btn_rand_layout)

        ax_png = self.fig.add_axes([0.56, 0.06, 0.10, 0.04])
        self.btn_png = Button(ax_png, "Export PNG", color="#111827", hovercolor="#1f2937")
        self.btn_png.on_clicked(lambda evt: self._export("png"))
        self._style_button(self.btn_png)

        ax_svg = self.fig.add_axes([0.56, 0.015, 0.10, 0.04])
        self.btn_svg = Button(ax_svg, "Export SVG", color="#111827", hovercolor="#1f2937")
        self.btn_svg.on_clicked(lambda evt: self._export("svg"))
        self._style_button(self.btn_svg)

        # Cell count
        ax_cells = self.fig.add_axes([0.05, 0.135, 0.12, 0.025])
        self.slider_cells = Slider(ax_cells, "Cells", 1, 10, valinit=self.n_cells, valstep=1)
        self.slider_cells.on_changed(self._on_cells_change)
        self._style_slider(self.slider_cells)

        # Cell spacing / padding
        ax_spacing = self.fig.add_axes([0.20, 0.135, 0.18, 0.025])
        self.slider_spacing = Slider(ax_spacing, "Cell spacing", 0.30, 0.90,
                                     valinit=self.cell_spacing, valstep=0.01)
        self.slider_spacing.on_changed(self._on_spacing_change)
        self._style_slider(self.slider_spacing)

        ax_avoid = self.fig.add_axes([0.40, 0.135, 0.12, 0.035])
        self.btn_avoid_overlap = Button(ax_avoid,
                                        "Avoid overlap: on" if self.avoid_overlap else "Avoid overlap: off",
                                        color="#111827", hovercolor="#1f2937")
        self.btn_avoid_overlap.on_clicked(self._on_toggle_overlap)
        self._style_button(self.btn_avoid_overlap)

        # Font sizes
        ax_font_liv = self.fig.add_axes([0.70, 0.06, 0.10, 0.025])
        self.slider_font_liv = Slider(ax_font_liv, "Living font", 6, 20,
                                      valinit=self.font_size_living, valstep=0.5)
        self.slider_font_liv.on_changed(self._on_font_change)
        self._style_slider(self.slider_font_liv)

        ax_font_fun = self.fig.add_axes([0.70, 0.03, 0.10, 0.025])
        self.slider_font_fun = Slider(ax_font_fun, "Func font", 6, 20,
                                      valinit=self.font_size_function, valstep=0.5)
        self.slider_font_fun.on_changed(self._on_font_change)
        self._style_slider(self.slider_font_fun)

        # Font colours (hex or named)
        ax_font_col_liv = self.fig.add_axes([0.82, 0.06, 0.13, 0.03])
        self.box_font_col_liv = TextBox(ax_font_col_liv, "Living text", initial=self.font_color_living)
        self.box_font_col_liv.on_submit(lambda txt: self._update_font_color(txt, target="living"))
        self._style_textbox(self.box_font_col_liv)

        ax_font_col_fun = self.fig.add_axes([0.82, 0.025, 0.13, 0.03])
        self.box_font_col_fun = TextBox(ax_font_col_fun, "Func text", initial=self.font_color_function)
        self.box_font_col_fun.on_submit(lambda txt: self._update_font_color(txt, target="function"))
        self._style_textbox(self.box_font_col_fun)

        # Outline widths
        ax_out_liv = self.fig.add_axes([0.05, 0.11, 0.18, 0.025])
        self.slider_out_liv = Slider(ax_out_liv, "Living outline", 1.0, 6.0,
                                     valinit=self.outline_width_living, valstep=0.1)
        self.slider_out_liv.on_changed(self._on_outline_width_change)
        self._style_slider(self.slider_out_liv)

        ax_out_fun = self.fig.add_axes([0.25, 0.11, 0.18, 0.025])
        self.slider_out_fun = Slider(ax_out_fun, "Func outline", 1.0, 6.0,
                                     valinit=self.outline_width_function, valstep=0.1)
        self.slider_out_fun.on_changed(self._on_outline_width_change)
        self._style_slider(self.slider_out_fun)

        ax_out_cell = self.fig.add_axes([0.45, 0.11, 0.18, 0.025])
        self.slider_out_cell = Slider(ax_out_cell, "Cell outline", 1.0, 6.0,
                                      valinit=self.outline_width_cell, valstep=0.1)
        self.slider_out_cell.on_changed(self._on_outline_width_change)
        self._style_slider(self.slider_out_cell)

        # Colour overrides for living and cell borders
        ax_col_liv = self.fig.add_axes([0.65, 0.11, 0.13, 0.03])
        self.box_col_liv = TextBox(ax_col_liv, "Living outline", initial=self.living_outline_color)
        self.box_col_liv.on_submit(lambda txt: self._update_simple_color(txt, target="living_outline"))
        self._style_textbox(self.box_col_liv)

        ax_col_cell = self.fig.add_axes([0.82, 0.11, 0.13, 0.03])
        self.box_col_cell = TextBox(ax_col_cell, "Cell outline", initial=self.cell_border_color)
        self.box_col_cell.on_submit(lambda txt: self._update_simple_color(txt, target="cell_border"))
        self._style_textbox(self.box_col_cell)

        # Toggle connection layer order
        ax_toggle_lines = self.fig.add_axes([0.56, 0.11, 0.07, 0.04])
        self.btn_toggle_lines = Button(ax_toggle_lines, "Lines behind", color="#111827", hovercolor="#1f2937")
        self.btn_toggle_lines.on_clicked(self._on_toggle_lines_layer)
        self._style_button(self.btn_toggle_lines)

        # Function-specific outline colours
        self._init_function_color_boxes()

    def _connect_events(self):
        self.cid_press = self.fig.canvas.mpl_connect("button_press_event", self._on_press)
        self.cid_release = self.fig.canvas.mpl_connect("button_release_event", self._on_release)
        self.cid_motion = self.fig.canvas.mpl_connect("motion_notify_event", self._on_motion)
        self.cid_resize = self.fig.canvas.mpl_connect("resize_event", self._on_resize)

    def _init_function_color_boxes(self):
        self.func_color_boxes = {}
        for name in FUNCTIONS:
            ax_box = self.fig.add_axes([0, 0, 0.1, 0.03])  # placeholder, positioned in _layout_controls
            box = TextBox(ax_box, f"{name}", initial=self.func_color_map[name])
            box.on_submit(lambda txt, fname=name: self._update_function_color(fname, txt))
            self.func_color_boxes[name] = box
            self._style_textbox(box)

    def _layout_controls(self):
        margin = 0.04
        panel_w = 0.24
        gap = 0.02

        main_width = max(0.38, 1 - panel_w - gap - 2*margin)
        main_x0 = margin
        main_y0 = 0.16
        main_h = 0.80
        panel_x0 = main_x0 + main_width + gap
        panel_w_actual = 1 - panel_x0 - margin

        self.ax_main.set_position([main_x0, main_y0, main_width, main_h])

        y_row1 = 0.12
        y_row2 = 0.07
        y_row3 = 0.03

        self.slider_cells.ax.set_position([margin, y_row1, 0.12, 0.03])
        self.slider_spacing.ax.set_position([margin + 0.14, y_row1, 0.18, 0.03])
        self.btn_avoid_overlap.ax.set_position([margin + 0.34, y_row1, 0.16, 0.035])
        self.slider_out_liv.ax.set_position([margin + 0.52, y_row1, 0.14, 0.03])
        self.slider_out_fun.ax.set_position([margin + 0.68, y_row1, 0.14, 0.03])
        self.slider_out_cell.ax.set_position([margin + 0.84, y_row1, 0.14, 0.03])
        self.btn_toggle_lines.ax.set_position([panel_x0, y_row1, panel_w_actual * 0.75, 0.04])

        self.slider_lw.ax.set_position([margin, y_row2, 0.30, 0.03])
        self.slider_jitter.ax.set_position([margin, y_row3, 0.30, 0.03])
        self.btn_rand_col.ax.set_position([margin + 0.32, y_row2, 0.14, 0.04])
        self.btn_rand_layout.ax.set_position([margin + 0.32, y_row3 - 0.005, 0.14, 0.04])
        self.btn_png.ax.set_position([margin + 0.48, y_row2, 0.12, 0.04])
        self.btn_svg.ax.set_position([margin + 0.48, y_row3 - 0.005, 0.12, 0.04])

        self.slider_font_liv.ax.set_position([margin + 0.62, y_row2, 0.12, 0.03])
        self.slider_font_fun.ax.set_position([margin + 0.62, y_row3, 0.12, 0.03])
        self.box_font_col_liv.ax.set_position([margin + 0.76, y_row2, 0.14, 0.03])
        self.box_font_col_fun.ax.set_position([margin + 0.76, y_row3, 0.14, 0.03])

        self.box_col_liv.ax.set_position([panel_x0, y_row2, panel_w_actual * 0.75, 0.03])
        self.box_col_cell.ax.set_position([panel_x0, y_row3, panel_w_actual * 0.75, 0.03])

        y = 0.82
        step = 0.032
        width = panel_w_actual * 0.9
        x_box = panel_x0
        for name, box in self.func_color_boxes.items():
            box.ax.set_position([x_box, y, width, 0.03])
            y -= step

    # ----- event handlers -----
    def _on_linewidth_change(self, _):
        self.line_width_base = self.slider_lw.val
        self.line_width_jitter = self.slider_jitter.val
        self.redraw()

    def _on_outline_width_change(self, _):
        self.outline_width_living = self.slider_out_liv.val
        self.outline_width_function = self.slider_out_fun.val
        self.outline_width_cell = self.slider_out_cell.val
        self.redraw()

    def _on_font_change(self, _):
        self.font_size_living = self.slider_font_liv.val
        self.font_size_function = self.slider_font_fun.val
        self.redraw()

    def _on_random_colours(self, _event):
        # random bright colours using HSV with high saturation/value
        new_map = {}
        for name in FUNCTIONS:
            h = random.random()
            s = 0.8 + 0.2 * random.random()
            v = 0.85 + 0.15 * random.random()
            col = tuple(int(c*255) for c in plt.cm.hsv(h)[:3])
            # convert to hex
            new_map[name] = '#%02x%02x%02x' % col
        self.func_color_map = new_map
        self.redraw()

    def _on_random_layout(self, _event):
        self._init_layout()
        self.redraw()

    def _on_toggle_lines_layer(self, _event):
        self.lines_on_top = not self.lines_on_top
        self.btn_toggle_lines.label.set_text("Lines on top" if self.lines_on_top else "Lines behind")
        self.redraw()

    def _on_cells_change(self, _):
        self.n_cells = int(self.slider_cells.val)
        self._init_layout()
        self.redraw()

    def _on_spacing_change(self, _):
        self.cell_spacing = float(self.slider_spacing.val)
        self._init_layout()
        self.redraw()

    def _on_toggle_overlap(self, _event):
        self.avoid_overlap = not self.avoid_overlap
        self.btn_avoid_overlap.label.set_text("Avoid overlap: on" if self.avoid_overlap else "Avoid overlap: off")
        self._init_layout()
        self.redraw()

    def _on_resize(self, _event):
        self._layout_controls()
        self.fig.canvas.draw_idle()

    def _export(self, fmt):
        fname = f"multicell_gui_export.{fmt}"
        self.fig.savefig(fname, dpi=300 if fmt == "png" else None,
                         bbox_inches="tight", pad_inches=0.2)
        print(f"Saved {fname}")

    def _update_function_color(self, fname, text):
        cleaned = self._clean_color(text, self.func_color_map.get(fname, "#000000"))
        self.func_color_map[fname] = cleaned
        self.redraw()

    def _update_font_color(self, text, target):
        if target == "living":
            self.font_color_living = self._clean_color(text, self.font_color_living, allow_auto=False)
        else:
            self.font_color_function = self._clean_color(text, self.font_color_function, allow_auto=True)
        self.redraw()

    def _update_simple_color(self, text, target):
        if target == "living_outline":
            new_col = self._clean_color(text, self.living_outline_color)
            self.box_col_liv.set_val(new_col)
            self.living_outline_color = new_col
            self.redraw()
        elif target == "cell_border":
            new_col = self._clean_color(text, self.cell_border_color)
            self.cell_border_color = new_col
            self.redraw()

    @staticmethod
    def _clean_color(text, fallback, allow_auto=False):
        text = text.strip()
        if allow_auto and text.lower() == "auto":
            return "auto"
        if not text:
            return fallback
        # basic validation: allow named or hex like #rrggbb
        if text.startswith("#"):
            if len(text) in (4, 7):
                return text
            return fallback
        return text

    def _on_press(self, event):
        if event.inaxes != self.ax_main or event.xdata is None or event.ydata is None:
            return
        click = np.array([event.xdata, event.ydata])
        for idx, centre in enumerate(self.living_centres):
            if np.linalg.norm(click - np.array(centre)) <= LIVING_RADIUS * 1.4:
                self.dragging_idx = idx
                self.last_xy = click
                break

    def _on_motion(self, event):
        if self.dragging_idx is None or event.inaxes != self.ax_main:
            return
        if event.xdata is None or event.ydata is None:
            return
        new_xy = np.array([event.xdata, event.ydata])
        delta = new_xy - self.last_xy
        self.last_xy = new_xy

        ci = self.dragging_idx
        self.living_centres[ci] = tuple(np.array(self.living_centres[ci]) + delta)
        self.cell_centres[ci] = self.living_centres[ci]
        self.function_centres[ci] = [
            tuple(np.array(p) + delta) for p in self.function_centres[ci]
        ]
        # Skip drawing connection lines during drag for speed; draw them on release.
        self.redraw(skip_lines=True)

    def _on_release(self, _event):
        self.dragging_idx = None
        self.last_xy = None
        self.redraw()

    # ----- drawing -----
    def redraw(self, skip_lines=False):
        self.ax_main.clear()
        self.ax_main.set_xlim(0 - PLOT_MARGIN, 1 + PLOT_MARGIN)
        self.ax_main.set_ylim(0 - PLOT_MARGIN, 1 + PLOT_MARGIN)
        self.ax_main.set_aspect("equal")
        self.ax_main.axis("off")
        self.ax_main.set_facecolor("#0f172a")

        if not skip_lines:
            # Precompute circle masks for smart lines
            all_circle_centres = []
            all_circle_radii = []
            for i, c in enumerate(self.cell_centres):
                all_circle_centres.append(c)
                all_circle_radii.append(LIVING_RADIUS)
                for fc in self.function_centres[i]:
                    all_circle_centres.append(fc)
                    all_circle_radii.append(FUNCTION_RADIUS)

            # Draw connections
            z_lines = 40 if self.lines_on_top else 10
            for i, liv in enumerate(self.living_centres):
                # internal
                for (fx, fy), fname in zip(self.function_centres[i], FUNCTIONS):
                    color = self.func_color_map.get(fname, "#000000")
                    self._draw_line_with_jitter(liv, (fx, fy), color, all_circle_centres, all_circle_radii,
                                                zorder_lines=z_lines)
                # external
                for j, funcs in enumerate(self.function_centres):
                    if i == j:
                        continue
                    for (fx, fy), fname in zip(funcs, FUNCTIONS):
                        color = self.func_color_map.get(fname, "#000000")
                        self._draw_line_with_jitter(liv, (fx, fy), color, all_circle_centres, all_circle_radii,
                                                    zorder_lines=z_lines)

        # Draw circles and labels
        for ci, c in enumerate(self.cell_centres):
            # living
            self.ax_main.add_patch(
                patches.Circle(c, LIVING_RADIUS,
                               fill=True, color=LIVING_COLOR,
                               linewidth=self.outline_width_living, edgecolor=self.living_outline_color,
                               zorder=22)
            )
            self.ax_main.text(c[0], c[1], "living", ha='center', va='center',
                              fontsize=self.font_size_living, color=self.font_color_living, zorder=23)

            # functions
            for (fx, fy), fname in zip(self.function_centres[ci], FUNCTIONS):
                col = self.func_color_map.get(fname, "#000000")
                self.ax_main.add_patch(
                    patches.Circle(
                        (fx, fy), FUNCTION_RADIUS,
                        fill=True, color="white",
                        edgecolor=col, linewidth=self.outline_width_function,
                        zorder=24
                    )
                )
                self.ax_main.text(fx, fy, fname,
                                  ha='center', va='center',
                                  fontsize=self.font_size_function,
                                  color=(col if self.font_color_function == "auto" else self.font_color_function),
                                  zorder=25)

            # cell border drawn last
            self.ax_main.add_patch(
                patches.Circle(c, CELL_RADIUS, fill=False,
                               linestyle="--", color=self.cell_border_color,
                               linewidth=self.outline_width_cell, zorder=50)
            )

        self.fig.canvas.draw_idle()

    def _draw_line_with_jitter(self, p1, p2, color, circle_centres, circle_radii, zorder_lines=10):
        jitter = (random.random() - 0.5) * 2 * self.line_width_jitter
        lw_out = max(0.2, self.line_width_base * (1 + jitter))
        lw_in = max(0.15, lw_out * 0.75)
        draw_smart_line(self.ax_main, p1, p2, circle_centres, circle_radii,
                        color=color, lw_out=lw_out, lw_in=lw_in, zorder_base=zorder_lines)

    # ---- style helpers to keep the UI cohesive ----
    def _style_button(self, btn):
        btn.label.set_color("#e5e7eb")
        btn.hovercolor = "#1f2937"
        btn.color = "#111827"
        btn.ax.set_facecolor("#111827")
        for spine in btn.ax.spines.values():
            spine.set_edgecolor("#1f2937")

    def _style_slider(self, slider):
        slider.ax.set_facecolor("#0f172a")
        if hasattr(slider, "track"):
            slider.track.set_color("#1f2937")
        slider.poly.set_color("#22d3ee")
        slider.valtext.set_color("#e5e7eb")
        slider.label.set_color("#e5e7eb")

    def _style_textbox(self, tb):
        tb.ax.set_facecolor("#111827")
        for spine in tb.ax.spines.values():
            spine.set_edgecolor("#1f2937")
        tb.label.set_color("#e5e7eb")
        tb.text_disp.set_color("#22d3ee")


if __name__ == "__main__":
    gui = MultiCellGUI()
    plt.show()
