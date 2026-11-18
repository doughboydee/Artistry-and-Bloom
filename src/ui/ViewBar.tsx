import { SKIN_TONES } from '../head/appearance'
import { useAppStore, type ViewPreset } from '../state/store'

const BUTTONS: { preset: ViewPreset; label: string }[] = [
  { preset: 'front', label: 'Front' },
  { preset: 'profile', label: 'Profile' },
  { preset: 'free', label: 'Free orbit' },
]

export function ViewBar() {
  const preset = useAppStore((s) => s.view.preset)
  const setPreset = useAppStore((s) => s.setPreset)
  const showLashLineDebug = useAppStore((s) => s.view.showLashLineDebug)
  const toggleLashLineDebug = useAppStore((s) => s.toggleLashLineDebug)

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
        View
      </h2>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {BUTTONS.map((b) => (
          <button
            key={b.preset}
            onClick={() => setPreset(b.preset)}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 5,
              border: '1px solid #4a4d55',
              cursor: 'pointer',
              background: preset === b.preset ? '#3d5a80' : '#2a2d33',
              color: '#e8e8ea',
              fontSize: 12,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <CompareToggle />
      <SkinToneRow />
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginTop: 12,
          fontSize: 12,
          opacity: 0.8,
          cursor: 'pointer',
        }}
      >
        <input type="checkbox" checked={showLashLineDebug} onChange={toggleLashLineDebug} />
        Show lash line (where extensions will attach)
      </label>
    </section>
  )
}

function CompareToggle() {
  const compareMode = useAppStore((s) => s.compareMode)
  const setCompareMode = useAppStore((s) => s.setCompareMode)
  return (
    <label
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginTop: 12,
        fontSize: 12,
        opacity: 0.9,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={compareMode}
        onChange={(e) => setCompareMode(e.target.checked)}
      />
      Compare two faces (same design on both)
    </label>
  )
}

/** Display-only skin rendering: a row of tones plus the neutral clay. */
function SkinToneRow() {
  const skinTone = useAppStore((s) => s.view.skinTone)
  const setSkinTone = useAppStore((s) => s.setSkinTone)
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.9 }}>Skin display</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }} role="radiogroup" aria-label="Skin display">
        {SKIN_TONES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={skinTone === t.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setSkinTone(t.id)}
            style={{
              flex: 1,
              height: 24,
              borderRadius: 5,
              cursor: 'pointer',
              background: t.color,
              border: skinTone === t.id ? '2px solid #e8e8ea' : '1px solid #4a4d55',
              outline: skinTone === t.id ? '1px solid #3d5a80' : 'none',
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 5, lineHeight: 1.35 }}>
        Changes only how the face is drawn, so you can judge lash and brow contrast. The last
        swatch is plain clay for studying form. Measurements never change.
      </div>
    </div>
  )
}
