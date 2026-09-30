"""Merge an AI-edited keyframe back onto the frame it was edited from.

Image models re-render the whole picture when they edit one part of it, so the
parts that were meant to stay put drift: ruled lines shift a few pixels, the
grade moves, edges soften. When that keyframe becomes a clip's end frame, the
drift plays as the page quietly redrawing itself. This keeps the original
pixels everywhere except where the edit actually changed something.

  1. Scale the edit to the base's size and register it to the base with a
     feature-matched homography (SIFT + RANSAC), so small reframing is undone.
  2. Diff the registered edit against the base, keep only the large changed
     regions, and feather that mask.
  3. Composite: edit inside the mask, original base everywhere else.

Usage:
  python tools/keyframe-merge.py BASE EDIT OUT [--thresh 38] [--grow 28]
      [--feather 21] [--min-area 4000] [--keep x0,y0,x1,y1 ...]
      [--drop x0,y0,x1,y1 ...] [--mask-out mask.png]

--keep forces a box (base pixel coords) into the mask; --drop removes one.
Writes OUT plus OUT-mask.png for inspection.
"""
import argparse

import cv2
import numpy as np


def boxes(values):
    return [tuple(int(v) for v in b.split(",")) for b in values or []]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("edit")
    ap.add_argument("out")
    ap.add_argument("--thresh", type=float, default=38)
    ap.add_argument("--grow", type=int, default=28)
    ap.add_argument("--feather", type=int, default=21)
    ap.add_argument("--min-area", type=int, default=4000)
    ap.add_argument("--keep", nargs="*")
    ap.add_argument("--drop", nargs="*")
    ap.add_argument("--no-register", action="store_true")
    a = ap.parse_args()

    base = cv2.imread(a.base, cv2.IMREAD_COLOR)
    edit = cv2.imread(a.edit, cv2.IMREAD_COLOR)
    h, w = base.shape[:2]
    edit = cv2.resize(edit, (w, h), interpolation=cv2.INTER_LANCZOS4)

    if not a.no_register:
        g1 = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
        g2 = cv2.cvtColor(edit, cv2.COLOR_BGR2GRAY)
        # SIFT, not AKAZE: this OpenCV build ships without AKAZE.
        det = cv2.SIFT_create(nfeatures=8000)
        k1, d1 = det.detectAndCompute(g1, None)
        k2, d2 = det.detectAndCompute(g2, None)
        matches = cv2.BFMatcher(cv2.NORM_L2).knnMatch(d2, d1, k=2)
        good = [m for m, n in (p for p in matches if len(p) == 2) if m.distance < 0.75 * n.distance]
        if len(good) >= 12:
            src = np.float32([k2[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
            dst = np.float32([k1[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
            H, inl = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
            if H is not None:
                edit = cv2.warpPerspective(edit, H, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
                print(f"registered: {int(inl.sum())}/{len(good)} inliers")
                print("homography:", np.round(H, 4).tolist())
        else:
            print(f"registration skipped: only {len(good)} matches")

    diff = cv2.absdiff(cv2.GaussianBlur(base, (0, 0), 3), cv2.GaussianBlur(edit, (0, 0), 3)).max(axis=2)
    mask = (diff > a.thresh).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    keep = np.zeros_like(mask)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= a.min_area:
            keep[lab == i] = 255
    for x0, y0, x1, y1 in boxes(a.keep):
        keep[y0:y1, x0:x1] = 255
    if a.grow:
        keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (a.grow * 2 + 1,) * 2))
    # Fill holes, so a changed object is replaced whole, not as a lace of
    # above-threshold pixels.
    cnts, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    keep = np.zeros_like(keep)
    cv2.drawContours(keep, cnts, -1, 255, thickness=cv2.FILLED)
    for x0, y0, x1, y1 in boxes(a.drop):
        keep[y0:y1, x0:x1] = 0
    soft = cv2.GaussianBlur(keep.astype(np.float32) / 255, (0, 0), a.feather)[..., None]

    out = (edit.astype(np.float32) * soft + base.astype(np.float32) * (1 - soft)).round().astype(np.uint8)
    cv2.imwrite(a.out, out)
    stem = a.out.rsplit(".", 1)[0]
    cv2.imwrite(stem + "-mask.png", (soft[..., 0] * 255).astype(np.uint8))
    print(f"changed area: {100 * keep.mean() / 255:.1f}% of frame -> {a.out}")


if __name__ == "__main__":
    main()
