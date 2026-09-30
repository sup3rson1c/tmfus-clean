"""Work out how much money has left the syringe on each frame of the final
beat and store it in the frame manifest, so the funded counter climbs exactly
as the barrel empties instead of on a guessed schedule.

Usage: python tools/film-drain.py [--beat 11]   (after tools/film-frames.mjs)

HOW THIS USED TO BE WRONG, because it is worth not repeating. The beat is cut
from three generated clips joined on four keyframes that were drawn as "full",
"half", "an eighth left" and "empty", and this script used to take those names
as the truth: it stretched a pixel score onto anchors of 0, 0.5, 0.875, 1.0.
Only the names were never measured. The barrel is very nearly side-on - its
silhouette runs 204px at the back and 214px at the nozzle - so how much money
is left is simply how far along the barrel the stopper still has to go, and by
that measure the "half" frame is a quarter drained and the "eighth left" frame
is barely over half. The counter was reporting a number the picture did not
support, and worse, tools/film-frames.mjs was spending frames to match it, so
the last clip had to cover 40% of the barrel in 18% of the beat and the
stopper lurched. Do not re-introduce hand-declared anchors here.

What it does instead: film-frames.mjs already measures where the stopper is on
every frame it keeps and writes that into the manifest as `track`. This reads
it, converts position to volume through the barrel's own measured silhouette
(a slice of a cylinder is pi*r^2*dx, and r is half the silhouette height), and
normalises. Nothing is declared; every number comes from the frames.

The normalisation does quietly round away the nozzle's dead volume - the
stopper seats against the cone with the cone still full - but a syringe that
has seated its stopper reads as delivered, and the counter has to land on the
funded figure exactly when the picture stops moving.
"""
import argparse
import glob
import json

import cv2
import numpy as np

# The band the barrel spans, and how bright a pixel has to be to be part of it
# rather than the black room behind. Only used to measure the silhouette.
BAND = (330, 720)
LIT = 50  # the back of the barrel is dimmer than the rest; 70 clipped it

ap = argparse.ArgumentParser()
ap.add_argument("--beat", type=int, default=11)
beat = ap.parse_args().beat

path = "media/film/frames/manifest.json"
manifest = json.load(open(path, encoding="utf-8"))
entry = next(b for b in manifest["beats"] if b["beat"] == beat)
track = entry.get("track")
if not track:
    raise SystemExit(f"beat {beat} has no `track` in the manifest - re-run tools/film-frames.mjs")

files = sorted(glob.glob(f"media/film/frames/d/b{beat}/*.webp"))
if len(files) != len(track):
    raise SystemExit(f"{len(files)} frames on disk, manifest tracks {len(track)}")

# The barrel's silhouette, read off the last frame: by then everything from the
# back rim to the stopper is empty glass, so nothing is in the way.
last = cv2.cvtColor(cv2.imread(files[-1]), cv2.COLOR_BGR2GRAY)[BAND[0]:BAND[1]]
x0, x1 = int(min(track)), int(max(track))
height = np.zeros(x1 - x0 + 1, float)
for i, x in enumerate(range(x0, x1 + 1)):
    lit = np.flatnonzero(last[:, x] > LIT)
    height[i] = lit[-1] - lit[0] if len(lit) > 8 else np.nan
lit = np.flatnonzero(~np.isnan(height))
height = np.interp(np.arange(len(height)), lit, height[lit])
height = np.convolve(np.pad(height, 15, mode="edge"), np.ones(31) / 31, mode="valid")

# Volume swept by the time the stopper reaches x, in arbitrary units.
swept = np.concatenate([[0.0], np.cumsum(height**2)])
at = np.clip(np.round(np.array(track, float)).astype(int) - x0, 0, len(swept) - 1)
drain = swept[at]
drain = np.maximum.accumulate(drain)  # the counter must never tick backwards
drain = (drain - drain[0]) / (drain[-1] - drain[0])

entry["drain"] = [round(float(v), 4) for v in drain]
with open(path, "w", encoding="utf-8") as fh:
    fh.write(json.dumps(manifest, indent=2) + "\n")

print(f"beat {beat}: {len(drain)} frames, stopper {x0} -> {x1}px")
print(f"  barrel silhouette across that travel: {height.min():.0f}px to {height.max():.0f}px")
print("  drain at 10..90% of the beat:", [round(float(drain[int(len(drain) * q)]), 3) for q in np.arange(0.1, 1, 0.1)])
step = np.diff(drain)
print(f"  per frame: min {step.min() * 100:.2f}% max {step.max() * 100:.2f}% of the barrel")
