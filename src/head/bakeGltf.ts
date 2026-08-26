import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { AnatomyParams, Eye } from './HeadModel'
import { NEUTRAL_PARAMS } from './HeadModel'
import { ProceduralHead } from './procedural/ProceduralHead'

/**
 * Bake the procedural head into a glTF binary (.glb) that follows
 * MESH_SPEC.md — the same contract a Blender artist will deliver against.
 *
 * Because the procedural head has FIXED topology, we can evaluate it at the
 * neutral pose and at each parameter's maximum, and store the differences as
 * morph targets (Blender: shape keys) named exactly after the parameters.
 * The result opens directly in Blender as a working scaffold, and it is the
 * test asset that proves the app's sculpted-head loader works.
 */

export const MORPH_PARAMS: (keyof AnatomyParams)[] = [
  'browProjection',
  'eyeDepth',
  'creaseHeight',
  'lidHooding',
  'outerCornerTilt',
  'eyeSpacing',
  'eyeOpening',
  'eyeLength',
  'noseBaseWidth',
  'age',
]

const LASH_LINE_POINTS = 40

function morphDeltas(basePositions: Float32Array, morphed: Float32Array): Float32Array {
  const out = new Float32Array(basePositions.length)
  for (let i = 0; i < out.length; i++) out[i] = morphed[i]! - basePositions[i]!
  return out
}

/** Build the export scene graph (also used by tests). */
export function buildBakedScene(): Group {
  const scene = new Group()
  scene.name = 'lash-brow-trainer-head'

  // Neutral head.
  const neutralHead = new ProceduralHead(NEUTRAL_PARAMS)
  const baseGeometry = neutralHead.skinMesh.geometry as BufferGeometry
  const basePositions = new Float32Array(
    (baseGeometry.getAttribute('position') as BufferAttribute).array as Float32Array,
  )
  const baseLashLines: Record<Eye, Float32Array> = {
    left: lashLineArray(neutralHead, 'left'),
    right: lashLineArray(neutralHead, 'right'),
  }
  const baseBrowLines: Record<Eye, Float32Array> = {
    left: browLineArray(neutralHead, 'left'),
    right: browLineArray(neutralHead, 'right'),
  }

  // Skin mesh with one morph target per parameter.
  const skinGeometry = new BufferGeometry()
  skinGeometry.setAttribute('position', new Float32BufferAttribute(basePositions.slice(), 3))
  skinGeometry.setIndex(baseGeometry.getIndex()!.clone())
  skinGeometry.morphAttributes.position = []
  // Our morph attributes are DELTAS; without this flag the exporter would
  // treat them as absolute targets and subtract the base a second time.
  skinGeometry.morphTargetsRelative = true
  skinGeometry.computeVertexNormals()

  const lashMorphs: Record<Eye, Float32Array[]> = { left: [], right: [] }
  const browMorphs: Record<Eye, Float32Array[]> = { left: [], right: [] }

  const probe = new ProceduralHead(NEUTRAL_PARAMS)
  for (const param of MORPH_PARAMS) {
    probe.setParams({ ...NEUTRAL_PARAMS, [param]: 1 })
    const morphedPositions = (probe.skinMesh.geometry.getAttribute('position') as BufferAttribute)
      .array as Float32Array
    const attr = new Float32BufferAttribute(morphDeltas(basePositions, morphedPositions), 3)
    attr.name = param
    skinGeometry.morphAttributes.position.push(attr)
    for (const eye of ['left', 'right'] as Eye[]) {
      lashMorphs[eye].push(morphDeltas(baseLashLines[eye], lashLineArray(probe, eye)))
      browMorphs[eye].push(morphDeltas(baseBrowLines[eye], browLineArray(probe, eye)))
    }
  }

  const skin = new Mesh(
    skinGeometry,
    new MeshStandardMaterial({ color: '#b8aca2', roughness: 0.85 }),
  )
  skin.name = 'skin'
  skin.morphTargetInfluences = MORPH_PARAMS.map(() => 0)
  // glTF exports morph names from this dictionary.
  skin.morphTargetDictionary = Object.fromEntries(MORPH_PARAMS.map((p, i) => [p, i]))
  scene.add(skin)

  // Lash-line and brow-line polylines with the same morphs.
  const addLine = (name: string, base: Float32Array, morphs: Float32Array[], color: string) => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(base.slice(), 3))
    geo.morphTargetsRelative = true
    geo.morphAttributes.position = morphs.map((deltas, i) => {
      const attr = new Float32BufferAttribute(deltas, 3)
      attr.name = MORPH_PARAMS[i]!
      return attr
    })
    const line = new Line(geo, new LineBasicMaterial({ color }))
    line.name = name
    line.morphTargetInfluences = MORPH_PARAMS.map(() => 0)
    line.morphTargetDictionary = Object.fromEntries(MORPH_PARAMS.map((p, i) => [p, i]))
    scene.add(line)
  }
  for (const eye of ['left', 'right'] as Eye[]) {
    const suffix = eye === 'left' ? 'L' : 'R'
    addLine(`lashLine_${suffix}`, baseLashLines[eye], lashMorphs[eye], '#ff4d6d')
    addLine(`browLine_${suffix}`, baseBrowLines[eye], browMorphs[eye], '#4da6d0')
  }

  // Eyeballs (simple spheres at neutral) and landmark markers.
  const landmarks = neutralHead.getLandmarks()
  for (const eye of ['left', 'right'] as Eye[]) {
    const suffix = eye === 'left' ? 'L' : 'R'
    const sphere = new Mesh(
      new SphereGeometry(12, 24, 18),
      new MeshStandardMaterial({ color: '#f2efe9' }),
    )
    sphere.name = `eye_${suffix}`
    const pupil = landmarks.pupil[eye]
    sphere.position.set(pupil.x, pupil.y, pupil.z - 12)
    scene.add(sphere)

    for (const [name, point] of [
      [`pupil_${suffix}`, landmarks.pupil[eye]],
      [`innerCanthus_${suffix}`, landmarks.innerCanthus[eye]],
      [`outerCanthus_${suffix}`, landmarks.outerCanthus[eye]],
      [`nostrilOuter_${suffix}`, landmarks.nostrilOuter[eye]],
    ] as const) {
      const empty = new Object3D()
      empty.name = name
      empty.position.copy(point)
      scene.add(empty)
    }
  }

  neutralHead.dispose()
  probe.dispose()
  return scene
}

