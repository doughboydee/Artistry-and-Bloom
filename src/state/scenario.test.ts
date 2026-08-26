import { describe, expect, it } from 'vitest'
import { NEUTRAL_PARAMS } from '../head/HeadModel'
import {
  decodeScenarioFromHash,
  encodeScenarioToHash,
  sanitizeScenario,
  type Scenario,
} from './scenario'
import { DEFAULT_DESIGN } from '../lashes/lashDesign'

const encode = (value: unknown): string => {
  const json = JSON.stringify(value)
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('scenario decoding is safe against malformed links', () => {
  it('round-trips a legitimate scenario', () => {
    const s: Scenario = {
      v: 1,
      faces: {
        A: { ...NEUTRAL_PARAMS, lidHooding: 0.8 },
        B: { ...NEUTRAL_PARAMS },
      },
      lashDesign: JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as Scenario['lashDesign'],
      naturalLashes: { growthDirection: 0.5, density: 0.6, lengthMm: 7, thickness: 0.5, curl: 0.4 },
      browParams: { density: 0.5, caliber: 0.5, growthDirection: 0.5, verticalOffset: 0.5, fullness: 0.5 },
      fitSettings: { enabled: true, safetyMarginMm: 0.5, ghostThreshold: 0.5, showGhosts: true },
      compareMode: true,
    }
    const decoded = decodeScenarioFromHash(encodeScenarioToHash(s))
    expect(decoded).toEqual(s)
  })

  it('rejects garbage that is not base64 JSON', () => {
    expect(decodeScenarioFromHash('%%%not-base64%%%')).toBeNull()
    expect(decodeScenarioFromHash(encode('just a string'))).toBeNull()
    expect(decodeScenarioFromHash(encode(42))).toBeNull()
    expect(decodeScenarioFromHash(encode({ v: 2 }))).toBeNull()
  })

  it('repairs an empty zones array instead of crashing later', () => {
    const decoded = decodeScenarioFromHash(
      encode({ v: 1, faces: {}, lashDesign: { zones: [] } }),
    )
    expect(decoded).not.toBeNull()
    expect(decoded!.lashDesign.zones.length).toBeGreaterThan(0)
    for (const z of decoded!.lashDesign.zones) {
      expect(Number.isFinite(z.lengthMm)).toBe(true)
    }
  })

  it('repairs non-array zones and junk zone entries', () => {
    const decoded = decodeScenarioFromHash(
      encode({
        v: 1,
        faces: {},
        lashDesign: { zones: [null, { lengthMm: 'x', curl: 'Z', diameterMm: 1e9 }] },
      }),
    )
    expect(decoded).not.toBeNull()
    const zones = decoded!.lashDesign.zones
    expect(zones.length).toBe(2)
    for (const z of zones) {
      expect(z.lengthMm).toBeGreaterThanOrEqual(4)
      expect(z.lengthMm).toBeLessThanOrEqual(20)
      expect(['B', 'C', 'CC', 'D', 'L', 'M']).toContain(z.curl)
      expect(z.diameterMm).toBeLessThanOrEqual(0.3)
    }

    const nonArray = decodeScenarioFromHash(encode({ v: 1, faces: {}, lashDesign: { zones: 5 } }))
    expect(Array.isArray(nonArray!.lashDesign.zones)).toBe(true)
  })

  it('clamps absurd or non-numeric anatomy values into 0..1', () => {
    const decoded = decodeScenarioFromHash(
      encode({
        v: 1,
        faces: { A: { eyeLength: 'x', lidHooding: 1e9, eyeSpacing: -5, age: Number.NaN } },
        lashDesign: DEFAULT_DESIGN,
      }),
    )
    const a = decoded!.faces.A
    expect(a.eyeLength).toBe(NEUTRAL_PARAMS.eyeLength)
    expect(a.lidHooding).toBe(1)
    expect(a.eyeSpacing).toBe(0)
    expect(a.age).toBe(NEUTRAL_PARAMS.age)
  })

  it('sanitizeScenario fills every missing section with defaults', () => {
    const s = sanitizeScenario({ v: 1 })
    expect(s).not.toBeNull()
    expect(s!.faces.A).toEqual(NEUTRAL_PARAMS)
    expect(s!.fitSettings.enabled).toBe(true)
    expect(s!.compareMode).toBe(false)
  })
})
