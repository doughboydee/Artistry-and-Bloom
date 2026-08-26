import { create } from 'zustand'
import type { AnatomyParams } from '../head/HeadModel'
import { NEUTRAL_PARAMS } from '../head/HeadModel'
import type { BrowParams } from '../brows/browDesign'
import { DEFAULT_BROW_PARAMS } from '../brows/browDesign'
import type { BrowMappingMethod } from '../brows/mappingLines'
import type { LashDesign, LashZone, NaturalLashes, ZoneCount } from '../lashes/lashDesign'
import {
  DEFAULT_DESIGN,
  DEFAULT_NATURAL_LASHES,
  PRESET_MAPS,
  applyPresetToZones,
} from '../lashes/lashDesign'

export type FaceId = 'A' | 'B'
export type ViewPreset = 'front' | 'profile' | 'free'

export interface FitSettings {
  enabled: boolean
  safetyMarginMm: number
  ghostThreshold: number
  showGhosts: boolean
}

export interface EyeFitSummary {
  total: number
  colliding: number
  near: number
  ghosted: number
}

export type FitResults = Partial<
  Record<FaceId, Partial<Record<'left' | 'right', EyeFitSummary>>>
>

/** Live measurements the brow-mapping overlay reports back for the panel. */
export interface BrowMappingInfo {
  /** Thread method: tail minus start height per side, mm. */
  levelDeltaMm?: Record<'left' | 'right', number>
  /** Golden-ratio method: measured start→arch : arch→tail per side. */
  phiRatio?: Record<'left' | 'right', number>
  /** Symmetry guides: left minus right marker heights, mm. */
  symmetry?: Record<'start' | 'arch' | 'tail', number>
}

interface ViewState {
  preset: ViewPreset
  /** Bumped every time a preset button is clicked so the camera re-animates
   *  even when the same preset is clicked twice. */
  presetNonce: number
  showLashLineDebug: boolean
}

interface AppState {
  faces: Record<FaceId, AnatomyParams>
  activeFace: FaceId
  compareMode: boolean
  view: ViewState
  lashDesign: LashDesign
  naturalLashes: NaturalLashes
  showNaturalLashes: boolean
  showExtensions: boolean
  /** On-lid lash map: zone boundaries + per-zone labels drawn at the eye. */
  showLashMap: boolean
  /** Precision mapping: check each zone's length against the natural lashes. */
  showPrecision: boolean
  fitSettings: FitSettings
  fitResults: FitResults
  browParams: BrowParams
  showBrows: boolean
  showBrowMapping: boolean
  browMappingMethod: BrowMappingMethod
  showSymmetryGuides: boolean
  browMappingInfo: Partial<Record<FaceId, BrowMappingInfo>>
  /** Display name of the current head implementation (see head/headSource). */
  headSourceName: string
  setHeadSourceName: (name: string) => void
  setFaceParam: (face: FaceId, key: keyof AnatomyParams, value: number) => void
  resetFace: (face: FaceId) => void
  setPreset: (preset: ViewPreset) => void
  toggleLashLineDebug: () => void
  setZone: (index: number, patch: Partial<LashZone>) => void
  setZoneCount: (count: ZoneCount) => void
  applyPreset: (name: string) => void
  setNaturalParam: (key: keyof NaturalLashes, value: number) => void
  toggleNaturalLashes: () => void
  toggleExtensions: () => void
  toggleLashMap: () => void
  togglePrecision: () => void
  setFitSetting: <K extends keyof FitSettings>(key: K, value: FitSettings[K]) => void
  reportFitResult: (face: FaceId, eye: 'left' | 'right', summary: EyeFitSummary) => void
  setCompareMode: (on: boolean) => void
  setActiveFace: (face: FaceId) => void
  setBrowParam: (key: keyof BrowParams, value: number) => void
  toggleBrows: () => void
  toggleBrowMapping: () => void
  setBrowMappingMethod: (m: BrowMappingMethod) => void
  toggleSymmetryGuides: () => void
  reportBrowMappingInfo: (face: FaceId, info: BrowMappingInfo) => void
  snapshotScenario: () => import('./scenario').Scenario
  applyScenario: (s: import('./scenario').Scenario) => void
}