function browLineArray(head: ProceduralHead, eye: Eye): Float32Array {
  const region = head.getBrowRegion(eye)
  const POINTS = 24
  const out = new Float32Array(POINTS * 3)
  for (let i = 0; i < POINTS; i++) {
    const p = region(i / (POINTS - 1), 0.5).position
    out[i * 3] = p.x
    out[i * 3 + 1] = p.y
    out[i * 3 + 2] = p.z
  }
  return out
}

function lashLineArray(head: ProceduralHead, eye: Eye): Float32Array {
  const samples = head.getLashLine(eye, LASH_LINE_POINTS)
  const out = new Float32Array(samples.length * 3)
  samples.forEach((s, i) => {
    out[i * 3] = s.position.x
    out[i * 3 + 1] = s.position.y
    out[i * 3 + 2] = s.position.z
  })
  return out
}

/** Export the baked head as a .glb ArrayBuffer. */
export function exportBakedGlb(): Promise<ArrayBuffer> {
  const scene = buildBakedScene()
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result as ArrayBuffer),
      (err) => reject(err),
      { binary: true },
    )
  })
}

/** Trigger a browser download of the baked head. */
export async function downloadBakedGlb(): Promise<void> {
  const buffer = await exportBakedGlb()
  const blob = new Blob([buffer], { type: 'model/gltf-binary' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'anatomy-trainer-head.glb'
  link.click()
  // Deferred: revoking synchronously can race the download start in some
  // browsers and abort it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
