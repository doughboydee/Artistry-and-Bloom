import { describe, expect, it } from 'vitest'
import { NEUTRAL_PARAMS } from '../head/HeadModel'
import { ProceduralHead } from '../head/procedural/ProceduralHead'
import { CURL_FAMILIES } from './curlProfiles'
import { buildAnchors, buildExtensions } from './fiberGeometry'
import {
  DEFAULT_NATURAL_LASHES,
  EXTENSION_LENGTHS_MM,
  PRESET_MAPS,
} from './lashDesign'

describe('preset maps', () => {
  it('every preset has 5 valid zones from the extension catalog', () => {
    for (const [name, zones] of Object.entries(PRESET_MAPS)) {
      expect(zones.length, name).toBe(5)
      for (const z of zones) {
        expect(EXTENSION_LENGTHS_MM as readonly number[], name).toContain(z.lengthMm)
        expect(CURL_FAMILIES, name).toContain(z.curl)
        expect(z.diameterMm).toBeGreaterThan(0)
        expect(z.diameterMm).toBeLessThanOrEqual(0.25)
      }
    }
  })

  it('fox eye elongates outward with a flatter tail curl', () => {
    const fox = PRESET_MAPS['fox eye']!
    expect(fox[4]!.lengthMm).toBeGreaterThan(fox[0]!.lengthMm + 3)
    expect(['L', 'M']).toContain(fox[4]!.curl)
  })

  it('eyeliner effect stays short and dense', () => {
    for (const z of PRESET_MAPS['eyeliner effect']!) {
      expect(z.lengthMm).toBeLessThanOrEqual(8)
      expect(z.curl).toBe('L')
    }
  })
})

describe('wispy texture', () => {
  const head = new ProceduralHead(NEUTRAL_PARAMS)
  const line = head.getLashLine('left', 80)
  const anchors = buildAnchors('left')

  const lengthsOf = (zones: typeof PRESET_MAPS.natural) => {
    const set = buildExtensions(line, anchors, DEFAULT_NATURAL_LASHES, { zones: zones! })
    const rings = 17
    const lengths: number[] = []
    for (let f = 0; f < set.fiberCount; f++) {
      // Polyline arc length ≈ fiber length.
      let L = 0
      for (let i = 1; i < rings; i++) {
        const a = (f * rings + i - 1) * 3
        const b = (f * rings + i) * 3
        L += Math.hypot(
          set.polylines[b]! - set.polylines[a]!,
          set.polylines[b + 1]! - set.polylines[a + 1]!,
          set.polylines[b + 2]! - set.polylines[a + 2]!,
        )
      }
      lengths.push(L)
    }
    return lengths
  }

  it('wispy zones alternate spikes; plain zones stay uniform', () => {
    const spread = (arr: number[]) => Math.max(...arr) - Math.min(...arr)
    // Compare a single-zone design so zone-to-zone steps don't interfere.
    const wispy = lengthsOf([
      { lengthMm: 10, curl: 'CC', diameterMm: 0.15, spikeRatio: 0.8 },
    ] as never)
    const plain = lengthsOf([{ lengthMm: 10, curl: 'CC', diameterMm: 0.15 }] as never)
    expect(spread(plain)).toBeLessThan(0.2)
    expect(spread(wispy)).toBeGreaterThan(2)
  })
})
