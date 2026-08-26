import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  Mesh,
  Object3D,
  Vector3,
} from 'three'
import type {
  AnatomyParams,
  BrowRegionSample,
  Eye,
  HeadLandmarks,
  HeadModel,
  LashLineSample,
} from '../HeadModel'
import { NEUTRAL_PARAMS } from '../HeadModel'

/**
 * A head loaded from a glTF file that follows MESH_SPEC.md — either a
 * sculpted delivery from an artist, or the app's own baked export (which is
 * how this loader is tested end to end).
 *
 * Morph targets are applied on the CPU so the deformed positions are real
 * data the fit test's geometry queries can see, exactly like the
 * procedural head. Morphs are named after the parameters; each parameter's
 * neutral value (from NEUTRAL_PARAMS) maps to influence 0 and value 1 maps
 * to influence 1 (values below neutral extrapolate negative).
 */
export class GltfMorphHead implements HeadModel {
  readonly skinMesh: Mesh
  readonly auxMeshes: Object3D[]
  version = 0

  private params: AnatomyParams = { ...NEUTRAL_PARAMS }
  private readonly skinBase: Float32Array
  private readonly skinMorphs: Map<string, Float32Array>
  private readonly lashLines: Record<Eye, MorphedLine>
  private readonly browLines: Record<Eye, MorphedLine | null>
  private readonly landmarks: HeadLandmarks
  private readonly eyeSpheres: Record<Eye, { node: Object3D; basePos: Vector3 } | null>

  constructor(root: Group, initial: AnatomyParams) {
    const skin = root.getObjectByName('skin')
    if (!(skin instanceof Mesh)) throw new Error('MESH_SPEC: object named "skin" not found')
    this.skinMesh = skin
    // Node clones share geometry; this instance mutates positions, so own a copy.
    skin.geometry = (skin.geometry as BufferGeometry).clone()
    const geometry = skin.geometry as BufferGeometry
    const pos = geometry.getAttribute('position') as BufferAttribute
    this.skinBase = new Float32Array(pos.array as Float32Array)
    this.skinMorphs = readMorphs(skin)

    this.lashLines = {
      left: readLine(root, 'lashLine_L'),
      right: readLine(root, 'lashLine_R'),
    }
    this.browLines = {
      left: tryReadLine(root, 'browLine_L'),
      right: tryReadLine(root, 'browLine_R'),
    }

    const landmark = (name: string): Vector3 => {
      const node = root.getObjectByName(name)
      if (!node) throw new Error(`MESH_SPEC: landmark "${name}" not found`)
      return node.getWorldPosition(new Vector3())
    }
    this.landmarks = {
      pupil: { left: landmark('pupil_L'), right: landmark('pupil_R') },
      innerCanthus: { left: landmark('innerCanthus_L'), right: landmark('innerCanthus_R') },
      outerCanthus: { left: landmark('outerCanthus_L'), right: landmark('outerCanthus_R') },
      nostrilOuter: { left: landmark('nostrilOuter_L'), right: landmark('nostrilOuter_R') },
    }

    const sphere = (name: string) => {
      const node = root.getObjectByName(name)
      return node ? { node, basePos: node.position.clone() } : null
    }
    this.eyeSpheres = { left: sphere('eye_L'), right: sphere('eye_R') }
    this.auxMeshes = [this.eyeSpheres.left?.node, this.eyeSpheres.right?.node].filter(
      (n): n is Object3D => !!n,
    )

    this.setParams(initial)
  }

  /** Morph influence for a parameter value (neutral → 0, max → 1). */
  private influence(param: string, value: number): number {
    const neutral = (NEUTRAL_PARAMS as unknown as Record<string, number>)[param] ?? 0
    return neutral >= 1 ? 0 : (value - neutral) / (1 - neutral)
  }

