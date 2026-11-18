import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type DataTexture,
} from 'three'
import {
  DEFAULT_SKIN_TONE,
  buildIrisTexture,
  buildSkinNormalTexture,
  skinToneById,
  type HeadAppearance,
} from '../appearance'
import type {
  AnatomyParams,
  BrowRegionSample,
  Eye,
  HeadLandmarks,
  HeadModel,
  LashLineSample,
} from '../HeadModel'
import { resolveAnatomy, type ResolvedAnatomy } from '../calibration'
import { computeEyeFrame, marginPoint, sampleLashLine } from './margins'
import {
  SHELL_COLS,
  SHELL_ROWS,
  SHELL_VERTEX_COUNT,
  buildShellIndices,
  writeShellPositions,
  shellGridXY,
  shellZAt,
  shellNormalAt,
  browArchY,
  eyeCenterX,
  insideEyeHoleFor,
} from './shell'
import {
  ORBITAL_RINGS,
  ORBITAL_ROWS,
  ORBITAL_SECTORS,
  ORBITAL_VERTEX_COUNT,
  S_CREASE,
  buildOrbitalIndices,
  sectorToLid,
  writeOrbitalPositions,
} from './orbital'
import {
  NOSE_PROFILE,
  NOSE_STATIONS,
  NOSE_VERTEX_COUNT,
  buildNoseIndices,
  noseVertexInfo,
  writeNosePositions,
  nostrilOuterLandmarks,
} from './nose'
import {
  MOUTH_COLS,
  MOUTH_ROWS,
  MOUTH_VERTEX_COUNT,
  buildMouthIndices,
  mouthEdgeFade,
  mouthGridXY,
  mouthSampleAt,
  writeMouthPositions,
} from './mouth'

// Eye construction, mm. The iris sits in a real opening in the sclera with a
// clear corneal dome over it, so it catches light and shows depth the way an
// eye does instead of reading as a painted disc.
const GLOBE_R = 12
const IRIS_R = 5.9
const LIMBUS_ANGLE = Math.asin(IRIS_R / GLOBE_R)
const LIMBUS_Z = GLOBE_R * Math.cos(LIMBUS_ANGLE)
const CORNEA_R = 7.9
const LID_MARGIN_SAMPLES = 44

const SHEEN_TINT = new Color('#ffb59a')
const SCATTER_TINT = new Color(1, 0.5, 0.4)
const MARGIN_TINT = new Color(1.0, 0.8, 0.78)
const WHITE = new Color(1, 1, 1)

/** Skin micro-relief texture repeats every this many mm. */
const SKIN_TILE_MM = 12

/**
 * The procedural stand-in head. Anatomically honest about what the fit test
 * measures (brow ridge vs lid, globe depth, lash line, crease, hooding);
 * everything else (lips, jaw, skin and eye shading) is there so the face
 * reads as a face, and never feeds a measurement.
 *
 * Fixed topology: geometry indices are built once; `setParams` only rewrites
 * vertex positions. From the outside it behaves exactly like the future
 * sculpted morph-target head.
 */
export class ProceduralHead implements HeadModel {
  readonly skinMesh: Mesh
  readonly auxMeshes: Group[]
  version = 0

  private params!: AnatomyParams
  private resolved!: ResolvedAnatomy
  private readonly positions: Float32Array
  private readonly geometry: BufferGeometry
  private readonly colors: Float32Array
  private readonly uvs: Float32Array
  private readonly skinMaterial: MeshPhysicalMaterial
  private readonly marginMaterial: MeshPhysicalMaterial
  private readonly skinNormalMap: DataTexture
  private readonly irisMap: DataTexture
  private readonly eyeGroups: Record<Eye, Group>
  private readonly lidMargins: Record<Eye, Mesh>
  private readonly caruncles: Record<Eye, Mesh>
  private appearance: HeadAppearance = { skinTone: DEFAULT_SKIN_TONE }
  private readonly disposables: { dispose(): void }[] = []

