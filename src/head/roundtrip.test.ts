import { describe, expect, it } from 'vitest'
import type { Group } from 'three'

// GLTFExporter uses the browser FileReader; give node a minimal stand-in.
if (typeof globalThis.FileReader === 'undefined') {
  class NodeFileReader {
    result: ArrayBuffer | string | null = null
    onloadend: (() => void) | null = null
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((buf) => {
        this.result = buf
        this.onloadend?.()
      })
    }
    readAsDataURL() {
      throw new Error('not needed: the baked head has no images')
    }
  }
  ;(globalThis as Record<string, unknown>).FileReader = NodeFileReader
}
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { NEUTRAL_PARAMS } from './HeadModel'
import { ProceduralHead } from './procedural/ProceduralHead'
import { GltfMorphHead } from './gltf/GltfMorphHead'
import { exportBakedGlb, MORPH_PARAMS } from './bakeGltf'
import { SkinBVH } from '../fit/skinBvh'
import { runFitTest } from '../fit/runFitTest'
import { buildAnchors, buildExtensions } from '../lashes/fiberGeometry'
import { DEFAULT_DESIGN, DEFAULT_NATURAL_LASHES } from '../lashes/lashDesign'
import { decodeScenarioFromHash, encodeScenarioToHash, builtInScenarios } from '../state/scenario'

async function loadBaked(): Promise<Group> {
  const glb = await exportBakedGlb()
  const gltf = await new GLTFLoader().parseAsync(glb, '')
  return gltf.scene as unknown as Group
}

describe('Blender bridge round trip (export → load)', () => {
  it('bakes a .glb with every morph and required object', async () => {
    const scene = await loadBaked()
    for (const name of ['skin', 'lashLine_L', 'lashLine_R', 'browLine_L', 'browLine_R', 'eye_L', 'eye_R', 'pupil_L', 'nostrilOuter_R']) {
      expect(scene.getObjectByName(name), name).toBeTruthy()
    }
    const skin = scene.getObjectByName('skin')!
    const dict = (skin as unknown as { morphTargetDictionary?: Record<string, number> })
      .morphTargetDictionary
    expect(Object.keys(dict ?? {}).sort()).toEqual([...MORPH_PARAMS].sort())
  }, 30000)

  it('reproduces the procedural lash line through the loader', async () => {
    const scene = await loadBaked()
    const loaded = new GltfMorphHead(scene, NEUTRAL_PARAMS)
    const procedural = new ProceduralHead(NEUTRAL_PARAMS)

    for (const params of [NEUTRAL_PARAMS, { ...NEUTRAL_PARAMS, browProjection: 1, eyeSpacing: 0.8 }]) {
      loaded.setParams(params)
      procedural.setParams(params)
      const a = loaded.getLashLine('left', 20)
      const b = procedural.getLashLine('left', 20)
      for (let i = 2; i < 18; i++) {
        // Baked lash line is a 40-point resample of an analytic curve, so a
        // small tolerance is expected; anything beyond ~1mm means the morphs
        // or the resampling are broken.
        expect(a[i]!.position.distanceTo(b[i]!.position)).toBeLessThan(1.2)
      }
    }
  }, 30000)

  it('bakes node transforms into world space (transformed Blender exports)', async () => {
    const plain = new GltfMorphHead(await loadBaked(), NEUTRAL_PARAMS)

    // A sculptor's file often wraps everything in a transformed parent node
    // (unit scale, axis conversion). All queries must agree on world space.
    const { Group: G } = await import('three')
    const wrapper = new G()
    const inner = await loadBaked()
    inner.position.set(5, -3, 2)
    wrapper.add(inner)
    const transformed = new GltfMorphHead(wrapper, NEUTRAL_PARAMS)

    const a = plain.getLashLine('left', 10)
    const b = transformed.getLashLine('left', 10)
    for (let i = 0; i < 10; i++) {
      expect(b[i]!.position.x).toBeCloseTo(a[i]!.position.x + 5, 3)
      expect(b[i]!.position.y).toBeCloseTo(a[i]!.position.y - 3, 3)
      expect(b[i]!.position.z).toBeCloseTo(a[i]!.position.z + 2, 3)
    }
    // Skin vertices (what the fit test reads) carry the same offset.
    const pa = plain.skinMesh.geometry.getAttribute('position')
    const pb = transformed.skinMesh.geometry.getAttribute('position')
    expect(pb.getX(0)).toBeCloseTo(pa.getX(0) + 5, 3)
    expect(pb.getY(0)).toBeCloseTo(pa.getY(0) - 3, 3)
    // And the rendered node no longer double-applies the transform.
    expect(transformed.skinMesh.position.length()).toBeLessThan(1e-6)
  }, 30000)

  it('produces an equivalent fit-test verdict on the loaded head', async () => {
    const scene = await loadBaked()
    // Compare at a morph ENDPOINT (hooding = 1): between endpoints a linear
    // morph cannot reproduce the procedural hood's nonlinear fold slide, so
    // mid-range counts legitimately differ — a documented limitation that
    // applies to any morph-based head, sculpted ones included.
    const params = { ...NEUTRAL_PARAMS, lidHooding: 1, creaseHeight: 0.3 }
    const loaded = new GltfMorphHead(scene, params)
    const procedural = new ProceduralHead(params)
    const anchors = buildAnchors('left')

    const summaries = [loaded, procedural].map((head) => {
      const line = head.getLashLine('left', 80)
      const set = buildExtensions(line, anchors, DEFAULT_NATURAL_LASHES, {
        zones: DEFAULT_DESIGN.zones.map((z) => ({ ...z, lengthMm: 13, curl: 'D' as const })),
      })
      return runFitTest(set, new SkinBVH(head), 0.5, 0.5).summary
    })
    const [l, p] = summaries
    expect(l!.total).toBe(p!.total)
    // The two heads must agree on the overall verdict within a small band.
    expect(Math.abs(l!.colliding - p!.colliding)).toBeLessThanOrEqual(Math.max(5, p!.colliding * 0.5))
  }, 30000)
})

describe('scenario share links', () => {
  it('round-trips every built-in scenario through the URL hash', () => {
    for (const { scenario } of builtInScenarios()) {
      const hash = encodeScenarioToHash(scenario)
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
      const back = decodeScenarioFromHash(hash)
      expect(back).toEqual(scenario)
    }
  })

  it('rejects garbage hashes gracefully', () => {
    expect(decodeScenarioFromHash('not-base64!!!')).toBeNull()
    expect(decodeScenarioFromHash('aGVsbG8')).toBeNull()
  })
})
