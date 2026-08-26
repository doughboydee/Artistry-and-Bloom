import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { View } from '@react-three/drei'
import { FaceScene } from './scene/FaceScene'
import { CameraRig } from './scene/CameraRig'
import { SidePanel } from './ui/SidePanel'
import { useAppStore } from './state/store'

export default function App() {
  const compareMode = useAppStore((s) => s.compareMode)
  const containerRef = useRef<HTMLDivElement>(null!)
  const viewARef = useRef<HTMLDivElement>(null!)
  const viewBRef = useRef<HTMLDivElement>(null!)

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <SidePanel />
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
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
          camera={{ position: [140, 50, 280], near: 1, far: 2000 }}
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
