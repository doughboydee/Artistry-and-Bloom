import { useMemo, useState } from 'react'
import { downloadBakedGlb } from '../head/bakeGltf'
import {
  builtInScenarios,
  encodeScenarioToHash,
  loadSavedScenarios,
  persistSavedScenarios,
  type SavedScenario,
} from '../state/scenario'
import { useAppStore } from '../state/store'

const buttonStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderRadius: 4,
  border: '1px solid #4a4d55',
  background: '#2a2d33',
  color: '#e8e8ea',
  fontSize: 11,
  cursor: 'pointer',
}

export function InstructorPanel({
  onLoadHeadFile,
  headSource,
}: {
  onLoadHeadFile: (file: File) => void
  headSource: string
}) {
  const snapshotScenario = useAppStore((s) => s.snapshotScenario)
  const applyScenario = useAppStore((s) => s.applyScenario)
  const [saved, setSaved] = useState<SavedScenario[]>(() => loadSavedScenarios())
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const builtIns = useMemo(() => builtInScenarios(), [])

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const next = [
      ...saved.filter((s) => s.name !== trimmed),
      { name: trimmed, scenario: snapshotScenario() },
    ]
    setSaved(next)
    persistSavedScenarios(next)
    setName('')
    flash(`Saved “${trimmed}”`)
  }

  const remove = (n: string) => {
    const next = saved.filter((s) => s.name !== n)
    setSaved(next)
    persistSavedScenarios(next)
  }

  const copyLink = async () => {
    const hash = encodeScenarioToHash(snapshotScenario())
    const url = `${location.origin}${location.pathname}#s=${hash}`
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied — anyone who opens it sees this exact setup')
    } catch {
      prompt('Copy this link:', url)
    }
  }

  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
        Instructor
      </h2>

      <div style={{ fontSize: 11, opacity: 0.6, margin: '8px 0 4px' }}>Teaching cases</div>
      {builtIns.map((b) => (
        <button
          key={b.name}
          onClick={() => applyScenario(b.scenario)}
          style={{ ...buttonStyle, display: 'block', width: '100%', textAlign: 'left', marginTop: 4 }}
        >
          {b.name}
        </button>
      ))}

      <div style={{ fontSize: 11, opacity: 0.6, margin: '12px 0 4px' }}>My saved scenarios</div>
      {saved.map((s) => (
        <div key={s.name} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button
            onClick={() => applyScenario(s.scenario)}
            style={{ ...buttonStyle, flex: 1, textAlign: 'left' }}
          >
            {s.name}
          </button>
          <button onClick={() => remove(s.name)} style={buttonStyle} title="Delete">
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Scenario name…"
          style={{
            flex: 1,
            background: '#2a2d33',
            border: '1px solid #4a4d55',
            borderRadius: 4,
            color: '#e8e8ea',
            fontSize: 11,
            padding: '4px 6px',
          }}
        />
        <button onClick={save} style={buttonStyle}>
          Save
        </button>
      </div>

      <button onClick={copyLink} style={{ ...buttonStyle, display: 'block', width: '100%', marginTop: 12 }}>
        Copy share link (opens this exact setup)
      </button>

      <div style={{ fontSize: 11, opacity: 0.6, margin: '14px 0 4px' }}>Head model</div>
      <div style={{ fontSize: 10, opacity: 0.55, marginBottom: 4 }}>Current: {headSource}</div>
      <button
        onClick={() => void downloadBakedGlb()}
        style={{ ...buttonStyle, display: 'block', width: '100%' }}
      >
        Export head for Blender (.glb)
      </button>
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 3 }}>
        Opens directly in Blender with the sliders included as shape keys — a scaffold for the
        sculptor, following MESH_SPEC.md.
      </div>
      <label style={{ ...buttonStyle, display: 'block', width: '100%', marginTop: 8, textAlign: 'center' }}>
        Load sculpted head (.glb)…
        <input
          type="file"
          accept=".glb,.gltf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onLoadHeadFile(file)
            e.target.value = ''
          }}
        />
      </label>

      {notice && <div style={{ fontSize: 11, color: '#7dc98f', marginTop: 8 }}>{notice}</div>}
    </section>
  )
}
