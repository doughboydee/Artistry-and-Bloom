import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BufferAttribute, BufferGeometry } from 'three'
import type { Eye, HeadModel } from '../head/HeadModel'
import { agedNaturalLashes } from '../lashes/lashDesign'
import { PRECISION_HEADROOM_MM } from '../lashes/lashDesign'
import { useAppStore, type FaceId } from '../state/store'

/**
 * The digital version of the paper map lash artists draw on an under-eye
 * pad: a ruler under each eye with a tick at every zone boundary and the
 * zone's assignment ("11 · C") written between ticks — except here it sits
 * on the actual anatomy, so the assignment and the lid it has to clear are
 * in the same picture. With precision mode on, any zone longer than the
 * natural lashes + safe headroom is flagged amber.
 */
export function LashMapOverlay({ head, faceId }: { head: HeadModel; faceId: FaceId }) {
  const faceParams = useAppStore((s) => s.faces[faceId])
  const design = useAppStore((s) => s.lashDesign)
  const natural = useAppStore((s) => s.naturalLashes)
  const show = useAppStore((s) => s.showLashMap)
  const precision = useAppStore((s) => s.showPrecision)
  const invalidate = useThree((s) => s.invalidate)

  const data = useMemo(() => {
    if (!show) return null
    const aged = agedNaturalLashes(natural, faceParams.age)
    const safeMax = aged.lengthMm + PRECISION_HEADROOM_MM
    const n = design.zones.length

    const linePts: number[] = []
    const labels: { text: string; pos: [number, number, number]; over: boolean }[] = []

    for (const eye of ['left', 'right'] as Eye[]) {
      const line = head.getLashLine(eye, 64)
      // Ruler baseline: a fixed height under the whole eye.
      const baseY = Math.min(...line.map((s) => s.position.y)) - 7
      const zAt = (t: number) => {
        const s = line[Math.round(t * (line.length - 1))]!
        return s.position.z + 1.5
      }
      const xAt = (t: number) => line[Math.round(t * (line.length - 1))]!.position.x

      // Boundary ticks: a short mark ON the lash line plus a vertical tick
      // on the ruler at the same lateral position.
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const s = line[Math.round(t * (line.length - 1))]!
        linePts.push(
          s.position.x,
          s.position.y,
          s.position.z + 0.5,
          s.position.x + s.growthDir.x * 3,
          s.position.y + s.growthDir.y * 3,
          s.position.z + 0.5 + s.growthDir.z * 3,
        )
        linePts.push(xAt(t), baseY + 2.5, zAt(t), xAt(t), baseY - 2.5, zAt(t))
      }
      // The ruler line itself.
      for (let i = 0; i < n; i++) {
        linePts.push(xAt(i / n), baseY, zAt(i / n), xAt((i + 1) / n), baseY, zAt((i + 1) / n))
      }
      // Zone labels between ticks.
      for (let i = 0; i < n; i++) {
        const zone = design.zones[i]!
        const tm = (i + 0.5) / n
        labels.push({
          // A trailing ~ marks a textured (wispy) zone.
          text: `${zone.lengthMm}·${zone.curl}${(zone.spikeRatio ?? 0) > 0 ? '~' : ''}`,
          pos: [xAt(tm), baseY - 4.5, zAt(tm)],
          over: precision && zone.lengthMm > safeMax,
        })
      }
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(linePts), 3))
    return { geo, labels }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, faceParams, design, natural, show, precision])

  useEffect(() => {
    invalidate()
    return () => data?.geo.dispose()
  }, [data, invalidate])

  if (!data) return null
  return (
    <group>
      <lineSegments geometry={data.geo} renderOrder={9}>
        <lineBasicMaterial color="#e8e2d2" transparent opacity={0.85} depthTest={false} />
      </lineSegments>
      {data.labels.map((l, i) => (
        <Html
          key={i}
          position={l.pos}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: 'system-ui, sans-serif',
              color: l.over ? '#e6a23c' : '#e8e2d2',
              fontWeight: l.over ? 700 : 500,
              textShadow: '0 0 4px #000, 0 0 2px #000',
              whiteSpace: 'nowrap',
            }}
          >
            {l.text}
            {l.over ? ' ⚠' : ''}
          </div>
        </Html>
      ))}
    </group>
  )
}
