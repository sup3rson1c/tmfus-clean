"""Build the "stamp lifted, ink on the page" keyframe from the real film frame.

Image models redraw the whole page when asked to lift the stamp off it: the
ruled lines on the left half came back ~16px off, which plays as the page
quietly re-drawing itself in the clip. So this frame is assembled from the
frame the audience has just seen (k6) instead:

  1. A model of the clean page is rendered for the area under k6's resting
     hand: paper tone from a smooth fit of k6's own clean paper; the ruled
     lines, box edges and page edges drawn from cross-section profiles
     measured off k6 itself, on their measured geometry.
  2. Wherever k6 already matches that model it is kept; only the pixels that
     do not (the hand and its shadow) are replaced. Desk under the hand is
     filled from the surrounding desk.
  3. The seal is drawn procedurally (rings round a rose-engine rosette, the
     hero disc's guilloche) and laid on the page plane. The plane comes from
     the box: its two vanishing points give the focal length, which rectifies
     the box, so the circle lands in true perspective.

Usage: python tools/film-ink-frame.py   (run from the sandbox root)
Writes media/film/v2/ks-plate.png (clean page), ks.png (with the seal) and
ks-seal.png (seal coverage, for reuse in later keyframes).
"""
import math

import cv2
import numpy as np

ROOT = "media/film/"
k6 = cv2.imread(ROOT + "k6.png").astype(np.float32)
H, W = k6.shape[:2]
gray = cv2.cvtColor(k6.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# --- Measured geometry in k6 (LSD, refined below) --------------------------
A, B, C, D = (818, 884), (1917, 392), (2110, 565), (995, 1085)  # box TL TR BR BL
LINES = [((1045, 1138), (2162, 609)), ((1078, 1177), (2200, 641)), ((1111, 1216), (2238, 673)),
         ((1144, 1255), (2277, 705)), ((1177, 1294), (2314, 740))]
LEFT_EDGE = ((438, 671), (1089, 1407))     # page's left edge (top surface)
BOTTOM_EDGE = ((1920, 1397), (2751, 962))  # page's lower-right edge
HANDBOX = (930, 1050, 2030, H)             # k6's resting hand lives in here
SEAL_CENTER = (1250, 1170)                 # centre of the stamp's footprint in the pressed frame
SEAL_RADIUS = 0.74                         # in box heights, on the page plane


def refine(p, q, t0, t1, n=40, darkest=True):
    """Snap a segment onto the stroke's centre (or an edge's steepest point):
    sample perpendicular profiles on a clean stretch and fit a line."""
    p, q = np.float64(p), np.float64(q)
    d = (q - p) / np.linalg.norm(q - p)
    nv = np.array([-d[1], d[0]])
    pts = []
    for t in np.linspace(t0, t1, n):
        c = p + (q - p) * t
        offs = np.arange(-7, 7.01, 0.25)
        vals = np.array([cv2.getRectSubPix(gray, (1, 1), tuple(c + nv * o))[0, 0] for o in offs])
        k = int(np.argmin(vals)) if darkest else int(np.argmax(np.abs(np.gradient(vals))))
        if 0 < k < len(vals) - 1:
            pts.append(c + nv * offs[k])
    vx, vy, x0, y0 = cv2.fitLine(np.float32(pts), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
    snap = lambda r: np.array([x0, y0]) + np.dot(r - [x0, y0], [vx, vy]) * np.array([vx, vy])
    return tuple(snap(p)), tuple(snap(q))


LINES = [refine(p, q, 0.6, 0.95) for p, q in LINES]
A, D = refine(A, D, 0.1, 0.85)
_, C = refine(D, C, 0.35, 0.9)
LEFT_EDGE = refine(*LEFT_EDGE, 0.1, 0.6, darkest=False)
BOTTOM_EDGE = refine(*BOTTOM_EDGE, 0.3, 0.95, darkest=False)


def seg_dist(p, q):
    """Unsigned distance from every pixel to segment p-q."""
    p, q = np.float32(p), np.float32(q)
    d = q - p
    t = np.clip(((xx - p[0]) * d[0] + (yy - p[1]) * d[1]) / float(d @ d), 0, 1)
    return np.hypot(xx - (p[0] + t * d[0]), yy - (p[1] + t * d[1]))


def side(p, q, inside):
    """Signed distance to the infinite line p-q, positive on `inside`'s side."""
    p, q = np.float32(p), np.float32(q)
    d = (q - p) / np.linalg.norm(q - p)
    n = np.array([-d[1], d[0]], np.float32)
    s = 1.0 if (np.float32(inside) - p) @ n > 0 else -1.0
    return ((xx - p[0]) * n[0] + (yy - p[1]) * n[1]) * s


def profile(p, q, t0, t1, half, signed_to=None, n=60):
    """Average cross-section of a stroke/edge on a clean stretch, as a lookup
    from (signed) distance to BGR. Offsets in 0.25px steps."""
    p, q = np.float64(p), np.float64(q)
    d = (q - p) / np.linalg.norm(q - p)
    nv = np.array([-d[1], d[0]])
    if signed_to is not None and (np.float64(signed_to) - p) @ nv < 0:
        nv = -nv
    offs = np.arange(-half, half + 0.01, 0.25)
    acc = np.zeros((len(offs), 3))
    for t in np.linspace(t0, t1, n):
        c = p + (q - p) * t
        acc += np.array([cv2.getRectSubPix(k6, (1, 1), tuple(c + nv * o))[0, 0] for o in offs])
    return offs, acc / n


# --- 1. Paper tone: quadratic fit on k6's clean paper around the hand ------
page_in = (side(*LEFT_EDGE, (2000, 700)) > 0) & (side(*BOTTOM_EDGE, (2000, 700)) > 0)
near_line = np.zeros((H, W), bool)
for p, q in LINES + [(A, D), (D, C), (A, B)]:
    near_line |= seg_dist(p, q) < 7
x0, y0, x1, y1 = HANDBOX
box = np.zeros((H, W), bool)
box[y0:y1, x0:x1] = True
ring = np.zeros((H, W), bool)
ring[max(0, y0 - 220):H, max(0, x0 - 260):min(W, x1 + 260)] = True
ring &= ~box & page_in & ~near_line
ring &= (side(*LEFT_EDGE, (2000, 700)) > 25) & (side(*BOTTOM_EDGE, (2000, 700)) > 25)
ys, xs = np.nonzero(ring)
basis = lambda x, y: np.stack([np.ones_like(x), x / W, y / H, (x / W) ** 2, x * y / (W * H), (y / H) ** 2], -1)
coef = [np.linalg.lstsq(basis(xs.astype(np.float64), ys.astype(np.float64)), k6[ys, xs, c], rcond=None)[0] for c in range(3)]
paper = np.stack([basis(xx.astype(np.float64), yy.astype(np.float64)) @ coef[c] for c in range(3)], -1).astype(np.float32)
resid = k6[ys, xs] - paper[ys, xs]
print(f"paper fit residual: {np.abs(resid).mean():.2f} (mean abs, 0-255)")
rng = np.random.default_rng(7)
grain = float(np.std(resid[:, 1]))
paper += rng.normal(0, grain * 0.8, (H, W, 1)).astype(np.float32)

# --- 2. Ruled lines and box edges from their measured cross-section --------
offs, lp = profile(*LINES[1], 0.6, 0.95, 5)
ratio = (lp / lp[[0, -1]].mean(0)).mean(1)  # darkness relative to paper, per offset
model = paper.copy()
dark = np.ones((H, W), np.float32)
for p, q in LINES + [(A, D), (D, C)]:
    dist = seg_dist(p, q)
    dark = np.minimum(dark, np.interp(dist, offs[offs >= 0], ratio[offs >= 0], right=1.0).astype(np.float32))
model *= dark[..., None]


# --- 3. Page edges and desk ------------------------------------------------
def edge_band(edge, inside, t0, t1):
    o, prof = profile(*edge, t0, t1, 16, signed_to=inside)
    sd = side(*edge, inside)
    band = np.stack([np.interp(sd, o, prof[:, c]) for c in range(3)], -1).astype(np.float32)
    return sd, band


sd_l, band_l = edge_band(LEFT_EDGE, (2000, 700), 0.1, 0.6)
sd_b, band_b = edge_band(BOTTOM_EDGE, (2000, 700), 0.3, 0.95)
sd = np.minimum(sd_l, sd_b)
band = np.where((sd_l < sd_b)[..., None], band_l, band_b)

# Classify k6 inside the hand box: clean where it already matches the model.
res_paper = np.abs(k6 - model).max(-1)
clean = np.zeros((H, W), bool)
clean |= (sd > 14) & (res_paper < 16)                            # clean paper / lines
clean |= (sd < -14) & (gray < 50)                                # clean desk
clean |= (np.abs(sd) <= 14) & (np.abs(k6 - band).max(-1) < 22)   # clean edge
need = (box & ~clean).astype(np.uint8)
need = cv2.morphologyEx(need, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(need)
keep = np.zeros_like(need)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 800:
        keep[lab == i] = 1
# Replace the hand's whole hull, not just the pixels that stand out: bright
# knuckle facets match paper by colour and shadowed ones match the desk, and
# either left behind reads as a ghost. The model matches clean paper to about
# one level, so over-replacing paper costs nothing.
pts = cv2.findNonZero(keep)
keep = np.zeros_like(keep)
cv2.fillConvexPoly(keep, cv2.convexHull(pts), 1)
keep &= box.astype(np.uint8)
need = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))  # soft shadow margin
print(f"replacing {int(need.sum())} px ({100 * need.mean():.1f}% of frame)")

# Desk under the hand: inpaint from desk pixels only. Masking the page too
# stops the fill borrowing paper white across the edge, and masking all of
# `need` stops it borrowing the hand's own silver. Done on a crop, since the
# mask then covers most of the page.
cx0, cy0, cx1, cy1 = x0 - 160, y0 - 160, min(W, x1 + 160), H
roi_mask = ((need > 0) | (sd > -3))[cy0:cy1, cx0:cx1].astype(np.uint8) * 255
desk = k6.copy()
desk[cy0:cy1, cx0:cx1] = cv2.inpaint(k6[cy0:cy1, cx0:cx1].astype(np.uint8), roi_mask, 9, cv2.INPAINT_TELEA)
w_paper = np.clip((sd - 10) / 4, 0, 1)[..., None]
w_desk = np.clip((-sd - 10) / 4, 0, 1)[..., None]
w_band = 1 - w_paper - w_desk
fill = model * w_paper + desk * w_desk + band * w_band

soft = cv2.GaussianBlur(need.astype(np.float32), (0, 0), 5)[..., None]
plate = fill * soft + k6 * (1 - soft)
cv2.imwrite(ROOT + "v2/ks-plate.png", np.clip(plate, 0, 255).astype(np.uint8))
cv2.imwrite(ROOT + "v2/ks-need.png", need * 255)


# --- 4. The page plane, from the box ---------------------------------------
def inter(p1, p2, p3, p4):
    v = np.cross(np.cross([*p1, 1], [*p2, 1]), np.cross([*p3, 1], [*p4, 1]))
    return v[:2] / v[2]


v1 = inter(A, B, D, C)  # along the ruled lines
v2 = inter(A, D, B, C)  # down the page
c0 = np.array([W / 2, H / 2])
f = math.sqrt(abs(-np.dot(v1 - c0, v2 - c0)))
K = np.array([[f, 0, c0[0]], [0, f, c0[1]], [0, 0, 1]])
Kinv = np.linalg.inv(K)
r1 = Kinv @ [*v1, 1]
r2 = Kinv @ [*v2, 1]
nrm = np.cross(r1 / np.linalg.norm(r1), r2 / np.linalg.norm(r2))
nrm /= np.linalg.norm(nrm)


def lift(p):
    ray = Kinv @ [p[0], p[1], 1]
    return ray / np.dot(ray, nrm)


PA, PB, PD = lift(A), lift(B), lift(D)
h_box = np.linalg.norm(PD - PA)
e1 = (PB - PA) / np.linalg.norm(PB - PA)
e2 = (PD - PA) / np.linalg.norm(PD - PA)
print(f"focal {f:.0f}px, box aspect {np.linalg.norm(PB - PA) / h_box:.2f}:1")


def to_img(u, v):
    x = K @ (PA + (e1 * u + e2 * v) * h_box)
    return x[:2] / x[2]


Pc = lift(SEAL_CENTER)
uc, vc = np.dot(Pc - PA, e1) / h_box, np.dot(Pc - PA, e2) / h_box

# --- 5. The seal -----------------------------------------------------------
T = 2400
SH = 8  # fixed-point factor (shift=3): coordinates are scaled, thickness is not
tex = np.zeros((T, T), np.uint8)
cx = cy = T / 2
R = T * 0.47


def pt(x, y):
    return int(round(x * SH)), int(round(y * SH))


def circle(r, w, fill=False):
    cv2.circle(tex, pt(cx, cy), int(round(r * SH)), 255, -1 if fill else max(1, int(round(w))), cv2.LINE_AA, 3)


circle(R, 30)
circle(R * 0.915, 7)
for k in range(96):  # beaded ring
    a = 2 * math.pi * k / 96
    cv2.circle(tex, pt(cx + R * 0.86 * math.cos(a), cy + R * 0.86 * math.sin(a)), int(9 * SH), 255, -1, cv2.LINE_AA, 3)
circle(R * 0.805, 7)
for rr, petals, depth, copies, width in [(R * 0.76, 16, 0.34, 10, 3), (R * 0.5, 11, 0.4, 7, 3)]:
    t = np.linspace(0, 2 * math.pi, 4000, endpoint=False)
    rad = rr * (1 - depth / 2 + depth / 2 * np.cos(petals * t))
    base = np.stack([rad * np.cos(t), rad * np.sin(t)], -1)
    for j in range(copies):
        a = 2 * math.pi * j / (copies * petals)
        rot = base @ np.array([[math.cos(a), math.sin(a)], [-math.sin(a), math.cos(a)]])
        cv2.polylines(tex, [np.int32(np.round((rot + [cx, cy]) * SH))], True, 255, width, cv2.LINE_AA, 3)
circle(R * 0.22, 6)
circle(R * 0.07, 0, fill=True)

src = np.float32([[0, 0], [T, 0], [T, T], [0, T]])
dst = np.float32([to_img(uc - SEAL_RADIUS, vc - SEAL_RADIUS), to_img(uc + SEAL_RADIUS, vc - SEAL_RADIUS),
                  to_img(uc + SEAL_RADIUS, vc + SEAL_RADIUS), to_img(uc - SEAL_RADIUS, vc + SEAL_RADIUS)])
seal = cv2.warpPerspective(tex, cv2.getPerspectiveTransform(src, dst), (W, H), flags=cv2.INTER_AREA).astype(np.float32) / 255
# A real impression: slightly uneven pressure, paper tooth breaking the ink.
press = 0.9 + 0.1 * np.cos((xx - SEAL_CENTER[0]) / 170.0) * np.cos((yy - SEAL_CENTER[1]) / 140.0)
tooth = 1 - 0.22 * (rng.random((H, W)) < 0.05)
seal = np.clip(cv2.GaussianBlur(seal, (0, 0), 0.6) * press * tooth, 0, 1)
cv2.imwrite(ROOT + "v2/ks-seal.png", (seal * 255).astype(np.uint8))

INK = np.array([24, 25, 27], np.float32)
out = plate * (1 - 0.92 * seal[..., None]) + INK * 0.92 * seal[..., None]
cv2.imwrite(ROOT + "v2/ks.png", np.clip(out, 0, 255).astype(np.uint8))
print("wrote media/film/v2/ks-plate.png, ks.png, ks-seal.png")