  setParams(params: AnatomyParams): void {
    this.params = { ...params }
    const weights = new Map<string, number>()
    for (const [name] of this.skinMorphs) {
      weights.set(name, this.influence(name, (params as unknown as Record<string, number>)[name] ?? 0))
    }

    applyMorphs(
      this.skinBase,
      this.skinMorphs,
      weights,
      (this.skinMesh.geometry as BufferGeometry).getAttribute('position') as BufferAttribute,
    )
    ;(this.skinMesh.geometry as BufferGeometry).computeVertexNormals()
    ;(this.skinMesh.geometry as BufferGeometry).computeBoundingSphere()

    for (const eye of ['left', 'right'] as Eye[]) {
      this.lashLines[eye].apply(weights)
      this.browLines[eye]?.apply(weights)
      // Eye spheres follow the lash line's average displacement.
      const s = this.eyeSpheres[eye]
      if (s) {
        const offset = this.lashLines[eye].averageOffset()
        s.node.position.copy(s.basePos).add(offset)
      }
    }
    this.version++
  }

  getLashLine(eye: Eye, samples = 60): LashLineSample[] {
    const pts = this.lashLines[eye].currentPoints()
    const globeCenter = this.globeCenter(eye)
    return framesFromPolyline(pts, globeCenter, samples)
  }

  private globeCenter(eye: Eye): Vector3 {
    const s = this.eyeSpheres[eye]
    if (s) return s.node.position.clone()
    // Fallback: centroid of the lash line pushed back by a globe radius.
    const pts = this.lashLines[eye].currentPoints()
    const c = new Vector3()
    for (const p of pts) c.add(p)
    c.divideScalar(pts.length)
    c.z -= 12
    return c
  }

  getBrowRegion(eye: Eye): (u: number, v: number) => BrowRegionSample {
    const line = this.browLines[eye]
    if (!line) {
      // No brow line in the file: hover a band 20mm above the lash line.
      const lash = this.lashLines[eye].currentPoints()
      return (u: number, v: number) => {
        const p = sampleAlong(lash, u).clone()
        p.y += 20 + (v - 0.5) * 16
        return { position: p, normal: new Vector3(0, 0, 1) }
      }
    }
    const pts = line.currentPoints()
    return (u: number, v: number) => {
      const p = sampleAlong(pts, u).clone()
      p.y += (v - 0.5) * 16
      return { position: p, normal: new Vector3(0, 0.15, 1).normalize() }
    }
  }

  getLandmarks(): HeadLandmarks {
    // Landmark empties are static (neutral); MESH_SPEC allows re-deriving
    // moved eye landmarks from the lash lines, which track the morphs.
    const clone = (v: Vector3) => v.clone()
    const lashL = this.lashLines.left.currentPoints()
    const lashR = this.lashLines.right.currentPoints()
    return {
      pupil: {
        left: this.globeCenter('left').add(new Vector3(0, 0, 12)),
        right: this.globeCenter('right').add(new Vector3(0, 0, 12)),
      },
      innerCanthus: { left: lashL[0]!.clone(), right: lashR[0]!.clone() },
      outerCanthus: {
        left: lashL[lashL.length - 1]!.clone(),
        right: lashR[lashR.length - 1]!.clone(),
      },
      nostrilOuter: {
        left: clone(this.landmarks.nostrilOuter.left),
        right: clone(this.landmarks.nostrilOuter.right),
      },
    }
  }

  getParams(): AnatomyParams {
    return { ...this.params }
  }

  dispose(): void {
    ;(this.skinMesh.geometry as BufferGeometry).dispose()
  }
}

/* ------------------------------------------------------------------ */

function readMorphs(obj: Mesh | Line): Map<string, Float32Array> {
  const geometry = obj.geometry as BufferGeometry
  const morphs = new Map<string, Float32Array>()
  const dict = obj.morphTargetDictionary ?? {}
  const attrs = geometry.morphAttributes.position ?? []
  for (const [name, index] of Object.entries(dict)) {
    const attr = attrs[index]
    if (attr) morphs.set(name, new Float32Array(attr.array as Float32Array))
  }
  return morphs
}

function applyMorphs(
  base: Float32Array,
  morphs: Map<string, Float32Array>,
  weights: Map<string, number>,
  target: BufferAttribute,
): void {
  const out = target.array as Float32Array
  out.set(base)
  for (const [name, deltas] of morphs) {
    const w = weights.get(name) ?? 0
    if (Math.abs(w) < 1e-6) continue
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + deltas[i]! * w
  }
  target.needsUpdate = true
}

