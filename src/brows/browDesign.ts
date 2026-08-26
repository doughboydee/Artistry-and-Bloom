/**
 * Brow hair settings. Every control is a measurable feature of the hair and
 * its placement — nothing else.
 */
export interface BrowParams {
  /** 0 sparse → 1 dense (scales hair count, ~120..400 per brow). */
  density: number
  /** Hair caliber, 0 fine → 1 coarse (base diameter 0.05..0.12 mm). */
  caliber: number
  /** 0 flat/lateral growth → 1 strongly upswept. */
  growthDirection: number
  /** Brow position on the ridge: 0 low → 1 high (−3..+3 mm). */
  verticalOffset: number
  /** Band fullness: 0 thin → 1 full (band width 8..14 mm). */
  fullness: number
}

export const DEFAULT_BROW_PARAMS: BrowParams = {
  density: 0.6,
  caliber: 0.5,
  growthDirection: 0.5,
  verticalOffset: 0.5,
  fullness: 0.5,
}

export const browHairCount = (density: number): number => Math.round(120 + density * 280)
export const browHairDiameterMm = (caliber: number): number => 0.05 + caliber * 0.07
export const browBandWidthMm = (fullness: number): number => 8 + fullness * 6
export const browVerticalOffsetMm = (verticalOffset: number): number => -3 + verticalOffset * 6
