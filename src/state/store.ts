import { create } from 'zustand'
import type { AnatomyParams } from '../head/HeadModel'
import { NEUTRAL_PARAMS } from '../head/HeadModel'

export type FaceId = 'A' | 'B'
export type ViewPreset = 'front' | 'profile' | 'free'

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
  setFaceParam: (face: FaceId, key: keyof AnatomyParams, value: number) => void
  resetFace: (face: FaceId) => void
  setPreset: (preset: ViewPreset) => void
  toggleLashLineDebug: () => void
}

export const useAppStore = create<AppState>()((set) => ({
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
}))
