import type { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Holder for a loaded sculpted-head scene. three.js objects stay out of the
 * zustand store; the store only carries the source NAME, which components
 * key their regeneration on.
 */
let loadedScene: Group | null = null

export const BUILT_IN_NAME = 'Built-in stand-in head'

export function getLoadedHeadScene(): Group | null {
  return loadedScene
}

export function clearLoadedHead(): void {
  loadedScene = null
}

export async function loadHeadFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(buffer, '')
  loadedScene = gltf.scene as unknown as Group
  return file.name
}
