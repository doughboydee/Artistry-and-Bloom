import { AnatomySliders } from './AnatomySliders'
import { BrowPanel } from './BrowPanel'
import { FitTestPanel } from './FitTestPanel'
import { InstructorPanel } from './InstructorPanel'
import { LashDesignPanel } from './LashDesignPanel'
import { ViewBar } from './ViewBar'
import { loadHeadFromFile } from '../head/headSource'
import { useAppStore, type FaceId } from '../state/store'

function FaceTabs() {
  const compareMode = useAppStore((s) => s.compareMode)
  const activeFace = useAppStore((s) => s.activeFace)
  const setActiveFace = useAppStore((s) => s.setActiveFace)
  if (!compareMode) return null
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {(['A', 'B'] as FaceId[]).map((face) => (
        <button
          key={face}
          onClick={() => setActiveFace(face)}
          style={{
            flex: 1,
            padding: '5px 0',
            borderRadius: 5,
            border: '1px solid #4a4d55',
            cursor: 'pointer',
            background: activeFace === face ? '#3d5a80' : '#2a2d33',
            color: '#e8e8ea',
            fontSize: 12,
          }}
        >
          Face {face}
        </button>
      ))}
    </div>
  )
}

export function SidePanel() {
  const activeFace = useAppStore((s) => s.activeFace)
  const compareMode = useAppStore((s) => s.compareMode)
  const headSourceName = useAppStore((s) => s.headSourceName)
  const setHeadSourceName = useAppStore((s) => s.setHeadSourceName)

  const onLoadHeadFile = (file: File) => {
    loadHeadFromFile(file)
      .then((name) => setHeadSourceName(name))
      .catch((err) => {
        console.error(err)
        alert(
          'That file could not be read as a head model. It must be a .glb following MESH_SPEC.md.',
        )
      })
  }
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
      <FaceTabs />
      <AnatomySliders faceId={compareMode ? activeFace : 'A'} />
      <FitTestPanel />
      <LashDesignPanel />
      <BrowPanel />
      <InstructorPanel onLoadHeadFile={onLoadHeadFile} headSource={headSourceName} />
      <ViewBar />
    </aside>
  )
}
