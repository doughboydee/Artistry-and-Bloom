import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'
import { FaceScene } from './scene/FaceScene'
import { CameraRig } from './scene/CameraRig'
import { SidePanel } from './ui/SidePanel'
import { decodeScenarioFromHash } from './state/scenario'
import { useAppStore } from './state/store'

export default function App() {
  const compareMode = useAppStore((s) => s.compareMode)
  const applyScenario = useAppStore((s) => s.applyScenario)

  // A share link carries the whole scenario in the URL hash: #s=...
  // Handled on load AND on hash change (a link pasted into an already-open
  // tab). The hash is dropped once applied: otherwise a later page reload
  // would silently snap back to the link's setup, erasing everything the
  // user changed since opening it.
  useEffect(() => {
    const applyFromHash = () => {
      const match = /#s=([A-Za-z0-9_-]+)/.exec(location.hash)
      if (!match) return
      const scenario = decodeScenarioFromHash(match[1]!)
      if (scenario) applyScenario(scenario)
      history.replaceState(null, '', location.pathname + location.search)
    }
    applyFromHash()
    window.addEventListener('hashchange', applyFromHash)
    return () => window.removeEventListener('hashchange', applyFromHash)
  }, [applyScenario])
  const containerRef = useRef<HTMLDivElement>(null!)
  const viewARef = useRef<HTMLDivElement>(null!)
  const viewBRef = useRef<HTMLDivElement>(null!)

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <SidePanel />
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          // Studio backdrop: a soft pool of light behind the head.
          background:
            'radial-gradient(ellipse at 50% 42%, #4a4d55 0%, #2b2d33 45%, #17181c 100%)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compareMode ? '1fr 1fr' : '1fr',
            width: '100%',
            height: '100%',
          }}
        >
          <div ref={viewARef} style={{ position: 'relative' }}>
            {compareMode && <ViewLabel text="Face A" />}
          </div>
          {compareMode && (
            <div ref={viewBRef} style={{ position: 'relative', borderLeft: '1px solid #33363d' }}>
              <ViewLabel text="Face B" />
            </div>
          )}
        </div>
        <Canvas
          eventSource={containerRef}
          frameloop="demand"
          shadows="variance"
          dpr={[1, 2]}
          gl={{ antialias: true, toneMappingExposure: 0.95 }}
          // A long (portrait) lens: faces look right at ~30°, distorted at 50°.
          camera={{ position: [190, 50, 370], fov: 30, near: 1, far: 3000 }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <View track={viewARef}>
            <FaceScene faceId="A" />
            <CameraRig viewId="A" />
          </View>
          {compareMode && (
            <View track={viewBRef}>
              <FaceScene faceId="B" />
              <CameraRig viewId="B" />
            </View>
          )}
        </Canvas>
      </div>
    </div>
  )
}

function ViewLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 12,
        fontSize: 12,
        opacity: 0.7,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}
