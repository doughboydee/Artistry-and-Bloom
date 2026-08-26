import { CURL_FAMILIES } from '../lashes/curlProfiles'
import {
  EXTENSION_DIAMETERS_MM,
  EXTENSION_LENGTHS_MM,
  PRECISION_HEADROOM_MM,
  PRESET_MAPS,
  agedNaturalLashes,
  type NaturalLashes,
  type ZoneCount,
} from '../lashes/lashDesign'
import { useAppStore } from '../state/store'

const selectStyle: React.CSSProperties = {
  background: '#2a2d33',
  color: '#e8e8ea',
  border: '1px solid #4a4d55',
  borderRadius: 4,
  fontSize: 11,
  padding: '2px 4px',
}

const NATURAL_SLIDERS: { key: keyof NaturalLashes; label: string; low: string; high: string }[] = [
  { key: 'growthDirection', label: 'Growth direction', low: 'Downward', high: 'Upward' },
  { key: 'density', label: 'Density', low: 'Sparse', high: 'Dense' },
  { key: 'curl', label: 'Natural curl', low: 'Straight', high: 'Curly' },
  { key: 'thickness', label: 'Thickness', low: 'Fine', high: 'Coarse' },
]

export function LashDesignPanel() {
  const design = useAppStore((s) => s.lashDesign)
  const natural = useAppStore((s) => s.naturalLashes)
  const setZone = useAppStore((s) => s.setZone)
  const setZoneCount = useAppStore((s) => s.setZoneCount)
  const applyPreset = useAppStore((s) => s.applyPreset)
  const setNaturalParam = useAppStore((s) => s.setNaturalParam)
  const showNatural = useAppStore((s) => s.showNaturalLashes)
  const showExtensions = useAppStore((s) => s.showExtensions)
  const toggleNaturalLashes = useAppStore((s) => s.toggleNaturalLashes)
  const toggleExtensions = useAppStore((s) => s.toggleExtensions)
  const showLashMap = useAppStore((s) => s.showLashMap)
  const toggleLashMap = useAppStore((s) => s.toggleLashMap)
  const showPrecision = useAppStore((s) => s.showPrecision)
  const togglePrecision = useAppStore((s) => s.togglePrecision)
  const activeFace = useAppStore((s) => (s.compareMode ? s.activeFace : 'A'))
  const faceAge = useAppStore((s) => s.faces[activeFace].age)

  // Precision mapping: the trainer generates the natural lashes, so it can
  // check the +2mm rule exactly for the current client (age included).
  const agedLen = agedNaturalLashes(natural, faceAge).lengthMm
  const safeMax = agedLen + PRECISION_HEADROOM_MM

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
        Lash design
      </h2>

      <div style={{ fontSize: 11, opacity: 0.6, margin: '8px 0 4px' }}>Preset maps</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {Object.keys(PRESET_MAPS).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #4a4d55',
              background: '#2a2d33',
              color: '#e8e8ea',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 4px' }}>
        <span style={{ fontSize: 11, opacity: 0.6 }}>Zones (inner → outer)</span>
        <select
          style={selectStyle}
          value={design.zones.length}
          onChange={(e) => setZoneCount(Number(e.target.value) as ZoneCount)}
        >
          {[3, 5, 7, 9].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ opacity: 0.6, textAlign: 'left' }}>
            <th style={{ padding: '2px 2px' }}>Zone</th>
            <th>Length</th>
            <th>Curl</th>
            <th>Diameter</th>
            <th title="Wispy texture: alternating longer spikes within the zone">Wisp</th>
          </tr>
        </thead>
        <tbody>
          {design.zones.map((z, i) => (
            <tr
              key={i}
              style={
                showPrecision && z.lengthMm > safeMax
                  ? { outline: '1px solid #e6a23c', outlineOffset: -1 }
                  : undefined
              }
            >
              <td style={{ padding: '3px 2px', opacity: 0.7 }}>{i + 1}</td>
              <td>
                <select
                  style={selectStyle}
                  value={z.lengthMm}
                  onChange={(e) => setZone(i, { lengthMm: Number(e.target.value) })}
                >
                  {EXTENSION_LENGTHS_MM.map((l) => (
                    <option key={l} value={l}>
                      {l} mm
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  style={selectStyle}
                  value={z.curl}
                  onChange={(e) => setZone(i, { curl: e.target.value as (typeof CURL_FAMILIES)[number] })}
                >
                  {CURL_FAMILIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  style={selectStyle}
                  value={z.diameterMm}
                  onChange={(e) => setZone(i, { diameterMm: Number(e.target.value) })}
                >
                  {EXTENSION_DIAMETERS_MM.map((d) => (
                    <option key={d} value={d}>
                      {d.toFixed(2)}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  style={selectStyle}
                  value={z.spikeRatio ?? 0}
                  onChange={(e) => setZone(i, { spikeRatio: Number(e.target.value) })}
                >
                  <option value={0}>—</option>
                  <option value={0.4}>soft</option>
                  <option value={0.8}>spiky</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 11, opacity: 0.6, margin: '12px 0 2px' }}>Natural lashes</div>
      {NATURAL_SLIDERS.map((def) => (
        <label key={def.key} style={{ display: 'block', marginTop: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 2 }}>{def.label}</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={natural[def.key]}
            onChange={(e) => setNaturalParam(def.key, Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.55 }}>
            <span>{def.low}</span>
            <span>{def.high}</span>
          </div>
        </label>
      ))}
      <label style={{ display: 'block', marginTop: 8 }}>
        <div style={{ fontSize: 12, marginBottom: 2 }}>Natural length: {natural.lengthMm.toFixed(1)} mm</div>
        <input
          type="range"
          min={4}
          max={10}
          step={0.1}
          value={natural.lengthMm}
          onChange={(e) => setNaturalParam('lengthMm', Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>

      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={showNatural} onChange={toggleNaturalLashes} />
          Natural
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={showExtensions} onChange={toggleExtensions} />
          Extensions
        </label>
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showLashMap} onChange={toggleLashMap} />
        Show lash map at the eye
      </label>
      {showLashMap && (
        <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>
          The map artists draw on an under-eye pad — zone boundaries and each zone's
          length·curl, on the actual anatomy.
        </div>
      )}
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showPrecision} onChange={togglePrecision} />
        Precision check (against natural lashes)
      </label>
      {showPrecision && (
        <div style={{ fontSize: 10, marginTop: 2 }}>
          <span style={{ opacity: 0.55 }}>
            This client's natural lashes measure {agedLen.toFixed(1)} mm, so the safe maximum is{' '}
          </span>
          <span style={{ color: '#7fd4c8' }}>{safeMax.toFixed(1)} mm</span>
          <span style={{ opacity: 0.55 }}>
            {' '}
            (natural + {PRECISION_HEADROOM_MM} mm). Longer zones are flagged{' '}
          </span>
          <span style={{ color: '#e6a23c' }}>amber</span>
          <span style={{ opacity: 0.55 }}>
            {' '}
            — too much weight for the follicle, even when the shape clears the lid.
          </span>
        </div>
      )}
    </section>
  )
}
