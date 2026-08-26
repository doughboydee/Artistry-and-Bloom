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
