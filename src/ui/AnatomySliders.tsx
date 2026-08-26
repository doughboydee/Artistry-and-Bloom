import type { AnatomyParams } from '../head/HeadModel'
import { useAppStore, type FaceId } from '../state/store'

interface SliderDef {
  key: keyof AnatomyParams
  label: string
  low: string
  high: string
}

const SLIDERS: SliderDef[] = [
  { key: 'browProjection', label: 'Brow bone projection', low: 'Flat', high: 'Heavy' },
  { key: 'eyeDepth', label: 'Eye depth', low: 'Protruding', high: 'Deep-set' },
  { key: 'creaseHeight', label: 'Upper lid crease height', low: 'Absent/low', high: 'High' },
  { key: 'lidHooding', label: 'Lid hooding', low: 'None', high: 'Heavy' },
  { key: 'outerCornerTilt', label: 'Outer corner tilt', low: 'Downturned', high: 'Upturned' },
  { key: 'eyeSpacing', label: 'Eye spacing', low: 'Close-set', high: 'Wide-set' },
  { key: 'eyeOpening', label: 'Eye opening height', low: 'Narrow', high: 'Tall' },
  { key: 'eyeLength', label: 'Eye length', low: 'Short', high: 'Long' },
  { key: 'noseBaseWidth', label: 'Nose base width', low: 'Narrow', high: 'Wide' },
]

export function AnatomySliders({ faceId }: { faceId: FaceId }) {
  const params = useAppStore((s) => s.faces[faceId])
  const setFaceParam = useAppStore((s) => s.setFaceParam)
  const resetFace = useAppStore((s) => s.resetFace)

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
          Face &amp; skull
        </h2>
        <button
          onClick={() => resetFace(faceId)}
          style={{
            background: 'none',
            border: '1px solid #4a4d55',
            borderRadius: 4,
            color: '#c8cad0',
            fontSize: 11,
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
      {SLIDERS.map((def) => (
        <label key={def.key} style={{ display: 'block', marginTop: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>{def.label}</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={params[def.key]}
            onChange={(e) => setFaceParam(faceId, def.key, Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              opacity: 0.6,
            }}
          >
            <span>{def.low}</span>
            <span>{def.high}</span>
          </div>
        </label>
      ))}
    </section>
  )
}
