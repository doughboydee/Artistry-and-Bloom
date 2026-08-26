import { AnatomySliders } from './AnatomySliders'
import { LashDesignPanel } from './LashDesignPanel'
import { ViewBar } from './ViewBar'

export function SidePanel() {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        padding: '16px 18px',
        background: '#22242a',
        borderRight: '1px solid #33363d',
      }}
    >
      <h1 style={{ fontSize: 16, marginBottom: 4 }}>Lash &amp; Brow Anatomy Trainer</h1>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 18 }}>
        Set up the anatomy, then check it from the profile — that&apos;s where designs
        succeed or fail.
      </p>
      <AnatomySliders faceId="A" />
      <LashDesignPanel />
      <ViewBar />
    </aside>
  )
}
