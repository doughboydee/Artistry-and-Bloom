import { Canvas } from '@react-three/fiber'
import { FaceScene } from './scene/FaceScene'
import { CameraRig } from './scene/CameraRig'
import { SidePanel } from './ui/SidePanel'

export default function App() {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <SidePanel />
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          frameloop="demand"
          camera={{ position: [180, 60, 360], near: 1, far: 2000 }}
        >
          <FaceScene faceId="A" />
          <CameraRig />
        </Canvas>
      </div>
    </div>
  )
}
