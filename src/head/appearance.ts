import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'

/**
 * How the head is DISPLAYED — never what it measures. Skin tone is a render
 * setting in the same family as lash colour: it changes how a design reads
 * against the skin and nothing else. It is not an anatomy parameter, carries
 * no label beyond a number, and no geometry depends on it.
 */

export type SkinToneId = 'clay' | 't1' | 't2' | 't3' | 't4' | 't5' | 't6'

export interface SkinTone {
  id: SkinToneId
  label: string
  /** Base surface colour (sRGB hex). */
  color: string
}

export const SKIN_TONES: SkinTone[] = [
  { id: 't1', label: 'Tone 1', color: '#e6c9b6' },
  { id: 't2', label: 'Tone 2', color: '#d3ad94' },
  { id: 't3', label: 'Tone 3', color: '#b88d72' },
  { id: 't4', label: 'Tone 4', color: '#956b50' },
  { id: 't5', label: 'Tone 5', color: '#69493a' },
  { id: 't6', label: 'Tone 6', color: '#44322b' },
  { id: 'clay', label: 'Clay (form study)', color: '#b8aca2' },
]

export const DEFAULT_SKIN_TONE: SkinToneId = 't3'

export const skinToneById = (id: SkinToneId): SkinTone =>
  SKIN_TONES.find((t) => t.id === id) ?? SKIN_TONES[2]!

export interface HeadAppearance {
  skinTone: SkinToneId
}

/** Deterministic PRNG (mulberry32): textures are identical on every load. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tileable value noise on an n×n lattice, bilinear with smooth weights. */
function tileNoise(size: number, cells: number, rng: () => number): Float32Array {
  const lattice = new Float32Array(cells * cells)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng()
  const out = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells
    const y0 = Math.floor(fy)
    const ty = fy - y0
    const sy = ty * ty * (3 - 2 * ty)
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells
      const x0 = Math.floor(fx)
      const tx = fx - x0
      const sx = tx * tx * (3 - 2 * tx)
      const a = lattice[(y0 % cells) * cells + (x0 % cells)]!
      const b = lattice[(y0 % cells) * cells + ((x0 + 1) % cells)]!
      const c = lattice[((y0 + 1) % cells) * cells + (x0 % cells)]!
      const d = lattice[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)]!
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
    }
  }
  return out
}

/**
 * Skin micro-relief as a tangent-space normal map: a field of pores over
 * fine and medium unevenness. Built from typed arrays (no canvas), so the
 * head can still be constructed outside a browser.
 */
export function buildSkinNormalTexture(size = 256): DataTexture {
  const rng = makeRng(90210)
  const height = new Float32Array(size * size)
  const coarse = tileNoise(size, 8, rng)
  const medium = tileNoise(size, 24, rng)
  const fine = tileNoise(size, 72, rng)
  for (let i = 0; i < height.length; i++) {
    height[i] = 0.9 * coarse[i]! + 0.55 * medium[i]! + 0.3 * fine[i]!
  }
  // Pores: small dimples, wrapped at the edges so the tile repeats cleanly.
  const pores = Math.round((size * size) / 22)
  for (let n = 0; n < pores; n++) {
    const cx = rng() * size
    const cy = rng() * size
    const r = 1.1 + rng() * 1.4
    const depth = 0.35 + rng() * 0.5
    const reach = Math.ceil(r * 2)
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const x = (((Math.round(cx) + dx) % size) + size) % size
        const y = (((Math.round(cy) + dy) % size) + size) % size
        const d2 = (dx * dx + dy * dy) / (r * r)
        height[y * size + x]! -= depth * Math.exp(-d2 * 1.6)
      }
    }
  }
  const data = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) =>
    height[(((y % size) + size) % size) * size + (((x % size) + size) % size)]!
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = at(x + 1, y) - at(x - 1, y)
      const dy = at(x, y + 1) - at(x, y - 1)
      const len = Math.hypot(dx, dy, 1)
      const k = (y * size + x) * 4
      data[k] = Math.round((-dx / len) * 127.5 + 127.5)
      data[k + 1] = Math.round((-dy / len) * 127.5 + 127.5)
      data[k + 2] = Math.round((1 / len) * 127.5 + 127.5)
      data[k + 3] = 255
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/** Periodic 1D noise around the iris (period = `cells`). */
function ringNoise(cells: number, rng: () => number): (angle01: number) => number {
  const v = new Float32Array(cells)
  for (let i = 0; i < cells; i++) v[i] = rng()
  return (angle01: number) => {
    const f = (((angle01 % 1) + 1) % 1) * cells
    const i = Math.floor(f)
    const t = f - i
    const s = t * t * (3 - 2 * t)
    return v[i % cells]! * (1 - s) + v[(i + 1) % cells]! * s
  }
}

/**
 * Iris: radial fibres, a warmer collarette around the pupil, a dark limbal
 * ring at the rim and a soft-edged pupil. One neutral grey-hazel, shared by
 * every face.
 */
export function buildIrisTexture(size = 256): DataTexture {
  const rng = makeRng(4242)
  const coarse = ringNoise(22, rng)
  const mid = ringNoise(64, rng)
  const fine = ringNoise(170, rng)
  const data = new Uint8Array(size * size * 4)
  const PUPIL = 0.36
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size - 0.5
      const py = (y + 0.5) / size - 0.5
      const r = Math.min(1, Math.hypot(px, py) * 2)
      const ang = Math.atan2(py, px) / (2 * Math.PI) + 0.5
      // Fibres run radially; a little radial drift keeps them from looking ruled.
      const fibre =
        0.5 * coarse(ang + r * 0.02) + 0.32 * mid(ang - r * 0.015) + 0.18 * fine(ang + r * 0.01)
      const stroma = 0.62 + 0.62 * fibre
      const collarette = Math.exp(-(((r - 0.5) / 0.09) ** 2))
      const inner = smooth(PUPIL, 0.62, r)
      // Outer stroma: grey-green. Inner ring: warm amber.
      let cr = mix(0.52, 0.33, inner) * stroma + 0.1 * collarette
      let cg = mix(0.4, 0.4, inner) * stroma + 0.07 * collarette
      let cb = mix(0.24, 0.37, inner) * stroma + 0.02 * collarette
      const limbal = 1 - 0.82 * smooth(0.78, 0.99, r)
      const pupil = smooth(PUPIL - 0.012, PUPIL + 0.025, r)
      cr *= limbal * pupil
      cg *= limbal * pupil
      cb *= limbal * pupil
      const k = (y * size + x) * 4
      data[k] = Math.round(Math.min(1, cr) * 255)
      data[k + 1] = Math.round(Math.min(1, cg) * 255)
      data[k + 2] = Math.round(Math.min(1, cb) * 255)
      data[k + 3] = 255
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  tex.colorSpace = SRGBColorSpace
  tex.generateMipmaps = true
  tex.minFilter = LinearMipmapLinearFilter
  tex.magFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}
