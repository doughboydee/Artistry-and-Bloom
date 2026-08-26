import { Matrix4, Ray, Triangle, Vector3 } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { BufferGeometry } from 'three'
import type { HeadModel } from '../head/HeadModel'

/**
 * Accelerated geometry queries against the head's skin surface.
 *
 * A BVH ("bounding volume hierarchy") is a search tree over the mesh's
 * triangles that makes "what's the closest bit of skin to this point?" and
 * "does this ray hit the skin?" fast enough to run thousands of times per
 * change. Rebuilt lazily whenever the head reports new geometry.
 */
export class SkinBVH {
  private bvh: MeshBVH | null = null
  private builtAtVersion = -1
  private readonly head: HeadModel

  constructor(head: HeadModel) {
    this.head = head
  }

  private ensure(): MeshBVH {
    if (!this.bvh || this.builtAtVersion !== this.head.version) {
      const geometry = this.head.skinMesh.geometry as BufferGeometry
      this.bvh = new MeshBVH(geometry)
      this.builtAtVersion = this.head.version
    }
    return this.bvh
  }

  /**
   * Closest point on the skin to `p`, with the triangle's outward normal
   * (from geometry winding) so callers can tell inside from outside.
   */
  closestPoint(p: Vector3): { point: Vector3; distance: number; faceNormal: Vector3 } {
    const bvh = this.ensure()
    const target = {
      point: new Vector3(),
      distance: Infinity,
      faceIndex: 0,
    }
    bvh.closestPointToPoint(p, target)

    const geometry = this.head.skinMesh.geometry as BufferGeometry
    const index = geometry.getIndex()!
    const pos = geometry.getAttribute('position')
    const tri = new Triangle()
    const i3 = target.faceIndex * 3
    tri.a.fromBufferAttribute(pos, index.getX(i3))
    tri.b.fromBufferAttribute(pos, index.getX(i3 + 1))
    tri.c.fromBufferAttribute(pos, index.getX(i3 + 2))
    const faceNormal = new Vector3()
    tri.getNormal(faceNormal)

    return { point: target.point, distance: target.distance, faceNormal }
  }

  /** True if a ray from `origin` along `direction` hits the skin. */
  raycastFirst(origin: Vector3, direction: Vector3): boolean {
    const bvh = this.ensure()
    const ray = new Ray(origin, direction)
    // three-mesh-bvh's raycastFirst wants side info; 2 = DoubleSide.
    const hit = bvh.raycastFirst(ray, 2)
    return hit !== null
  }
}

// Kept for future use if the head ever gets a transform; today the head sits
// at the origin with identity transform, so queries are in head space.
export const IDENTITY = new Matrix4()
