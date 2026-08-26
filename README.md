# Lash & Brow Anatomy Trainer

An interactive 3D teaching tool for cosmetology students learning eyelash
extensions and eyebrow lamination and shaping. Students set up a face using
measurable anatomical controls, plan a lash or brow design on it, and rotate
to profile view to watch whether the plan works — the fit test the industry
has never had.

**Live app:** https://doughboydee.github.io/Artistry-and-Bloom/

## Status

Phase 1 of 6: procedural stand-in head with orbit/front/profile cameras and
the first four anatomy sliders (brow bone projection, eye depth, upper lid
crease height, outer corner tilt). See `MESH_SPEC.md` for what the future
sculpted head must provide.

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
