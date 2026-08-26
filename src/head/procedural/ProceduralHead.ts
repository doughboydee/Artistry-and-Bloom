import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
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
import { resolveAnatomy, type ResolvedAnatomy } from '../calibration'
import { computeEyeFrame, marginPoint, sampleLashLine } from './margins'
import {
  SHELL_VERTEX_COUNT,
  buildShellIndices,
  writeShellPositions,
  shellZAt,
  shellNormalAt,
  browArchY,
  eyeCenterX,
} from './shell'
import {
  ORBITAL_VERTEX_COUNT,
  buildOrbitalIndices,
  writeOrbitalPositions,
} from './orbital'
import {
  NOSE_VERTEX_COUNT,
  buildNoseIndices,
  writeNosePositions,
  nostrilOuterLandmarks,
} from './nose'

/**
 * The procedural stand-in head. Anatomically honest about what the fit test
 * measures (brow ridge vs lid, globe depth, lash line, crease, hooding),
 * deliberately mannequin-like otherwise.
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
  private readonly skinMaterial: MeshStandardMaterial
  private readonly eyeGroups: Record<Eye, Group>
  private readonly disposables: { dispose(): void }[] = []

  // Float offsets of each region inside the merged position buffer.
  private static readonly SHELL_BASE = 0
  private static readonly ORBITAL_L_BASE = SHELL_VERTEX_COUNT * 3
  private static readonly ORBITAL_R_BASE =
    ProceduralHead.ORBITAL_L_BASE + ORBITAL_VERTEX_COUNT * 3
  private static readonly NOSE_BASE =
    ProceduralHead.ORBITAL_R_BASE + ORBITAL_VERTEX_COUNT * 3
  private static readonly TOTAL_VERTS =
    SHELL_VERTEX_COUNT + 2 * ORBITAL_VERTEX_COUNT + NOSE_VERTEX_COUNT

  constructor(initial: AnatomyParams) {
    this.positions = new Float32Array(ProceduralHead.TOTAL_VERTS * 3)
    this.geometry = new BufferGeometry()
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.geometry.setIndex([
      ...buildShellIndices(),
      ...buildOrbitalIndices(SHELL_VERTEX_COUNT, 'left'),
      ...buildOrbitalIndices(SHELL_VERTEX_COUNT + ORBITAL_VERTEX_COUNT, 'right'),
      ...buildNoseIndices(SHELL_VERTEX_COUNT + 2 * ORBITAL_VERTEX_COUNT),
    ])

    this.skinMaterial = new MeshStandardMaterial({
      color: new Color('#b8aca2'),
      roughness: 0.85,
      metalness: 0,
      side: DoubleSide,
    })
    this.skinMesh = new Mesh(this.geometry, this.skinMaterial)
    this.skinMesh.name = 'skin'

    this.eyeGroups = { left: this.buildEyeball('left'), right: this.buildEyeball('right') }
    this.auxMeshes = [this.eyeGroups.left, this.eyeGroups.right]

    this.setParams(initial)
  }

  private buildEyeball(eye: Eye): Group {
    const group = new Group()
    group.name = `eye_${eye === 'left' ? 'L' : 'R'}`

    const scleraGeo = new SphereGeometry(12, 32, 24)
    const scleraMat = new MeshStandardMaterial({ color: '#f2efe9', roughness: 0.35 })
    const sclera = new Mesh(scleraGeo, scleraMat)

    const irisGeo = new CircleGeometry(5.5, 32)
    const irisMat = new MeshStandardMaterial({ color: '#6b7b8c', roughness: 0.4 })
    const iris = new Mesh(irisGeo, irisMat)
    iris.position.z = 11.9

    const pupilGeo = new CircleGeometry(2.4, 24)
    const pupilMat = new MeshStandardMaterial({ color: '#141414', roughness: 0.3 })
    const pupil = new Mesh(pupilGeo, pupilMat)
    pupil.position.z = 12.0

    group.add(sclera, iris, pupil)
    this.disposables.push(scleraGeo, scleraMat, irisGeo, irisMat, pupilGeo, pupilMat)
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

    const attr = this.geometry.getAttribute('position') as BufferAttribute
    attr.needsUpdate = true
    this.geometry.computeVertexNormals()
    this.geometry.computeBoundingSphere()

    for (const eye of ['left', 'right'] as const) {
      const frame = computeEyeFrame(a, eye)
      this.eyeGroups[eye].position.copy(frame.globeCenter)
    }

    this.version++
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
      const y = browArchY(dxl) + (v - 0.5) * 16
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
