import { useAppStore, type FaceId } from '../state/store'

function EyeSummaryLine({ face, eye }: { face: FaceId; eye: 'left' | 'right' }) {
  const summary = useAppStore((s) => s.fitResults[face]?.[eye])
  const margin = useAppStore((s) => s.fitSettings.safetyMarginMm)
  if (!summary) return null
  const parts: string[] = []
  if (summary.colliding > 0) parts.push(`${summary.colliding} touch the lid (red)`)
  if (summary.near > 0) parts.push(`${summary.near} within ${margin.toFixed(1)} mm (amber)`)
  if (summary.ghosted > 0) parts.push(`${summary.ghosted} hidden from the front (ghosted)`)
  const text = parts.length > 0 ? parts.join(', ') : 'all clear'
  return (
    <div style={{ fontSize: 11, marginTop: 3, opacity: parts.length > 0 ? 0.9 : 0.55 }}>
      <span style={{ opacity: 0.6 }}>{eye === 'left' ? 'Left' : 'Right'} eye:</span>{' '}
      {text}
      <span style={{ opacity: 0.5 }}> — of {summary.total}</span>
    </div>
  )
}

export function FitTestPanel() {
  const fitSettings = useAppStore((s) => s.fitSettings)
  const setFitSetting = useAppStore((s) => s.setFitSetting)
  const compareMode = useAppStore((s) => s.compareMode)

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
        Fit test
      </h2>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={fitSettings.enabled}
          onChange={(e) => setFitSetting('enabled', e.target.checked)}
        />
        Test the design against the anatomy
      </label>

      {fitSettings.enabled && (
        <>
          <label style={{ display: 'block', marginTop: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 2 }}>
              Safety margin: {fitSettings.safetyMarginMm.toFixed(1)} mm
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.1}
              value={fitSettings.safetyMarginMm}
              onChange={(e) => setFitSetting('safetyMarginMm', Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: 10, opacity: 0.55 }}>
              Extensions closer to the lid than this show amber
            </div>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={fitSettings.showGhosts}
              onChange={(e) => setFitSetting('showGhosts', e.target.checked)}
            />
            Ghost the extensions hidden from front view
          </label>

          <div style={{ marginTop: 10 }}>
            {(compareMode ? (['A', 'B'] as FaceId[]) : (['A'] as FaceId[])).map((face) => (
              <div key={face} style={{ marginTop: compareMode ? 8 : 0 }}>
                {compareMode && (
                  <div style={{ fontSize: 11, opacity: 0.6 }}>Face {face}</div>
                )}
                <EyeSummaryLine face={face} eye="left" />
                <EyeSummaryLine face={face} eye="right" />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
