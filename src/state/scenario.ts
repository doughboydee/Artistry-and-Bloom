import type { AnatomyParams } from '../head/HeadModel'
import { NEUTRAL_PARAMS } from '../head/HeadModel'
import type { BrowParams } from '../brows/browDesign'
import { DEFAULT_BROW_PARAMS } from '../brows/browDesign'
import type { LashDesign, NaturalLashes } from '../lashes/lashDesign'
import { DEFAULT_DESIGN, DEFAULT_NATURAL_LASHES } from '../lashes/lashDesign'
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
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Scenario>
    if (parsed.v !== 1 || !parsed.faces || !parsed.lashDesign) return null
    // Fill any missing fields with defaults so older links stay loadable.
    return {
      v: 1,
      faces: {
        A: { ...NEUTRAL_PARAMS, ...parsed.faces.A },
        B: { ...NEUTRAL_PARAMS, ...parsed.faces.B },
      },
      lashDesign: parsed.lashDesign ?? DEFAULT_DESIGN,
      naturalLashes: { ...DEFAULT_NATURAL_LASHES, ...parsed.naturalLashes },
      browParams: { ...DEFAULT_BROW_PARAMS, ...parsed.browParams },
      fitSettings: {
        enabled: true,
        safetyMarginMm: 0.5,
        ghostThreshold: 0.5,
        showGhosts: true,
        ...parsed.fitSettings,
      },
      compareMode: parsed.compareMode ?? false,
    }
  } catch {
    return null
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
    return raw ? (JSON.parse(raw) as SavedScenario[]) : []
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
