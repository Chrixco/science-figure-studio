import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import random
import sys

# ---------------------------------------------------------
# PROGRESS BAR
# ---------------------------------------------------------
def progress_bar(iteration, total, prefix='', length=40):
    """
    Simple clean terminal progress bar.
    """
    percent = iteration / float(total)
    filled = int(length * percent)
    bar = '█' * filled + '-' * (length - filled)
    sys.stdout.write(f'\r{prefix} |{bar}| {percent:5.1%}')
    sys.stdout.flush()
    if iteration == total:
        sys.stdout.write('\n')


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
N_CELLS = 6
FUNCTIONS = [
    "water", "education", "green", "work", "streets",
    "tree", "temperature", "biodiversity", "pollution"
]

# Unique bright colours (one per function type)
FUNC_COLOR_MAP = {
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
LIVING_OUTLINE = "#ff48c4"      # strong outline for living node

CELL_BORDER_COLOR = "#57c5c8"
CELL_RADIUS = 0.22
LIVING_RADIUS = 0.10
FUNCTION_RADIUS = 0.05
PLOT_MARGIN = 0.08   # extra whitespace around the layout to avoid clipping

# Random seed for repeatability; set to None for full randomness
RANDOM_SEED = None
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)


# ---------------------------------------------------------
# RANDOM POSITION HELPERS
# ---------------------------------------------------------
def random_cell_positions(n, min_dist=0.55, max_attempts=6000, relax_factor=0.9):
    """
    Pick cell centres spaced at least `min_dist` apart.
    Falls back by relaxing the distance if we struggle to fit all cells
    in the 0.7 x 0.7 region to avoid an infinite search loop.
    """
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
    """
    Place items evenly on a ring inside the cell so circles/text do not overlap.
    Slight random rotation keeps layouts from looking identical across cells.
    """
    # Keep a small gap to the outer border and to the living circle in the middle
    outer_limit = cell_radius - item_radius - 0.01
    inner_limit = LIVING_RADIUS + item_radius + 0.002

    # Pick a feasible radius that favors hugging the border while leaving breathing room
    ring_radius = max(inner_limit, outer_limit * 0.95)
    ring_radius = min(ring_radius, outer_limit)

    # If still squeezed, fall back to the midpoint between living and border
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
# GEOMETRY UTILITY: LINE–CIRCLE INTERSECTION
# ---------------------------------------------------------
def segment_circle_intersection(p1, p2, center, radius):
    """
    Returns whether a segment intersects a circle and the intersection points.
    Used to draw partial-opacity lines inside circles.
    """

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


# ---------------------------------------------------------
# DRAWING FUNCTION FOR LINE WITH LOW-OPACITY INSIDE CIRCLES
# ---------------------------------------------------------
def draw_smart_line(ax, p1, p2, circle_centers, circle_radii, color):
    """
    Segments inside circles → 25% opacity
    Segments outside → 100%
    """

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
            linewidth=1.6 if outside else 1.2,
            alpha=1.00 if outside else 0.25,
            zorder=10
        )


# ---------------------------------------------------------
# PREPARE FIGURE
# ---------------------------------------------------------
fig, ax = plt.subplots(figsize=(10, 10))
ax.set_xlim(0 - PLOT_MARGIN, 1 + PLOT_MARGIN)
ax.set_ylim(0 - PLOT_MARGIN, 1 + PLOT_MARGIN)
ax.set_aspect("equal")
ax.axis("off")

cell_centres = random_cell_positions(N_CELLS)
living_centres = cell_centres.copy()
function_centres = [
    ring_positions_inside_cell(c, CELL_RADIUS, len(FUNCTIONS), FUNCTION_RADIUS)
    for c in cell_centres
]

all_circle_centres = []
all_circle_radii = []

for i, c in enumerate(cell_centres):
    all_circle_centres.append(c)
    all_circle_radii.append(LIVING_RADIUS)
    for fc in function_centres[i]:
        all_circle_centres.append(fc)
        all_circle_radii.append(FUNCTION_RADIUS)


# ---------------------------------------------------------
# DRAW CONNECTION LINES WITH PROGRESS BAR
# ---------------------------------------------------------
total_connections = N_CELLS * len(FUNCTIONS) * (N_CELLS)   # approx upper bound
counter = 0

for i, liv in enumerate(living_centres):

    # internal connections
    for (fx, fy), fname in zip(function_centres[i], FUNCTIONS):
        color = FUNC_COLOR_MAP[fname]
        draw_smart_line(ax, liv, (fx, fy),
                        all_circle_centres, all_circle_radii, color)
        counter += 1
        progress_bar(counter, total_connections, prefix="Drawing connections")

    # external connections
    for j, funcs in enumerate(function_centres):
        if i == j:
            continue
        for (fx, fy), fname in zip(funcs, FUNCTIONS):
            color = FUNC_COLOR_MAP[fname]
            draw_smart_line(ax, liv, (fx, fy),
                            all_circle_centres, all_circle_radii, color)
            counter += 1
            progress_bar(counter, total_connections, prefix="Drawing connections")


# ---------------------------------------------------------
# DRAW CIRCLES AND LABELS (TOP MOST)
# ---------------------------------------------------------
for ci, c in enumerate(cell_centres):

    ax.add_patch(
        patches.Circle(c, LIVING_RADIUS,
                       fill=True, color=LIVING_COLOR,
                       linewidth=3.0, edgecolor=LIVING_OUTLINE,
                       zorder=22)
    )
    plt.text(c[0], c[1], "living", ha='center', va='center',
             fontsize=10, color="black", zorder=23)

    for (fx, fy), fname in zip(function_centres[ci], FUNCTIONS):
        col = FUNC_COLOR_MAP[fname]
        ax.add_patch(
            patches.Circle(
                (fx, fy), FUNCTION_RADIUS,
                fill=True, color="white",
                edgecolor=col, linewidth=3.6,
                zorder=24
            )
        )
        plt.text(fx, fy, fname,
                 ha='center', va='center',
                 fontsize=8, color=col,
                 zorder=25)

    # Draw the cell border last with the highest zorder so the dashed outline
    # stays on top of circles, labels, and connection lines.
    ax.add_patch(
        patches.Circle(c, CELL_RADIUS, fill=False,
                       linestyle="--", color=CELL_BORDER_COLOR,
                       linewidth=2.6, zorder=50)
    )


# ---------------------------------------------------------
# SAVE
# ---------------------------------------------------------
plt.savefig("multicell_network_styled.png", dpi=300,
            bbox_inches="tight", pad_inches=0.2)
print("\nSaved multicell_network_styled.png")
