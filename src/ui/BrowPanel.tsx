import type { BrowParams } from '../brows/browDesign'
import { useAppStore } from '../state/store'

const SLIDERS: { key: keyof BrowParams; label: string; low: string; high: string }[] = [
  { key: 'density', label: 'Hair density', low: 'Sparse', high: 'Dense' },
  { key: 'caliber', label: 'Hair caliber', low: 'Fine', high: 'Coarse' },
  { key: 'growthDirection', label: 'Growth direction', low: 'Flat/lateral', high: 'Upswept' },
  { key: 'verticalOffset', label: 'Brow position', low: 'Low', high: 'High' },
  { key: 'fullness', label: 'Fullness', low: 'Thin', high: 'Full' },
]

export function BrowPanel() {
  const browParams = useAppStore((s) => s.browParams)
  const setBrowParam = useAppStore((s) => s.setBrowParam)
  const showBrows = useAppStore((s) => s.showBrows)
  const toggleBrows = useAppStore((s) => s.toggleBrows)
  const showBrowMapping = useAppStore((s) => s.showBrowMapping)
  const toggleBrowMapping = useAppStore((s) => s.toggleBrowMapping)

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
        <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>
          Strings from the nostril edge through the inner corner (green), pupil (blue), and outer
          corner (pink). Move the nose-width or eye sliders and watch the dots travel.
        </div>
      )}
    </section>
  )
}