export const useAppStore = create<AppState>()((set, get) => ({
  faces: { A: { ...NEUTRAL_PARAMS }, B: { ...NEUTRAL_PARAMS } },
  activeFace: 'A',
  compareMode: false,
  view: { preset: 'free', presetNonce: 0, showLashLineDebug: false },

  setFaceParam: (face, key, value) =>
    set((s) => ({
      faces: { ...s.faces, [face]: { ...s.faces[face], [key]: value } },
    })),

  resetFace: (face) =>
    set((s) => ({
      faces: { ...s.faces, [face]: { ...NEUTRAL_PARAMS } },
    })),

  setPreset: (preset) =>
    set((s) => ({
      view: { ...s.view, preset, presetNonce: s.view.presetNonce + 1 },
    })),

  toggleLashLineDebug: () =>
    set((s) => ({
      view: { ...s.view, showLashLineDebug: !s.view.showLashLineDebug },
    })),

  lashDesign: DEFAULT_DESIGN,
  naturalLashes: { ...DEFAULT_NATURAL_LASHES },
  showNaturalLashes: true,
  showExtensions: true,

  setZone: (index, patch) =>
    set((s) => ({
      lashDesign: {
        zones: s.lashDesign.zones.map((z, i) => (i === index ? { ...z, ...patch } : z)),
      },
    })),

  setZoneCount: (count) =>
    set((s) => ({
      lashDesign: { zones: applyPresetToZones(s.lashDesign.zones, count) },
    })),

  applyPreset: (name) =>
    set((s) => {
      const preset = PRESET_MAPS[name]
      if (!preset) return s
      return {
        lashDesign: {
          zones: applyPresetToZones(preset, s.lashDesign.zones.length as ZoneCount),
        },
      }
    }),

  setNaturalParam: (key, value) =>
    set((s) => ({ naturalLashes: { ...s.naturalLashes, [key]: value } })),

  toggleNaturalLashes: () => set((s) => ({ showNaturalLashes: !s.showNaturalLashes })),
  toggleExtensions: () => set((s) => ({ showExtensions: !s.showExtensions })),
  showLashMap: false,
  showPrecision: false,
  toggleLashMap: () => set((s) => ({ showLashMap: !s.showLashMap })),
  togglePrecision: () => set((s) => ({ showPrecision: !s.showPrecision })),

  fitSettings: { enabled: true, safetyMarginMm: 0.5, ghostThreshold: 0.5, showGhosts: true },
  fitResults: {},

  setFitSetting: (key, value) =>
    set((s) => ({ fitSettings: { ...s.fitSettings, [key]: value } })),

  reportFitResult: (face, eye, summary) =>
    set((s) => ({
      fitResults: {
        ...s.fitResults,
        [face]: { ...s.fitResults[face], [eye]: summary },
      },
    })),

  setCompareMode: (on) =>
    set((s) =>
      on
        ? { compareMode: true }
        : // Face B's fit summary is meaningless once its view is gone.
          { compareMode: false, fitResults: { A: s.fitResults.A } },
    ),
  setActiveFace: (face) => set({ activeFace: face }),

  browParams: { ...DEFAULT_BROW_PARAMS },
  showBrows: true,
  showBrowMapping: false,
  headSourceName: 'Built-in stand-in head',
  setHeadSourceName: (name) => set({ headSourceName: name }),

  setBrowParam: (key, value) =>
    set((s) => ({ browParams: { ...s.browParams, [key]: value } })),
  toggleBrows: () => set((s) => ({ showBrows: !s.showBrows })),
  toggleBrowMapping: () => set((s) => ({ showBrowMapping: !s.showBrowMapping })),
  browMappingMethod: 'classic',
  showSymmetryGuides: false,
  browMappingInfo: {},
  setBrowMappingMethod: (m) => set({ browMappingMethod: m }),
  toggleSymmetryGuides: () => set((s) => ({ showSymmetryGuides: !s.showSymmetryGuides })),
  reportBrowMappingInfo: (face, info) =>
    set((s) => ({ browMappingInfo: { ...s.browMappingInfo, [face]: info } })),

  snapshotScenario: () => {
    const s = get()
    return JSON.parse(
      JSON.stringify({
        v: 1 as const,
        faces: s.faces,
        lashDesign: s.lashDesign,
        naturalLashes: s.naturalLashes,
        browParams: s.browParams,
        browMappingMethod: s.browMappingMethod,
        fitSettings: s.fitSettings,
        compareMode: s.compareMode,
      }),
    )
  },

  applyScenario: (scenario) =>
    set({
      // Old fit summaries describe the previous setup — drop them so panels
      // never show stale numbers while the new fit is computed.
      fitResults: {},
      faces: JSON.parse(JSON.stringify(scenario.faces)),
      lashDesign: JSON.parse(JSON.stringify(scenario.lashDesign)),
      naturalLashes: { ...scenario.naturalLashes },
      browParams: { ...scenario.browParams },
      browMappingMethod: scenario.browMappingMethod,
      fitSettings: { ...scenario.fitSettings },
      compareMode: scenario.compareMode,
      activeFace: 'A',
    }),
}))
