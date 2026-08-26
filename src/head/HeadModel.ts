import type { Mesh, Object3D, Vector3 } from 'three'

/**
 * All anatomy parameters are normalized 0..1 slider values.
 * The mapping from each parameter to real-world millimeters/degrees lives in
 * calibration.ts, which is the single source of truth for ranges and is
 * mirrored in MESH_SPEC.md as the required morph-target ranges for a future
 * sculpted head.
 *
 * Every parameter describes a measurable anatomical feature. Nothing else
 * belongs here.
 */
export interface AnatomyParams {
  /** Superciliary (brow) ridge forward projection: 0 flat → 1 heavy. */
  browProjection: number
  /** Globe recession into the orbit: 0 protruding → 1 deep-set. */
  eyeDepth: number
  /** Upper-lid crease height above the lash margin: 0 absent/low → 1 high. */
  creaseHeight: number
  /** Skin drape over the crease: 0 none → 1 heavy hooding. */
  lidHooding: number
  /** Lateral canthus tilt: 0 downturned → 0.5 level-ish → 1 upturned. */
  outerCornerTilt: number
  /** Inner-canthus separation: 0 close-set → 1 wide-set. */
  eyeSpacing: number
  /** Vertical palpebral aperture: 0 narrow → 1 tall. */
  eyeOpening: number
  /** Horizontal palpebral fissure length: 0 short → 1 long. */
  eyeLength: number
  /** Alar base width (brow mapping lines are anchored here): 0 narrow → 1 wide. */
  noseBaseWidth: number
  /**
   * Age, 0 young adult (~20) → 1 elderly (~80). Drives real anatomy, not a
   * skin texture: the brow fat pad shrinks and the brow descends, upper lid
   * skin loosens and drapes, orbital fat descends and the socket hollows,
   * and the natural lashes thin, shorten, and lose curl.
   */
  age: number
}

export type Eye = 'left' | 'right'

export const NEUTRAL_PARAMS: AnatomyParams = {
  browProjection: 0.5,
  eyeDepth: 0.5,
  creaseHeight: 0.5,
  lidHooding: 0,
  outerCornerTilt: 0.5,
  eyeSpacing: 0.5,
  eyeOpening: 0.5,
  eyeLength: 0.5,
  noseBaseWidth: 0.5,
  age: 0,
}

/**
 * One sample along the upper lid margin (the lash line), inner corner to
 * outer corner. Lash generation attaches every fiber at one of these and
 * orients it by the frame.
 */
export interface LashLineSample {
  /** 0 = inner corner, 1 = outer corner; samples are arc-length uniform. */
  t: number
  /** Position on the lid margin, head space, millimeters. */
  position: Vector3
  /** Direction along the margin curve (inner → outer). */
  tangent: Vector3
  /** Outward off the lid surface (radially away from the globe). */
  surfaceNormal: Vector3
  /** Natural lash emergence direction (surfaceNormal pitched forward/down). */
  growthDir: Vector3
}

export interface EyePair {
  left: Vector3
  right: Vector3
}

/** Named anatomical landmarks consumed by brow mapping lines and cameras. */
export interface HeadLandmarks {
  pupil: EyePair
  innerCanthus: EyePair
  outerCanthus: EyePair
  /** Outer edge of each nostril: origin of the three brow-mapping lines. */
  nostrilOuter: EyePair
}

export interface BrowRegionSample {
  position: Vector3
  normal: Vector3
}

/**
 * The contract every head implementation satisfies.
 *
 * Conventions (see MESH_SPEC.md): 1 world unit = 1 mm; +Y up; +Z out of the
 * face; +X the subject's anatomical left (screen right in front view);
 * origin centered on the face at eye level.
 *
 * Implementations:
 *  - ProceduralHead: analytic stand-in generated in code (current).
 *  - GltfMorphHead: sculpted asset with morph targets (future). Same
 *    interface; the rest of the app cannot tell them apart.
 */
export interface HeadModel {
  /**
   * The single merged skin surface: lids, hood, brow, forehead, nose, cheeks.
   * Used for rendering AND for fit-test geometry queries (collision,
   * front-view occlusion).
   */
  readonly skinMesh: Mesh
  /** Rendered but excluded from fiber collision (eyeballs etc.). */
  readonly auxMeshes: Object3D[]
  /**
   * Apply parameters. Topology is fixed — only vertex positions/normals
   * change — so consumers may cache geometry references. Bumps `version`.
   */
  setParams(params: AnatomyParams): void
  /** Monotonic change counter; BVH refit, lash regen and fit tests watch it. */
  readonly version: number
  /** Arc-length-uniform samples of the upper lid margin with frames. */
  getLashLine(eye: Eye, samples?: number): LashLineSample[]
  /** (u along the brow arch 0..1, v across the band 0..1) → surface point. */
  getBrowRegion(eye: Eye): (u: number, v: number) => BrowRegionSample
  getLandmarks(): HeadLandmarks
  dispose(): void
}