  // Float offsets of each region inside the merged position buffer.
  private static readonly SHELL_BASE = 0
  private static readonly ORBITAL_L_BASE = SHELL_VERTEX_COUNT * 3
  private static readonly ORBITAL_R_BASE =
    ProceduralHead.ORBITAL_L_BASE + ORBITAL_VERTEX_COUNT * 3
  private static readonly NOSE_BASE =
    ProceduralHead.ORBITAL_R_BASE + ORBITAL_VERTEX_COUNT * 3
  private static readonly MOUTH_BASE =
    ProceduralHead.NOSE_BASE + NOSE_VERTEX_COUNT * 3
  private static readonly TOTAL_VERTS =
    SHELL_VERTEX_COUNT + 2 * ORBITAL_VERTEX_COUNT + NOSE_VERTEX_COUNT + MOUTH_VERTEX_COUNT

  constructor(initial: AnatomyParams) {
    this.positions = new Float32Array(ProceduralHead.TOTAL_VERTS * 3)
    this.geometry = new BufferGeometry()
    this.colors = new Float32Array(ProceduralHead.TOTAL_VERTS * 3).fill(1)
    this.uvs = new Float32Array(ProceduralHead.TOTAL_VERTS * 2)
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new BufferAttribute(this.colors, 3))
    this.geometry.setAttribute('uv', new BufferAttribute(this.uvs, 2))
    this.geometry.setIndex([
      ...buildShellIndices(),
      ...buildOrbitalIndices(SHELL_VERTEX_COUNT, 'left'),
      ...buildOrbitalIndices(SHELL_VERTEX_COUNT + ORBITAL_VERTEX_COUNT, 'right'),
      ...buildNoseIndices(SHELL_VERTEX_COUNT + 2 * ORBITAL_VERTEX_COUNT),
      ...buildMouthIndices(SHELL_VERTEX_COUNT + 2 * ORBITAL_VERTEX_COUNT + NOSE_VERTEX_COUNT),
    ])

    this.skinNormalMap = buildSkinNormalTexture()
    this.irisMap = buildIrisTexture()
    this.skinMaterial = new MeshPhysicalMaterial({ metalness: 0, side: DoubleSide })
    this.marginMaterial = new MeshPhysicalMaterial({
      metalness: 0,
      roughness: 0.32,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      side: DoubleSide,
    })
    this.skinMesh = new Mesh(this.geometry, this.skinMaterial)
    this.skinMesh.name = 'skin'
    this.skinMesh.castShadow = true
    this.skinMesh.receiveShadow = true

    this.eyeGroups = { left: this.buildEyeball('left'), right: this.buildEyeball('right') }
    this.lidMargins = { left: this.buildLidMargin('left'), right: this.buildLidMargin('right') }
    this.caruncles = { left: this.buildCaruncle('left'), right: this.buildCaruncle('right') }
    const dressing = new Group()
    dressing.name = 'lid_margins'
    dressing.add(
      this.lidMargins.left,
      this.lidMargins.right,
      this.caruncles.left,
      this.caruncles.right,
    )
    this.auxMeshes = [this.eyeGroups.left, this.eyeGroups.right, dressing]
    this.disposables.push(this.skinNormalMap, this.irisMap, this.marginMaterial)

