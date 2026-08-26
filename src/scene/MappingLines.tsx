import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry } from 'three'
import type { Eye, HeadModel } from '../head/HeadModel'
import {
  computeMappingVisual,
  symmetryDeltas,
  type VisualLine,
} from '../brows/mappingLines'
import { useAppStore, type BrowMappingInfo, type FaceId } from '../state/store'

const MARKER_COLORS = { start: '#4dd07a', arch: '#4da6d0', tail: '#d04da6' }
const LINE_COLORS: Record<VisualLine['style'], string> = {
  ray: '#e8e2d2',
  guide: '#d9a05b',
  level: '#7fd4c8',
}

/**
 * The brow-mapping construction for the selected method (classic rays,
 * thread lines, or golden-ratio), recomputed from the live landmarks
 * whenever the anatomy changes, plus optional left/right symmetry guides.
 */
export function MappingLines({ head, faceId }: { head: HeadModel; faceId: FaceId }) {
  const faceParams = useAppStore((s) => s.faces[faceId])
  const show = useAppStore((s) => s.showBrowMapping)
  const method = useAppStore((s) => s.browMappingMethod)
  const showSymmetry = useAppStore((s) => s.showSymmetryGuides)
  const reportBrowMappingInfo = useAppStore((s) => s.reportBrowMappingInfo)
  const invalidate = useThree((s) => s.invalidate)

  const data = useMemo(() => {
    if (!show && !showSymmetry) return null
    const visual = computeMappingVisual(method, head.getLandmarks(), (eye: Eye) =>
      head.getBrowRegion(eye),
    )

    const byStyle: Record<VisualLine['style'], number[]> = { ray: [], guide: [], level: [] }
    const markers: { kind: 'start' | 'arch' | 'tail'; point: [number, number, number] }[] = []
    if (show) {
      for (const eye of ['left', 'right'] as Eye[]) {
        for (const l of visual[eye].lines) {
          byStyle[l.style].push(l.a.x, l.a.y, l.a.z + 1, l.b.x, l.b.y, l.b.z + 1)
        }
        for (const m of visual[eye].markers) {
          markers.push({ kind: m.kind, point: [m.point.x, m.point.y, m.point.z] })
        }
      }
    }

    const info: BrowMappingInfo = {}
    if (visual.left.levelDeltaMm !== undefined) {
      info.levelDeltaMm = { left: visual.left.levelDeltaMm, right: visual.right.levelDeltaMm! }
    }
    if (visual.left.phiRatio !== undefined) {
      info.phiRatio = { left: visual.left.phiRatio, right: visual.right.phiRatio! }
    }

    // Symmetry guides: for each marker pair, a horizontal reference line at
    // the AVERAGE height spanning both sides — a marker off its line is a
    // left/right height mismatch you can read directly on the face.
    if (showSymmetry) {
      info.symmetry = symmetryDeltas(visual)
      for (const kind of ['start', 'arch', 'tail'] as const) {
        const l = visual.left.markers.find((m) => m.kind === kind)!.point
        const r = visual.right.markers.find((m) => m.kind === kind)!.point
        const y = (l.y + r.y) / 2
        const z = Math.max(l.z, r.z)
        byStyle.level.push(l.x + 6, y, z + 1, r.x - 6, y, z + 1)
      }
    }

    const geos = (Object.keys(byStyle) as VisualLine['style'][])
      .filter((style) => byStyle[style].length > 0)
      .map((style) => {
        const geo = new BufferGeometry()
        geo.setAttribute('position', new BufferAttribute(new Float32Array(byStyle[style]), 3))
        return { style, geo }
      })
    return { geos, markers, info }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, faceParams, show, method, showSymmetry])

  useEffect(() => {
    if (data) reportBrowMappingInfo(faceId, data.info)
    invalidate()
    return () => data?.geos.forEach((g) => g.geo.dispose())
  }, [data, faceId, reportBrowMappingInfo, invalidate])

  if (!data) return null
  return (
    <group>
      {data.geos.map(({ style, geo }) => (
        <lineSegments key={style} geometry={geo} renderOrder={10}>
          <lineBasicMaterial
            color={LINE_COLORS[style]}
            transparent
            opacity={style === 'ray' ? 0.9 : 0.75}
            depthTest={false}
          />
        </lineSegments>
      ))}
      {data.markers.map((m, i) => (
        <mesh key={i} position={m.point} renderOrder={11}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial color={MARKER_COLORS[m.kind]} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}
