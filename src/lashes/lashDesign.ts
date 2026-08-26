import type { CurlFamily } from './curlProfiles'

/**
 * The student's extension plan: the lash line divided into equal zones from
 * inner corner (zone 1) to outer corner, each zone specifying what gets
 * glued there. The same design object is applied to any face — that is the
 * point of the tool: one plan, different anatomy, different outcome.
 */
export interface LashZone {
  lengthMm: number
  curl: CurlFamily
  diameterMm: number
}

export type ZoneCount = 3 | 5 | 7 | 9

export interface LashDesign {
  zones: LashZone[]
}

/**
 * Precision mapping headroom: an extension should not exceed the natural
 * lash it attaches to by more than ~2mm, or the weight strains the follicle
 * and the set sheds early. (Industry guidance is 2–3mm; we flag at +2.)
 */
export const PRECISION_HEADROOM_MM = 2

/** The client's own lashes, before any extensions. */
export interface NaturalLashes {
  /** 0 = pointing downward, 0.5 = straight out, 1 = pointing upward. */
  growthDirection: number
  /** 0 = sparse → 1 = dense (scales how many anchors get a lash). */
  density: number
  /** Average natural length, mm (real range ~5-10). */
  lengthMm: number
  /** 0 = fine → 1 = coarse. */
  thickness: number
  /** 0 = straight → 1 = naturally curly. */
  curl: number
}

export const DEFAULT_NATURAL_LASHES: NaturalLashes = {
  growthDirection: 0.5,
  density: 0.6,
  lengthMm: 7,
  thickness: 0.5,
  curl: 0.4,
}

/**
 * Natural lashes age: they thin (fewer and finer), shorten, and lose curl.
 * Applied on top of the student's natural-lash settings.
 */
export function agedNaturalLashes(n: NaturalLashes, age: number): NaturalLashes {
  return {
    ...n,
    density: n.density * (1 - 0.45 * age),
    thickness: n.thickness * (1 - 0.3 * age),
    lengthMm: n.lengthMm * (1 - 0.15 * age),
    curl: n.curl * (1 - 0.5 * age),
  }
}

export const EXTENSION_DIAMETERS_MM = [0.03, 0.05, 0.07, 0.1, 0.15, 0.2] as const
export const EXTENSION_LENGTHS_MM = [8, 9, 10, 11, 12, 13, 14, 15] as const

const zone = (lengthMm: number, curl: CurlFamily, diameterMm = 0.15): LashZone => ({
  lengthMm,
  curl,
  diameterMm,
})

/**
 * The classic preset maps students learn, expressed over 5 zones
 * (inner → outer). Applying a preset to a different zone count resamples it.
 */
export const PRESET_MAPS: Record<string, LashZone[]> = {
  natural: [zone(8, 'B'), zone(9, 'C'), zone(10, 'C'), zone(10, 'C'), zone(9, 'B')],
  'cat eye': [zone(8, 'C'), zone(9, 'C'), zone(10, 'C'), zone(11, 'CC'), zone(12, 'CC')],
  'doll eye': [zone(9, 'C'), zone(11, 'CC'), zone(12, 'CC'), zone(11, 'CC'), zone(9, 'C')],
  squirrel: [zone(9, 'C'), zone(10, 'CC'), zone(11, 'CC'), zone(12, 'D'), zone(10, 'C')],
  'open eye': [zone(9, 'CC'), zone(10, 'D'), zone(11, 'D'), zone(10, 'D'), zone(9, 'CC')],
}

export type PresetName = keyof typeof PRESET_MAPS

/** Resample a 5-zone preset onto any zone count. */
export function applyPresetToZones(preset: LashZone[], count: ZoneCount): LashZone[] {
  const zones: LashZone[] = []
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1)
    const src = preset[Math.round(u * (preset.length - 1))]!
    zones.push({ ...src })
  }
  return zones
}

export const DEFAULT_DESIGN: LashDesign = {
  zones: applyPresetToZones(PRESET_MAPS['natural']!, 5),
}

/** Which zone an anchor at lash-line position t (0..1) falls into. */
export function zoneAt(design: LashDesign, t: number): LashZone {
  const idx = Math.min(design.zones.length - 1, Math.floor(t * design.zones.length))
  return design.zones[idx]!
}
