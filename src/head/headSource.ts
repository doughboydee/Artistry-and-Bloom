import { Mesh, type Group, Line, Points } from 'three'
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

/** Free GPU/CPU resources of a scene we no longer show. Clones rendered by
 *  HeadRoot share these geometries, but three.js transparently re-uploads a
 *  disposed geometry if something still draws it, so this is always safe. */
function disposeScene(scene: Group | null): void {
  scene?.traverse((obj) => {
    if (obj instanceof Mesh || obj instanceof Line || obj instanceof Points) {
      obj.geometry?.dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) m?.dispose()
    }
  })
}

export function clearLoadedHead(): void {
  disposeScene(loadedScene)
  loadedScene = null
}

export async function loadHeadFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(buffer, '')
  disposeScene(loadedScene)
  loadedScene = gltf.scene as unknown as Group
  return file.name
}
