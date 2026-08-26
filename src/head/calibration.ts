import type { AnatomyParams } from './HeadModel'

/**
 * Single source of truth mapping normalized 0..1 parameters to real-world
 * values. 1 world unit = 1 mm throughout the app.
 *
 * These ranges are mirrored in MESH_SPEC.md: a sculpted replacement head must
 * provide one morph target per parameter whose full influence corresponds to
 * the same physical range, so slider values mean the same thing on either
 * head.
 */
export interface Calibration {
  /** Brow ridge forward projection at param=0 / param=1, mm. */
  browProjectionMm: [number, number]
  /** Globe-center Z offset from neutral: + is forward (protruding), mm. */
  eyeDepthOffsetMm: [number, number]
  /** Crease height above the lash margin along the lid surface, mm. */
  creaseHeightMm: [number, number]
  /** Peak hood drape displacement at full hooding, mm. */
  lidHoodingMaxMm: number
  /** Outer-corner tilt angle, degrees; + raises the outer corner. */
  outerCornerTiltDeg: [number, number]
  /** Inner-canthus separation, mm. */
  eyeSpacingMm: [number, number]
  /** Vertical palpebral aperture, mm. */
  eyeOpeningMm: [number, number]
  /** Horizontal fissure length (inner to outer canthus), mm. */
  eyeLengthMm: [number, number]
  /** Alar base width, mm. */
  noseBaseWidthMm: [number, number]
  /** Eyeball radius, mm (adult globe is remarkably constant). */
  globeRadiusMm: number
  /** Lid tissue thickness over the globe, mm. */
  lidThicknessMm: number
  /** World Y of eye level (origin is at eye level, so 0). */
  eyeLevelY: number
}

export const CALIBRATION: Calibration = {
  browProjectionMm: [0, 9],
  eyeDepthOffsetMm: [2.5, -4.5],
  creaseHeightMm: [1.5, 12],
  lidHoodingMaxMm: 6,
  outerCornerTiltDeg: [-6, 10],
  eyeSpacingMm: [28, 42],
  eyeOpeningMm: [7, 13],
  eyeLengthMm: [24, 32],
  noseBaseWidthMm: [28, 42],
  globeRadiusMm: 12,
  lidThicknessMm: 1.5,
  eyeLevelY: 0,
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

const fromRange = ([a, b]: [number, number], t: number): number => lerp(a, b, t)

/** All parameters resolved to physical values for one face. */
export interface ResolvedAnatomy {
  browProjectionMm: number
  eyeDepthOffsetMm: number
  creaseHeightMm: number
  lidHoodingMm: number
  outerCornerTiltRad: number
  eyeSpacingMm: number
  eyeOpeningMm: number
  eyeLengthMm: number
  noseBaseWidthMm: number
  globeRadiusMm: number
  lidThicknessMm: number
}

export function resolveAnatomy(p: AnatomyParams, c: Calibration = CALIBRATION): ResolvedAnatomy {
  return {
    browProjectionMm: fromRange(c.browProjectionMm, p.browProjection),
    eyeDepthOffsetMm: fromRange(c.eyeDepthOffsetMm, p.eyeDepth),
    creaseHeightMm: fromRange(c.creaseHeightMm, p.creaseHeight),
    lidHoodingMm: c.lidHoodingMaxMm * p.lidHooding,
    outerCornerTiltRad: (fromRange(c.outerCornerTiltDeg, p.outerCornerTilt) * Math.PI) / 180,
    eyeSpacingMm: fromRange(c.eyeSpacingMm, p.eyeSpacing),
    eyeOpeningMm: fromRange(c.eyeOpeningMm, p.eyeOpening),
    eyeLengthMm: fromRange(c.eyeLengthMm, p.eyeLength),
    noseBaseWidthMm: fromRange(c.noseBaseWidthMm, p.noseBaseWidth),
    globeRadiusMm: c.globeRadiusMm,
    lidThicknessMm: c.lidThicknessMm,
  }
}
