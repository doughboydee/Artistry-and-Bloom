# Head Mesh Specification

**Who this is for:** the 3D artist sculpting the realistic head that will replace
the app's built-in stand-in head. You do not need to know anything about how the
app is programmed. If you deliver a file that follows this document, the app can
load it without any code changes.

**What the app does with your file:** students move sliders (brow bone
projection, eye depth, crease height, and so on) and the face changes smoothly.
The app then grows eyelashes and brow hairs on the face and tests, with real
geometry, whether a lash extension design collides with the eyelid or hides
behind the brow bone. Your mesh is the surface those tests run against, so
accuracy in the eye region matters more than anywhere else.

---

## 1. File format

- One **glTF binary file** (`.glb`), glTF 2.0.
- No textures required. The app displays the head in a neutral clay material.
  (You may include a UV layout for the future, but nothing depends on it.)
- No rig/skeleton/animation. Only morph targets (section 4).

## 2. Units, orientation, and pose

- **1 unit = 1 millimeter.** A whole head is roughly 200 units tall. Real
  measurements are used everywhere in the app (a 12 mm lash extension is 12
  units long), so this is not negotiable.
- Axes: **+Y is up, +Z points out of the face** (the direction the person is
  looking), **+X is the subject's anatomical left** — which appears on the
  *viewer's right* when looking at the face.
- Place the head so the **origin (0,0,0) sits between the eyes at pupil level**,
  centered left-to-right.
- Neutral pose: eyes open naturally, relaxed brow, no expression.

## 3. Objects in the file

The file must contain exactly these objects, with these names:

| Object name | What it is |
|---|---|
| `skin` | One single connected mesh: eyelids, brow, forehead, nose, cheeks, and enough of the skull silhouette that a profile view reads correctly. |
| `eye_L`, `eye_R` | The two eyeballs, separate objects (they are excluded from the collision tests). Simple spheres with an iris/pupil are fine. `_L` is the subject's left eye (on +X). |

Rules for `skin`:

- It must be **one manifold surface in the eye region** — no separate
  overlapping shells for lid vs. brow vs. cheek. The collision test measures
  distances to this surface; hidden double-walls make it lie.
- The eye openings are real holes bounded by the lid margins.
- Keep it under **50,000 triangles**. The app re-computes the deforming mesh on
  every slider movement, so lighter is better; detail budget should be spent on
  lids, crease, and brow, not the back of the head (the back of the head may be
  absent entirely).

## 4. Morph targets (shape keys)

The sliders work through **morph targets** (Blender calls them *shape keys*):
saved alternate positions of the same vertices that the app blends toward.

- The base shape is the neutral pose.
- Each morph target must be named **exactly** as below (these are the names the
  app looks up — spelling and capitalization matter).
- Vertex count and ordering must be identical across the base and every morph
  (this is automatic if you sculpt shape keys in one Blender file and never
  add/delete vertices after creating them).
- Each morph at **full strength (1.0)** must correspond to the physical
  measurement listed. At strength 0 the head shows the *minimum* of each range —
  note that for most morphs the neutral sculpt itself should sit at the
  *midpoint* of the range, with the morph carrying it to the maximum, and a
  paired understanding that the app runs some morphs "negative"; if your
  software cannot do negative shape keys, sculpt the base at the range minimum
  and the morph at the maximum.

| Morph name | 0.0 means | 1.0 means |
|---|---|---|
| `browProjection` | brow ridge flat (0 mm) | ridge projects 9 mm forward |
| `eyeDepth` | globe 2.5 mm forward of neutral (protruding) | globe 4.5 mm behind neutral (deep-set) |
| `creaseHeight` | crease 1.5 mm above the lash margin (nearly absent) | crease 12 mm above the margin |
| `lidHooding` | no drape | skin drapes 6 mm down over the crease, heaviest over the outer third |
| `outerCornerTilt` | outer corner 6° below the inner corner | outer corner 10° above |
| `eyeSpacing` | inner corners 28 mm apart | 42 mm apart |
| `eyeOpening` | 7 mm vertical opening | 13 mm |
| `eyeLength` | 24 mm corner-to-corner | 32 mm |
| `noseBaseWidth` | nostril-to-nostril outer width 28 mm | 42 mm |
| `age` | young adult (~20): full brow fat pad, taut lid | elderly (~80): the brow drops ~4 mm as its fat pad shrinks, the upper lid skin loosens and drapes ~4 mm over the crease, the socket hollows ~1–2 mm, and the globe settles ~2 mm back |

Important limits:

- `outerCornerTilt` is a rotation, and morphs blend in straight lines, so keep
  the range to what is listed (±8–10°); larger rotations will distort.
