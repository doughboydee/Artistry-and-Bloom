import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry } from 'three'
import type { Eye, HeadModel } from '../head/HeadModel'
import { computeMappingLines, type MappingLine } from '../brows/mappingLines'
import { useAppStore, type FaceId } from '../state/store'

const MARKER_COLORS = { start: '#4dd07a', arch: '#4da6d0', tail: '#d04da6' }

/**
 * The three brow-mapping teaching lines (start / arch / tail), recomputed
 * from the live landmarks whenever the anatomy changes.
 */
export function MappingLines({ head, faceId }: { head: HeadModel; faceId: FaceId }) {
  const faceParams = useAppStore((s) => s.faces[faceId])
  const show = useAppStore((s) => s.showBrowMapping)
  const invalidate = useThree((s) => s.invalidate)

  const data = useMemo(() => {
    if (!show) return null
    const mapping = computeMappingLines(head.getLandmarks(), (eye: Eye) =>
      head.getBrowRegion(eye),
    )
    const lines: MappingLine[] = []
    for (const eye of ['left', 'right'] as Eye[]) {
      lines.push(mapping[eye].start, mapping[eye].arch, mapping[eye].tail)
    }
    const positions: number[] = []
    for (const l of lines) {
      positions.push(l.origin.x, l.origin.y, l.origin.z + 1, l.lineEnd.x, l.lineEnd.y, l.lineEnd.z + 1)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    const markers = (['start', 'arch', 'tail'] as const).flatMap((kind) =>
      (['left', 'right'] as Eye[]).map((eye) => ({
        kind,
        point: mapping[eye][kind].browPoint,
      })),
    )
    return { geo, markers }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, faceParams, show])

  useEffect(() => {
    invalidate()
    return () => data?.geo.dispose()
  }, [data, invalidate])

  if (!data) return null
  return (
    <group>
      <lineSegments geometry={data.geo} renderOrder={10}>
        <lineBasicMaterial color="#e8e2d2" transparent opacity={0.9} depthTest={false} />
      </lineSegments>
      {data.markers.map((m, i) => (
        <mesh key={i} position={m.point} renderOrder={11}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial color={MARKER_COLORS[m.kind]} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}
