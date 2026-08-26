import type { AnatomyParams } from '../head/HeadModel'
import { NEUTRAL_PARAMS } from '../head/HeadModel'
import type { BrowParams } from '../brows/browDesign'
import { DEFAULT_BROW_PARAMS } from '../brows/browDesign'
import type { LashDesign, NaturalLashes } from '../lashes/lashDesign'
import { DEFAULT_DESIGN, DEFAULT_NATURAL_LASHES } from '../lashes/lashDesign'
import type { BrowMappingMethod } from '../brows/mappingLines'
import type { FaceId, FitSettings } from './store'

/**
 * A scenario is everything needed to reproduce a teaching case: both faces'
 * anatomy (age included), the lash design, natural-lash settings, brow
 * settings, fit-test settings, and whether compare mode is on. Plain data
 * only, versioned so future versions can migrate old links.
 */
export interface Scenario {
  v: 1
  faces: Record<FaceId, AnatomyParams>
  lashDesign: LashDesign
  naturalLashes: NaturalLashes
  browParams: BrowParams
  browMappingMethod: BrowMappingMethod
  fitSettings: FitSettings
  compareMode: boolean
}

export function encodeScenarioToHash(s: Scenario): string {
  const json = JSON.stringify(s)
  // base64url so the hash is URL-safe.
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeScenarioFromHash(hash: string): Scenario | null {
  try {
    const b64 = hash.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return sanitizeScenario(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

// A share link or saved file is user-editable text, so nothing in it can be
// trusted: every field is checked, clamped to its legal range, or replaced
// with a sane default. A link can be wrong, but it can never break the app.
const clampNum = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback

const VALID_CURLS = new Set(['B', 'C', 'CC', 'D', 'L', 'M'])

function sanitizeFace(raw: unknown): AnatomyParams {
  const src = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const out = { ...NEUTRAL_PARAMS }
  for (const key of Object.keys(NEUTRAL_PARAMS) as (keyof AnatomyParams)[]) {
    out[key] = clampNum(src[key], NEUTRAL_PARAMS[key], 0, 1)
  }
  return out
}

function sanitizeLashDesign(raw: unknown): LashDesign {
  const zonesRaw = (raw as { zones?: unknown } | null)?.zones
  if (!Array.isArray(zonesRaw) || zonesRaw.length === 0) {
    return JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as LashDesign
  }
  return {
    zones: zonesRaw.slice(0, 9).map((z) => {
      const zz = (typeof z === 'object' && z !== null ? z : {}) as Record<string, unknown>
      return {
        lengthMm: clampNum(zz.lengthMm, 10, 4, 20),
        curl: (VALID_CURLS.has(zz.curl as string) ? zz.curl : 'C') as LashDesign['zones'][number]['curl'],
        diameterMm: clampNum(zz.diameterMm, 0.15, 0.03, 0.3),
      }
    }),
  }
}

export function sanitizeScenario(parsed: unknown): Scenario | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>
  if (p.v !== 1) return null
  const faces = (typeof p.faces === 'object' && p.faces !== null ? p.faces : {}) as Record<
    string,
    unknown
  >
  const nat = (typeof p.naturalLashes === 'object' && p.naturalLashes !== null
    ? p.naturalLashes
    : {}) as Record<string, unknown>
  const brow = (typeof p.browParams === 'object' && p.browParams !== null
    ? p.browParams
    : {}) as Record<string, unknown>
  const fit = (typeof p.fitSettings === 'object' && p.fitSettings !== null
    ? p.fitSettings
    : {}) as Record<string, unknown>
  return {
    v: 1,
    faces: { A: sanitizeFace(faces.A), B: sanitizeFace(faces.B) },
    lashDesign: sanitizeLashDesign(p.lashDesign),
    naturalLashes: {
      growthDirection: clampNum(nat.growthDirection, DEFAULT_NATURAL_LASHES.growthDirection, 0, 1),
      density: clampNum(nat.density, DEFAULT_NATURAL_LASHES.density, 0, 1),
      lengthMm: clampNum(nat.lengthMm, DEFAULT_NATURAL_LASHES.lengthMm, 2, 15),
      thickness: clampNum(nat.thickness, DEFAULT_NATURAL_LASHES.thickness, 0, 1),
      curl: clampNum(nat.curl, DEFAULT_NATURAL_LASHES.curl, 0, 1),
    },
    browParams: {
      density: clampNum(brow.density, DEFAULT_BROW_PARAMS.density, 0, 1),
      caliber: clampNum(brow.caliber, DEFAULT_BROW_PARAMS.caliber, 0, 1),
      growthDirection: clampNum(brow.growthDirection, DEFAULT_BROW_PARAMS.growthDirection, 0, 1),
      verticalOffset: clampNum(brow.verticalOffset, DEFAULT_BROW_PARAMS.verticalOffset, 0, 1),
      fullness: clampNum(brow.fullness, DEFAULT_BROW_PARAMS.fullness, 0, 1),
    },
    browMappingMethod:
      p.browMappingMethod === 'thread' || p.browMappingMethod === 'goldenRatio'
        ? p.browMappingMethod
        : 'classic',
    fitSettings: {
      enabled: typeof fit.enabled === 'boolean' ? fit.enabled : true,
      safetyMarginMm: clampNum(fit.safetyMarginMm, 0.5, 0, 2),
      ghostThreshold: clampNum(fit.ghostThreshold, 0.5, 0, 1),
      showGhosts: typeof fit.showGhosts === 'boolean' ? fit.showGhosts : true,
    },
    compareMode: p.compareMode === true,
  }
}

const STORAGE_KEY = 'lash-brow-trainer-scenarios-v1'

export interface SavedScenario {
  name: string
  scenario: Scenario
}

export function loadSavedScenarios(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Same rule as share links: stored data is untrusted. Drop entries that
    // can't be repaired rather than letting one bad row break the panel.
    const out: SavedScenario[] = []
    for (const entry of parsed) {
      const e = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
        string,
        unknown
      >
      if (typeof e.name !== 'string' || !e.name.trim()) continue
      const scenario = sanitizeScenario(e.scenario)
      if (scenario) out.push({ name: e.name.slice(0, 120), scenario })
    }
    return out
  } catch {
    return []
  }
}

export function persistSavedScenarios(list: SavedScenario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Storage may be unavailable (private mode); saving is best-effort.
  }
}

/** Built-in teaching cases. */
export function builtInScenarios(): SavedScenario[] {
  const base = (over: Partial<Scenario>): Scenario => ({
    v: 1,
    faces: { A: { ...NEUTRAL_PARAMS }, B: { ...NEUTRAL_PARAMS } },
    lashDesign: JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as LashDesign,
    naturalLashes: { ...DEFAULT_NATURAL_LASHES },
    browParams: { ...DEFAULT_BROW_PARAMS },
    browMappingMethod: 'classic',
    fitSettings: { enabled: true, safetyMarginMm: 0.5, ghostThreshold: 0.5, showGhosts: true },
    compareMode: false,
    ...over,
  })
  const dCurls = (lens: number[]): LashDesign => ({
    zones: lens.map((lengthMm) => ({ lengthMm, curl: 'D' as const, diameterMm: 0.15 })),
  })
  return [
    {
      name: 'Hooded + deep-set vs neutral (same D map)',
      scenario: base({
        compareMode: true,
        faces: {
          A: { ...NEUTRAL_PARAMS },
          B: { ...NEUTRAL_PARAMS, lidHooding: 0.8, eyeDepth: 0.9, creaseHeight: 0.2, browProjection: 0.8 },
        },
        lashDesign: dCurls([9, 11, 13, 13, 11]),
      }),
    },
    {
      name: 'Elderly client, doll map',
      scenario: base({
        compareMode: true,
        faces: { A: { ...NEUTRAL_PARAMS }, B: { ...NEUTRAL_PARAMS, age: 1 } },
        lashDesign: dCurls([9, 11, 12, 11, 9]),
      }),
    },
    {
      name: 'D vs L on a hooded lid',
      scenario: base({
        faces: {
          A: { ...NEUTRAL_PARAMS, lidHooding: 0.6, creaseHeight: 0.3 },
          B: { ...NEUTRAL_PARAMS, lidHooding: 0.6, creaseHeight: 0.3 },
        },
        lashDesign: dCurls([9, 11, 13, 13, 11]),
      }),
    },
  ]
}
