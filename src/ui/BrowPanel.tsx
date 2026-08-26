import type { BrowParams } from '../brows/browDesign'
import { BROW_MAPPING_METHODS, type BrowMappingMethod } from '../brows/mappingLines'
import { useAppStore } from '../state/store'

const SLIDERS: { key: keyof BrowParams; label: string; low: string; high: string }[] = [
  { key: 'density', label: 'Hair density', low: 'Sparse', high: 'Dense' },
  { key: 'caliber', label: 'Hair caliber', low: 'Fine', high: 'Coarse' },
  { key: 'growthDirection', label: 'Growth direction', low: 'Flat/lateral', high: 'Upswept' },
  { key: 'verticalOffset', label: 'Brow position', low: 'Low', high: 'High' },
  { key: 'fullness', label: 'Fullness', low: 'Thin', high: 'Full' },
]

const METHOD_NOTES: Record<BrowMappingMethod, string> = {
  classic:
    'Strings from the nostril edge through the inner corner (green), pupil (blue), and outer corner (pink). Move the nose-width or eye sliders and watch the dots travel.',
  thread:
    'Inked straight lines: the brow STARTS on the vertical line above the nostril wing, ARCHES on the vertical at the outer edge of the iris, and the horizontal level line shows whether the tail ends above or below its start.',
  goldenRatio:
    'Measured proportion: the arch divides the start→tail span so the inner part is 1.618× the outer part — the phi ratio caliper artists check.',
}

const fmtMm = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}mm`

export function BrowPanel() {
  const browParams = useAppStore((s) => s.browParams)
  const setBrowParam = useAppStore((s) => s.setBrowParam)
  const showBrows = useAppStore((s) => s.showBrows)
  const toggleBrows = useAppStore((s) => s.toggleBrows)
  const showBrowMapping = useAppStore((s) => s.showBrowMapping)
  const toggleBrowMapping = useAppStore((s) => s.toggleBrowMapping)
  const method = useAppStore((s) => s.browMappingMethod)
  const setMethod = useAppStore((s) => s.setBrowMappingMethod)
  const showSymmetry = useAppStore((s) => s.showSymmetryGuides)
  const toggleSymmetry = useAppStore((s) => s.toggleSymmetryGuides)
  const activeFace = useAppStore((s) => (s.compareMode ? s.activeFace : 'A'))
  const info = useAppStore((s) => s.browMappingInfo[activeFace])

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
        Brows
      </h2>
      {SLIDERS.map((def) => (
        <label key={def.key} style={{ display: 'block', marginTop: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 2 }}>{def.label}</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={browParams[def.key]}
            onChange={(e) => setBrowParam(def.key, Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.55 }}
          >
            <span>{def.low}</span>
            <span>{def.high}</span>
          </div>
        </label>
      ))}
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showBrows} onChange={toggleBrows} />
        Show brow hair
      </label>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showBrowMapping} onChange={toggleBrowMapping} />
        Show mapping lines (start / arch / tail)
      </label>
      {showBrowMapping && (
        <div style={{ marginTop: 6 }}>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as BrowMappingMethod)}
            style={{
              width: '100%',
              background: '#2a2d33',
              border: '1px solid #4a4d55',
              borderRadius: 4,
              color: '#e8e8ea',
              fontSize: 11,
              padding: '4px 6px',
            }}
          >
            {BROW_MAPPING_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>{METHOD_NOTES[method]}</div>
          {method === 'thread' && info?.levelDeltaMm && (
            <div style={{ fontSize: 10, marginTop: 4, color: '#7fd4c8' }}>
              Tail vs start height — left: {fmtMm(info.levelDeltaMm.left)}, right:{' '}
              {fmtMm(info.levelDeltaMm.right)}. A tail below its start (−) drags the face down.
            </div>
          )}
          {method === 'goldenRatio' && info?.phiRatio && (
            <div style={{ fontSize: 10, marginTop: 4, color: '#7fd4c8' }}>
              Start→arch : arch→tail — left {info.phiRatio.left.toFixed(2)} : 1, right{' '}
              {info.phiRatio.right.toFixed(2)} : 1 (the phi ideal is 1.62 : 1).
            </div>
          )}
        </div>
      )}
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showSymmetry} onChange={toggleSymmetry} />
        Show symmetry guides
      </label>
      {showSymmetry && (
        <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>
          Horizontal reference lines across both brows — a dot off its line is a left/right height
          mismatch.
          {info?.symmetry && (
            <span style={{ color: '#7fd4c8' }}>
              {' '}
              Height differences (left − right): start {fmtMm(info.symmetry.start)}, arch{' '}
              {fmtMm(info.symmetry.arch)}, tail {fmtMm(info.symmetry.tail)}.
            </span>
          )}
        </div>
      )}
    </section>
  )
}
