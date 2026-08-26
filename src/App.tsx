import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// Placeholder scene: proves the toolchain and deploy pipeline end-to-end.
// Replaced by the anatomy trainer scene in the next increment.
export default function App() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 120], near: 1, far: 2000 }}>
        <hemisphereLight intensity={0.5} />
        <directionalLight position={[100, 100, 100]} intensity={1.5} />
        <mesh>
          <sphereGeometry args={[30, 48, 32]} />
          <meshStandardMaterial color="#b0a8a0" roughness={0.8} />
        </mesh>
        <OrbitControls />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          fontSize: 14,
          opacity: 0.8,
        }}
      >
        Lash &amp; Brow Anatomy Trainer — pipeline check
      </div>
    </div>
  )
}