- Morphs must move **both eyes symmetrically**.
- The eyeballs (`eye_L`/`eye_R`) need morphs only where they move:
  `eyeSpacing` and `eyeDepth` translate them; all other morphs leave them
  untouched.

## 5. The lash line (critical)

The app must know exactly where the upper lid margin runs so it can grow lashes
there — and this line must **move with the morphs**.

Deliver it as two dedicated mesh objects:

| Object name | What it is |
|---|---|
| `lashLine_L`, `lashLine_R` | A single open chain of edges (a polyline) lying exactly on the upper lid margin, running **from the inner corner to the outer corner**, with **at least 30 points**, roughly evenly spaced. |

- These objects must carry **the same morph targets** as `skin` (in Blender:
  sculpt them as part of the skin mesh, then separate the edge chain into its
  own object *after* the shape keys exist, so the keys come along).
- The chain must sit on the margin where the lashes actually emerge — the
  outer edge of the lid, not the waterline.
- The same idea applies to the brow: `browLine_L`, `browLine_R` — a polyline
  along the center of each brow from the inner end (head) to the outer end
  (tail), at least 20 points, with the same morphs.

## 6. Landmark points

Add **empty objects** (plain locator points, no geometry) at these positions,
named exactly:

| Name | Position |
|---|---|
| `pupil_L`, `pupil_R` | center of each pupil |
| `innerCanthus_L`, `innerCanthus_R` | inner corner of each eye |
| `outerCanthus_L`, `outerCanthus_R` | outer corner of each eye |
| `nostrilOuter_L`, `nostrilOuter_R` | outermost point of each nostril wing |

The app draws the brow-mapping teaching lines from these (nostril → inner
corner, nostril → pupil, nostril → outer corner), so their placement is part of
the lesson. Landmarks should be parented/anchored so they follow the
`eyeSpacing`, `eyeLength`, `outerCornerTilt`, and `noseBaseWidth` morphs; if
your export cannot animate empties with morphs, place them for the *neutral*
head and note it in delivery — the app can re-derive moved landmarks from the
lash-line chains.

## 7. What is deliberately NOT in this file

- **No ancestry, race, or ethnicity labels of any kind** — not in object names,
  morph names, or notes. Every control is a measurable anatomical feature.
  This is a hard project rule.
- No hair, no eyelashes, no eyebrows sculpted into the mesh. The app generates
  all hair procedurally; sculpted hair would fight the collision tests.
- No skin textures or materials (clay display).

## 8. Delivery checklist

- [ ] One `.glb`, glTF 2.0, no textures/rig required
- [ ] 1 unit = 1 mm, +Y up, +Z out of the face, origin between the eyes
- [ ] Objects: `skin`, `eye_L`, `eye_R`, `lashLine_L/R`, `browLine_L/R`, 8 landmark empties
- [ ] `skin` ≤ 50k triangles, one manifold surface around the eyes, real eye-opening holes
- [ ] All 9 morphs, exact names, calibrated to the table in section 4
- [ ] Lash/brow line objects carry the same morphs
- [ ] Both-eyes symmetry on every morph
- [ ] Node transforms are fine (the app bakes them in on load), but keep
      unit scale honest: 1 unit must equal 1 mm after all transforms
- [ ] Known limit to design around: morphs blend in straight lines, so a
      slider's in-between positions are linear mixes of neutral and maximum.
      Sculpt each morph so its midpoint also looks anatomically right —
      check 0.5 on every slider, not just the endpoints. Combined extremes
      (e.g. full hooding + full age) will overshoot slightly on a morph
      head compared to the built-in head; acceptable if the fit-test
      verdict stays equivalent (the app's round-trip test checks this)

## Glossary

- **Mesh** — a 3D surface made of many small triangles connected at points
  (vertices).
- **Vertex (plural vertices)** — one point on a mesh. A morph target works by
  storing a second position for every vertex.
- **Morph target / shape key** — a saved alternate shape of the same mesh, used
  to blend smoothly between two forms. "Shape key" is Blender's word for it.
- **Manifold** — a surface with no holes (other than intentional ones), no
  self-intersections, and no doubled-up internal walls; a clean "watertight"
  skin.
- **glTF / .glb** — a standard 3D file format for the web; `.glb` is its
  single-file binary form. Blender exports it natively.
- **Polyline / edge chain** — a connected series of straight segments through a
  list of points, like a dot-to-dot line in 3D.
- **Empty / locator** — an object that marks a position in 3D space but has no
  visible surface.
- **Palpebral fissure** — the eye opening between the upper and lower lid
  margins.
- **Canthus** — a corner of the eye (inner: by the nose; outer: by the temple).
