# Lash & Brow Anatomy Trainer

An interactive 3D teaching tool for cosmetology students learning eyelash
extensions and eyebrow lamination and shaping. Students set up a face using
measurable anatomical controls, plan a lash or brow design on it, and rotate
to profile view to watch whether the plan works — the fit test the industry
has never had.

**Live app:** https://doughboydee.github.io/Artistry-and-Bloom/
**User manual:** https://doughboydee.github.io/Artistry-and-Bloom/manual.html
**Student guide (fit test deep-dive):** https://doughboydee.github.io/Artistry-and-Bloom/guide.html

## Features

**Anatomy** — a procedural stand-in head driven by ten measurable controls
(brow projection, eye depth, crease height, lid hooding, corner tilt, eye
spacing/opening/length, nose width, age). The age slider descends the brow,
drapes the lid, hollows the socket, and thins the natural lashes and brow
tails, so the same design visibly starts to fail on an older face.

**Lash design** — procedural natural lashes plus extensions with real
curl-family geometry (B/C/CC/D/L/M as measured heading-angle curves), a
zone-based map editor (3–9 zones), and nine preset maps: natural, cat eye,
doll eye, squirrel, open eye, fox eye, kitten, wispy (with a per-zone spike
texture), and eyeliner effect.

**The fit test** — every extension is measured against the actual 3D skin:
collision (red = touches the lid, amber = inside the safety margin) and
straight-ahead occlusion (ghosted = hidden behind the hood from the front),
with per-eye plain-language summaries and side-by-side comparison of one
design on two faces. The **precision check** is the second, independent
rule: any zone longer than the generated natural lashes + 2 mm is flagged
as follicle overload.

**Mapping** — the **on-lid lash map** draws the under-eye pad map (zone
boundaries + length·curl labels) on the anatomy itself. Brow mapping offers
three industry methods — classic three-point pencil rays, thread mapping
(vertical start/arch lines + a horizontal level-check line with live mm
readout), and the golden-ratio (phi) construction — plus left/right
**symmetry guides** with mm readouts. All lines are recomputed live from
the landmarks as the anatomy changes.

**Instructor tools** — built-in and saved teaching scenarios, shareable
links that encode the whole setup in the URL (validated and clamped on
load), and, under "Advanced", a one-click "Export head for Blender" (.glb
with the sliders baked as shape keys, per `MESH_SPEC.md`) and a loader that
swaps in a sculpted .glb head at runtime.

## Principles

- Every control is a measurable anatomical feature. No ancestry, race, or
  ethnicity anywhere in the tool, its labels, or its code.
- Lashes and brows are generated from the student's settings, never baked
  into the face.
- The fit test uses real geometry — collisions and occlusion are computed
  against the actual 3D surfaces, not looked up from tables.
- Runs in any modern browser. No install, no accounts, no server.

## Development

```
npm install
npm run dev      # local dev server
npm test         # geometry unit tests
npm run build    # type-check + production build
```

Conventions: 1 world unit = 1 millimeter; +Y up; +Z out of the face; origin
between the eyes at pupil level. The app talks to the head only through the
`HeadModel` interface (`src/head/HeadModel.ts`), so the procedural stand-in
(`src/head/procedural/`) can be replaced by a sculpted glTF head without
touching the rest of the code.

Pushes to `main` or the active feature branch deploy to GitHub Pages via
`.github/workflows/deploy.yml`.