class MorphedLine {
  private readonly base: Float32Array
  private readonly morphs: Map<string, Float32Array>
  private readonly current: Float32Array

  constructor(line: Line) {
    const pos = (line.geometry as BufferGeometry).getAttribute('position') as BufferAttribute
    this.base = new Float32Array(pos.array as Float32Array)
    this.morphs = readMorphs(line)
    this.current = new Float32Array(this.base)
  }

  apply(weights: Map<string, number>): void {
    this.current.set(this.base)
    for (const [name, deltas] of this.morphs) {
      const w = weights.get(name) ?? 0
      if (Math.abs(w) < 1e-6) continue
      for (let i = 0; i < this.current.length; i++)
        this.current[i] = this.current[i]! + deltas[i]! * w
    }
  }

  currentPoints(): Vector3[] {
    const pts: Vector3[] = []
    for (let i = 0; i < this.current.length; i += 3) {
      pts.push(new Vector3(this.current[i]!, this.current[i + 1]!, this.current[i + 2]!))
    }
    return pts
  }

  averageOffset(): Vector3 {
    const off = new Vector3()
    for (let i = 0; i < this.current.length; i += 3) {
      off.x += this.current[i]! - this.base[i]!
      off.y += this.current[i + 1]! - this.base[i + 1]!
      off.z += this.current[i + 2]! - this.base[i + 2]!
    }
    return off.divideScalar(this.current.length / 3)
  }
}

function readLine(root: Group, name: string): MorphedLine {
  const node = root.getObjectByName(name)
  if (!(node instanceof Line)) throw new Error(`MESH_SPEC: polyline "${name}" not found`)
  return new MorphedLine(node)
}

function tryReadLine(root: Group, name: string): MorphedLine | null {
  const node = root.getObjectByName(name)
  return node instanceof Line ? new MorphedLine(node) : null
}

/** Point at arc-length fraction u along a polyline. */
function sampleAlong(pts: Vector3[], u: number): Vector3 {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!))
  const target = Math.min(1, Math.max(0, u)) * cum[cum.length - 1]!
  let i = 1
  while (i < pts.length - 1 && cum[i]! < target) i++
  const seg = cum[i]! - cum[i - 1]!
  const f = seg > 0 ? (target - cum[i - 1]!) / seg : 0
  return pts[i - 1]!.clone().lerp(pts[i]!, f)
}

/**
 * Lash-line frames from a raw polyline: same construction as the procedural
 * head (tangent along the curve, surface normal radiating from the globe,
 * growth direction pitched toward the opening and blended heavily toward
 * face-forward, more at the corners).
 */
function framesFromPolyline(
  pts: Vector3[],
  globeCenter: Vector3,
  count: number,
): LashLineSample[] {
  const samples: LashLineSample[] = []
  const growthAngle = (-35 * Math.PI) / 180
  for (let k = 0; k < count; k++) {
    const t = k / (count - 1)
    const position = sampleAlong(pts, t)
    const ahead = sampleAlong(pts, Math.min(1, t + 0.02))
    const behind = sampleAlong(pts, Math.max(0, t - 0.02))
    const tangent = ahead.clone().sub(behind).normalize()
    const surfaceNormal = position.clone().sub(globeCenter).normalize()
    const away = new Vector3().crossVectors(tangent, surfaceNormal)
    if (away.y < 0) away.negate()
    const growthDir = surfaceNormal
      .clone()
      .multiplyScalar(Math.cos(growthAngle))
      .addScaledVector(away, Math.sin(growthAngle))
      .normalize()
    const tEdge = Math.min(t, 1 - t)
    const forwardBlend = 0.6 + 0.25 * (1 - Math.min(1, tEdge / 0.15))
    growthDir
      .multiplyScalar(1 - forwardBlend)
      .add(new Vector3(0, 0, forwardBlend))
      .normalize()
    samples.push({ t, position, tangent, surfaceNormal, growthDir })
  }
  return samples
}
