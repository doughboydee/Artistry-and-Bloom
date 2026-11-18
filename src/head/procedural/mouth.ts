import type { ResolvedAnatomy } from '../calibration'
import { MOUTH_OVERLAP, MOUTH_X, MOUTH_Y_BOTTOM, MOUTH_Y_TOP, shellZAt } from './shell'

/**
 * Mouth patch: a dense grid laid over the shell's mouth rectangle carrying
 * the detail the coarse shell grid cannot hold — lips with a cupid's bow,
 * the lip line, the philtrum and the groove above the chin. Its height is
 * the shell surface plus a displacement that fades to zero before the patch
 * edge, so the border lies on the shell and no seam shows.
 *
 * Purely cosmetic: it sits well below everything the fit test measures and
 * does not respond to any anatomy slider beyond riding the shell.
 */

export const MOUTH_COLS = 111
export const MOUTH_ROWS = 79
export const MOUTH_VERTEX_COUNT = MOUTH_COLS * MOUTH_ROWS

const HALF_MOUTH = 24.5 // corner to midline, mm
const LINE_Y = -52.5 // lip line at the midline
const UPPER_H = 5.2 // upper vermilion height at its tallest
const LOWER_H = 7.4 // lower vermilion height
// The relief stays at zero across the band where coarse shell cells still
// lie under the patch (a groove there would sink beneath them), then eases in.
const FADE_START = MOUTH_OVERLAP + 2.4
const FADE_END = FADE_START + 4

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export interface MouthSample {
  /** Forward displacement off the shell, mm. */
  dz: number
  /** 0..1: how much this point is lip (vermilion) rather than skin. */
  lip: number
  /** 0..1: depth into the lip line / corners (drawn darker). */
  line: number
}

/** Lip relief at (x, y). */
export function mouthSampleAt(x: number, y: number): MouthSample {
  const ax = Math.abs(x)
  const span = Math.max(0, 1 - (ax / HALF_MOUTH) ** 2)
  const env = span ** 0.55
  // The lip line dips a touch at the midline and settles toward the corners.
  const lineY = LINE_Y - 0.9 * (ax / HALF_MOUTH) ** 2 - 0.5 * Math.exp(-((x / 4.5) ** 2))
  // Cupid's bow: the upper border dips at the midline, peaks either side.
  const bow = 1 - 0.2 * Math.exp(-((x / 3) ** 2)) + 0.05 * Math.exp(-(((ax - 6) / 4) ** 2))
  const topY = lineY + UPPER_H * env * bow
  const botY = lineY - LOWER_H * env * (0.8 + 0.2 * Math.exp(-((x / 14) ** 2)))

  let dz = 0
  let lip = 0
  if (span > 0) {
    if (y >= lineY) {
      const h = Math.max(1e-3, topY - lineY)
      const v = (y - lineY) / h
      if (v <= 1.25) {
        // Rolls out of the lip line, fullest low on the lip, eases to skin.
        const prof = v <= 1 ? Math.sin(Math.PI * v ** 0.62) ** 0.85 : 0
        const tubercle = 1 + 0.18 * Math.exp(-((x / 5) ** 2))
        dz += 2.5 * env * prof * tubercle
        lip = Math.max(lip, smoothstep(1.06, 0.9, v) * smoothstep(0, 0.06, span))
      }
    } else {
      const h = Math.max(1e-3, lineY - botY)
      const v = (lineY - y) / h
      if (v <= 1.25) {
        const prof = v <= 1 ? Math.sin(Math.PI * v ** 0.7) ** 0.8 : 0
        // Two soft lobes either side of the midline.
        const lobes = 1 - 0.1 * Math.exp(-((x / 3.5) ** 2))
        dz += 3.3 * env * prof * lobes
        lip = Math.max(lip, smoothstep(1.05, 0.88, v) * smoothstep(0, 0.06, span))
      }
    }
  }

  // The lip line itself, deepening into the corners.
  const lineDepth =
    Math.exp(-(((y - lineY) / 0.85) ** 2)) * smoothstep(1.08, 0.9, ax / HALF_MOUTH)
  const corner = Math.exp(-(((ax - HALF_MOUTH) / 2.6) ** 2) - ((y - lineY) / 2.4) ** 2)
  dz -= 1.5 * lineDepth + 1.1 * corner

  // Philtrum: a shallow groove between two soft columns, nose base → bow.
  const phil = smoothstep(topY - 0.5, topY + 2.5, y) * smoothstep(-35.5, -40, y)
  dz += phil * (-0.9 * Math.exp(-((x / 2.7) ** 2)) + 0.45 * Math.exp(-(((ax - 4.6) / 1.7) ** 2)))

  // Mentolabial groove under the lower lip, above the chin pad.
  dz -= 1.5 * Math.exp(-(((y + 64.5) / 3.6) ** 2) - (x / 17) ** 2)

  return { dz, lip, line: Math.min(1, lineDepth + 0.7 * corner) }
}

export function mouthGridXY(i: number, j: number): { x: number; y: number } {
  return {
    x: -MOUTH_X + (i / (MOUTH_COLS - 1)) * 2 * MOUTH_X,
    y: MOUTH_Y_TOP + (j / (MOUTH_ROWS - 1)) * (MOUTH_Y_BOTTOM - MOUTH_Y_TOP),
  }
}

/** 1 in the patch interior → 0 at its border. */
export function mouthEdgeFade(x: number, y: number): number {
  const d = Math.min(MOUTH_X - Math.abs(x), MOUTH_Y_TOP - y, y - MOUTH_Y_BOTTOM)
  return smoothstep(FADE_START, FADE_END, d)
}

export function writeMouthPositions(out: Float32Array, base: number, a: ResolvedAnatomy): void {
  let k = base
  for (let j = 0; j < MOUTH_ROWS; j++) {
    for (let i = 0; i < MOUTH_COLS; i++) {
      const { x, y } = mouthGridXY(i, j)
      const fade = mouthEdgeFade(x, y)
      const d = Math.min(MOUTH_X - Math.abs(x), MOUTH_Y_TOP - y, y - MOUTH_Y_BOTTOM)
      out[k++] = x
      out[k++] = y
      // A hair of lift keeps the dense patch in front of the coarse shell
      // where they overlap.
      out[k++] =
        shellZAt(x, y, a) + mouthSampleAt(x, y).dz * fade + 0.07 * smoothstep(0, 1.5, d)
    }
  }
}

export function buildMouthIndices(vertexBase: number): number[] {
  const indices: number[] = []
  for (let j = 0; j < MOUTH_ROWS - 1; j++) {
    for (let i = 0; i < MOUTH_COLS - 1; i++) {
      const a = vertexBase + j * MOUTH_COLS + i
      const b = vertexBase + j * MOUTH_COLS + i + 1
      const c = vertexBase + (j + 1) * MOUTH_COLS + i
      const d = vertexBase + (j + 1) * MOUTH_COLS + i + 1
      // Rows run top→bottom, so wind for front (+Z) facing.
      indices.push(a, d, b, a, c, d)
    }
  }
  return indices
}