    this.applyAppearance()
    this.setParams(initial)
  }

  /** Display-only settings (skin tone / clay). Never changes geometry. */
  setAppearance(appearance: HeadAppearance): void {
    if (appearance.skinTone === this.appearance.skinTone) return
    this.appearance = { ...appearance }
    this.applyAppearance()
  }

  private applyAppearance(): void {
    const tone = skinToneById(this.appearance.skinTone)
    const m = this.skinMaterial
    const clay = tone.id === 'clay'
    const age = this.params?.age ?? 0
    m.color.set(tone.color)
    if (clay) {
      // The original neutral study surface: form only, no colour cues.
      m.vertexColors = false
      m.normalMap = null
      m.roughness = 0.85
      m.sheen = 0
      m.emissive.set('#000000')
      m.specularIntensity = 1
    } else {
      m.vertexColors = true
      m.normalMap = this.skinNormalMap
      // Skin texture coarsens with age.
      m.normalScale.setScalar(0.2 + 0.45 * age)
      m.roughness = 0.5 + 0.08 * age
      m.specularIntensity = 0.55
      // A soft warm sheen at grazing angles plus a trace of red-shifted
      // self-light stand in for light scattering inside real skin: shadows
      // go warm rather than grey, and the outline is never chalk-hard.
      m.sheen = 0.3
      m.sheenRoughness = 0.5
      m.sheenColor.set(tone.color).lerp(SHEEN_TINT, 0.5)
      m.emissive.set(tone.color).multiply(SCATTER_TINT)
      m.emissiveIntensity = 0.05
    }
    m.needsUpdate = true
    // Wet lid edge and tear-duct tissue: the skin tone pushed toward pink.
    this.marginMaterial.color
      .set(clay ? '#a8968c' : tone.color)
      .multiply(clay ? WHITE : MARGIN_TINT)
  }

  /** Thin strip closing the lid edge down onto the globe (the waterline). */
  private buildLidMargin(eye: Eye): Mesh {
    const verts = LID_MARGIN_SAMPLES * 2 * 2 // (outer + inner) × (upper + lower)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3))
    const indices: number[] = []
    for (let lid = 0; lid < 2; lid++) {
      const base = lid * LID_MARGIN_SAMPLES * 2
      for (let i = 0; i < LID_MARGIN_SAMPLES - 1; i++) {
        const a = base + i * 2
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2)
      }
    }
    geo.setIndex(indices)
    const mesh = new Mesh(geo, this.marginMaterial)
    mesh.name = `lidMargin_${eye === 'left' ? 'L' : 'R'}`
    mesh.receiveShadow = true
    this.disposables.push(geo)
    return mesh
  }

  private buildCaruncle(eye: Eye): Mesh {
    const geo = new SphereGeometry(1, 16, 12)
    const mesh = new Mesh(geo, this.marginMaterial)
    mesh.name = `caruncle_${eye === 'left' ? 'L' : 'R'}`
    mesh.scale.set(1.7, 1.25, 1.0)
    mesh.receiveShadow = true
    this.disposables.push(geo)
    return mesh
  }

  private writeLidMargin(a: ResolvedAnatomy, eye: Eye): void {
    const frame = computeEyeFrame(a, eye)
    const G = frame.globeCenter
    const mesh = this.lidMargins[eye]
    const attr = mesh.geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    let k = 0
    for (const lid of ['upper', 'lower'] as const) {
      for (let i = 0; i < LID_MARGIN_SAMPLES; i++) {
        const M = marginPoint(frame, a, lid, i / (LID_MARGIN_SAMPLES - 1))
        arr[k++] = M.x
        arr[k++] = M.y
        arr[k++] = M.z
        // Inner edge: straight down the globe radius onto the eyeball.
        const dx = M.x - G.x
        const dy = M.y - G.y
        const dz = M.z - G.z
        const f = (frame.globeR + 0.05) / (Math.hypot(dx, dy, dz) || 1)
        arr[k++] = G.x + dx * f
        arr[k++] = G.y + dy * f
        arr[k++] = G.z + dz * f
      }
    }
    attr.needsUpdate = true
    mesh.geometry.computeVertexNormals()
    mesh.geometry.computeBoundingSphere()

    // Tear-duct tissue tucked into the inner corner.
    const up = marginPoint(frame, a, 'upper', 0.07)
    const lo = marginPoint(frame, a, 'lower', 0.07)
    this.caruncles[eye].position.set((up.x + lo.x) / 2, (up.y + lo.y) / 2, (up.z + lo.z) / 2 - 1.1)
  }

  private buildEyeball(eye: Eye): Group {
    const group = new Group()
    group.name = `eye_${eye === 'left' ? 'L' : 'R'}`

    // Sclera: a sphere with a real opening at the front pole for the iris.
    const scleraGeo = new SphereGeometry(
      GLOBE_R,
      56,
      36,
      0,
      Math.PI * 2,
      LIMBUS_ANGLE,
      Math.PI - LIMBUS_ANGLE,
    )
    scleraGeo.rotateX(Math.PI / 2) // pole → +Z (straight-ahead gaze)
    const pos = scleraGeo.getAttribute('position') as BufferAttribute
    const col = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const ang = Math.acos(Math.min(1, Math.max(-1, pos.getZ(i) / GLOBE_R)))
      // Whiter toward the iris, warmer and pinker toward the corners, with a
      // faint grey halo where it meets the limbus.
      const pink = Math.min(1, Math.max(0, (ang - 0.62) / 0.75))
      const halo = Math.exp(-(((ang - LIMBUS_ANGLE) / 0.07) ** 2))
      col[i * 3] = (0.93 - 0.05 * pink) * (1 - 0.3 * halo)
      col[i * 3 + 1] = (0.91 - 0.2 * pink) * (1 - 0.3 * halo)
      col[i * 3 + 2] = (0.88 - 0.22 * pink) * (1 - 0.27 * halo)
    }
    scleraGeo.setAttribute('color', new BufferAttribute(col, 3))
    const scleraMat = new MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    })
    const sclera = new Mesh(scleraGeo, scleraMat)
    sclera.receiveShadow = true

    // Iris: recessed just behind the opening, pupil painted into the map.
    const irisGeo = new CircleGeometry(IRIS_R + 0.25, 48)
    const irisMat = new MeshStandardMaterial({
      map: this.irisMap,
      emissiveMap: this.irisMap,
      emissive: '#ffffff',
      emissiveIntensity: 0.22,
      roughness: 0.55,
    })
    const iris = new Mesh(irisGeo, irisMat)
    iris.position.z = LIMBUS_Z - 0.2
    iris.receiveShadow = true

    // Cornea: a clear dome that contributes reflections only (the catch
    // light), drawn additively over whatever is behind it.
    const corneaAngle = Math.asin(IRIS_R / CORNEA_R)
    const corneaGeo = new SphereGeometry(CORNEA_R, 40, 14, 0, Math.PI * 2, 0, corneaAngle)
    corneaGeo.rotateX(Math.PI / 2)
    const corneaMat = new MeshPhysicalMaterial({
      color: '#000000',
      roughness: 0.03,
      metalness: 0,
      ior: 1.376,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const cornea = new Mesh(corneaGeo, corneaMat)
    cornea.position.z = LIMBUS_Z - CORNEA_R * Math.cos(corneaAngle)
    cornea.renderOrder = 2

    group.add(sclera, iris, cornea)
    this.disposables.push(scleraGeo, scleraMat, irisGeo, irisMat, corneaGeo, corneaMat)
    return group
  }

  setParams(params: AnatomyParams): void {
    this.params = { ...params }
    const a = resolveAnatomy(this.params)
    this.resolved = a

    writeShellPositions(this.positions, ProceduralHead.SHELL_BASE, a)
    writeOrbitalPositions(this.positions, ProceduralHead.ORBITAL_L_BASE, a, 'left')
    writeOrbitalPositions(this.positions, ProceduralHead.ORBITAL_R_BASE, a, 'right')
    writeNosePositions(this.positions, ProceduralHead.NOSE_BASE, a)
    writeMouthPositions(this.positions, ProceduralHead.MOUTH_BASE, a)

    const attr = this.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
    this.geometry.computeVertexNormals()
    this.weldSeamNormals(a)
    this.writeSurfaceAttributes(a)
    this.geometry.computeBoundingSphere()

    for (const eye of ['left', 'right'] as const) {
      const frame = computeEyeFrame(a, eye)
      this.eyeGroups[eye].position.copy(frame.globeCenter)
      this.writeLidMargin(a, eye)
    }
    // Skin relief and roughness follow the age slider.
    this.applyAppearance()

    this.version++
  }

  /**
   * The shell's eye-hole edge and the orbital patch's rim trace the same
   * curve but are separate vertices, so averaged normals differ across the
   * seam and light it up as a hard ring. Overwrite the boundary normals on
   * both sides with the analytic shell normal so they shade identically.
   */
  private weldSeamNormals(a: ResolvedAnatomy): void {
    const normals = this.geometry.getAttribute('normal') as BufferAttribute
    const narr = normals.array as Float32Array
    const parr = this.positions

    // Shell vertices that were snapped onto a hole boundary: their RAW grid
    // position lies inside a hole.
    for (let j = 0; j < SHELL_ROWS; j++) {
      for (let i = 0; i < SHELL_COLS; i++) {
        const raw = shellGridXY(i, j)
        if (!insideEyeHoleFor(raw.x, raw.y, a)) continue
        const vi = j * SHELL_COLS + i
        const n = shellNormalAt(parr[vi * 3]!, parr[vi * 3 + 1]!, a)
        narr[vi * 3] = n.x
        narr[vi * 3 + 1] = n.y
        narr[vi * 3 + 2] = n.z
      }
    }

    // Orbital patches: the rim ring gets the exact shell normal; the ring
    // just inside blends 50/50 so the transition is gradual.
    for (const base of [
      SHELL_VERTEX_COUNT,
      SHELL_VERTEX_COUNT + ORBITAL_VERTEX_COUNT,
    ]) {
      for (const [ring, weight] of [
        [ORBITAL_RINGS + 1, 1], // gasket
        [ORBITAL_RINGS, 1], // rim
        [ORBITAL_RINGS - 1, 0.5],
      ] as const) {
        for (let s = 0; s < ORBITAL_SECTORS; s++) {
          const vi = base + ring * ORBITAL_SECTORS + s
          const n = shellNormalAt(parr[vi * 3]!, parr[vi * 3 + 1]!, a)
          const inv = 1 - weight
          const nx = narr[vi * 3]! * inv + n.x * weight
          const ny = narr[vi * 3 + 1]! * inv + n.y * weight
          const nz = narr[vi * 3 + 2]! * inv + n.z * weight
          const len = Math.hypot(nx, ny, nz) || 1
          narr[vi * 3] = nx / len
          narr[vi * 3 + 1] = ny / len
          narr[vi * 3 + 2] = nz / len
        }
      }
    }

    // Nose and mouth patches: border vertices take the shell normal, the
    // next ring in blends halfway, so neither patch shows an outline.
    const weld = (vi: number, weight: number) => {
      if (weight <= 0) return
      const n = shellNormalAt(parr[vi * 3]!, parr[vi * 3 + 1]!, a)
      const inv = 1 - weight
      const nx = narr[vi * 3]! * inv + n.x * weight
      const ny = narr[vi * 3 + 1]! * inv + n.y * weight
      const nz = narr[vi * 3 + 2]! * inv + n.z * weight
      const len = Math.hypot(nx, ny, nz) || 1
      narr[vi * 3] = nx / len
      narr[vi * 3 + 1] = ny / len
      narr[vi * 3 + 2] = nz / len
    }
    const noseV = ProceduralHead.NOSE_BASE / 3
    for (let j = 0; j < NOSE_STATIONS; j++) {
      for (let i = 0; i < NOSE_PROFILE; i++) {
        weld(noseV + j * NOSE_PROFILE + i, noseVertexInfo(j, i).edge)
      }
    }
    const mouthV = ProceduralHead.MOUTH_BASE / 3
    for (let j = 0; j < MOUTH_ROWS; j++) {
      for (let i = 0; i < MOUTH_COLS; i++) {
        const d = Math.min(i, MOUTH_COLS - 1 - i, j, MOUTH_ROWS - 1 - j)
        weld(mouthV + j * MOUTH_COLS + i, d === 0 ? 1 : d === 1 ? 0.66 : d === 2 ? 0.33 : 0)
      }
    }
    normals.needsUpdate = true
  }

  /**
   * Per-vertex colour modulation and texture coordinates. Colours are
   * multipliers on the chosen skin tone (so one set works for every tone):
   * warmth in the cheeks and nose tip, a cooler shadow under the eye, the
   * pinker lid edge, a soft line in the crease, lips and nostrils.
   */
  private writeSurfaceAttributes(a: ResolvedAnatomy): void {
    const p = this.positions
    const c = this.colors
    const uv = this.uvs
    const xe = eyeCenterX(a)
    const total = ProceduralHead.TOTAL_VERTS

    const mul = (vi: number, r: number, g: number, b: number, w: number) => {
      c[vi * 3] = c[vi * 3]! * (1 + (r - 1) * w)
      c[vi * 3 + 1] = c[vi * 3 + 1]! * (1 + (g - 1) * w)
      c[vi * 3 + 2] = c[vi * 3 + 2]! * (1 + (b - 1) * w)
    }

    for (let vi = 0; vi < total; vi++) {
      const x = p[vi * 3]!
      const y = p[vi * 3 + 1]!
      uv[vi * 2] = x / SKIN_TILE_MM
      uv[vi * 2 + 1] = y / SKIN_TILE_MM
      c[vi * 3] = c[vi * 3 + 1] = c[vi * 3 + 2] = 1
      const ax = Math.abs(x)
      const cheek = Math.exp(-(((ax - 36) / 17) ** 2) - ((y + 30) / 15) ** 2)
      const noseTip = Math.exp(-((x / 13) ** 2) - ((y + 23) / 10) ** 2)
      const flush = Math.min(1, cheek + 0.8 * noseTip)
      mul(vi, 1.03, 0.9, 0.89, flush)
      // Thin under-eye skin reads cooler and a little darker, more with age.
      const underEye = Math.exp(-(((ax - xe) / 15) ** 2) - ((y + 12) / 5.5) ** 2)
      mul(vi, 0.9, 0.86, 0.9, underEye * (0.5 + 0.5 * a.age))
      // Chin and forehead carry a touch less colour than the mid-face.
      const pale = Math.exp(-(((y - 55) / 28) ** 2))
      mul(vi, 1.02, 1.02, 1.0, pale)
    }

    for (const base of [ProceduralHead.ORBITAL_L_BASE / 3, ProceduralHead.ORBITAL_R_BASE / 3]) {
      for (let s = 0; s < ORBITAL_ROWS; s++) {
        const lidSkin = Math.max(0, 1 - s / (ORBITAL_RINGS - 2))
        const margin = s === 0 ? 1 : s === 1 ? 0.6 : s === 2 ? 0.25 : 0
        const crease = Math.exp(-(((s - S_CREASE) / 1.1) ** 2))
        for (let i = 0; i < ORBITAL_SECTORS; i++) {
          const vi = base + s * ORBITAL_SECTORS + i
          const upper = sectorToLid(i).lid === 'upper'
          mul(vi, 0.97, 0.92, 0.91, lidSkin)
          mul(vi, 0.96, 0.76, 0.74, margin)
          mul(vi, 0.84, 0.76, 0.74, crease * (upper ? 0.75 : 0.35))
        }
      }
    }

    const noseV = ProceduralHead.NOSE_BASE / 3
    for (let j = 0; j < NOSE_STATIONS; j++) {
      for (let i = 0; i < NOSE_PROFILE; i++) {
        mul(noseV + j * NOSE_PROFILE + i, 0.16, 0.09, 0.08, noseVertexInfo(j, i).nostril * 0.92)
      }
    }

    const mouthV = ProceduralHead.MOUTH_BASE / 3
    const lipFade = 1 - 0.25 * a.age // lip colour thins with age
    for (let j = 0; j < MOUTH_ROWS; j++) {
      for (let i = 0; i < MOUTH_COLS; i++) {
        const { x, y } = mouthGridXY(i, j)
        const m = mouthSampleAt(x, y)
        const fade = mouthEdgeFade(x, y)
        const vi = mouthV + j * MOUTH_COLS + i
        mul(vi, 0.98, 0.62, 0.62, m.lip * fade * lipFade)
        mul(vi, 0.42, 0.3, 0.3, m.line * fade * 0.85)
      }
    }

    ;(this.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true
    ;(this.geometry.getAttribute('uv') as BufferAttribute).needsUpdate = true
  }

  getLashLine(eye: Eye, samples = 60): LashLineSample[] {
    const frame = computeEyeFrame(this.resolved, eye)
    return sampleLashLine(frame, this.resolved, eye, samples)
  }

  getBrowRegion(eye: Eye): (u: number, v: number) => BrowRegionSample {
    const a = this.resolved
    const sign = eye === 'left' ? 1 : -1
    const xe = eyeCenterX(a)
    return (u: number, v: number) => {
      const dxl = -20 + 46 * u // inner end of the brow → tail
      const x = sign * (xe + dxl)
      const y = browArchY(dxl, a) + (v - 0.5) * 16
      const n = shellNormalAt(x, y, a)
      return {
        position: new Vector3(x, y, shellZAt(x, y, a) + 0.2),
        normal: new Vector3(n.x, n.y, n.z),
      }
    }
  }

  getLandmarks(): HeadLandmarks {
    const a = this.resolved
    const left = computeEyeFrame(a, 'left')
    const right = computeEyeFrame(a, 'right')
    const pupilOf = (f: typeof left) =>
      f.globeCenter.clone().add(new Vector3(0, 0, f.globeR))
    return {
      pupil: { left: pupilOf(left), right: pupilOf(right) },
      innerCanthus: {
        left: marginPoint(left, a, 'upper', 0),
        right: marginPoint(right, a, 'upper', 0),
      },
      outerCanthus: {
        left: marginPoint(left, a, 'upper', 1),
        right: marginPoint(right, a, 'upper', 1),
      },
      nostrilOuter: nostrilOuterLandmarks(a),
    }
  }

  getParams(): AnatomyParams {
    return { ...this.params }
  }

  dispose(): void {
    this.geometry.dispose()
    this.skinMaterial.dispose()
    for (const d of this.disposables) d.dispose()
  }
}
