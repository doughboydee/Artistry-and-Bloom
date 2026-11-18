import { Environment, Lightformer } from '@react-three/drei'

/**
 * Portrait studio lighting. A soft image-based environment (built in code
 * from a few light panels; nothing is downloaded) gives skin and eyes
 * something to reflect, a shadow-casting key from the upper front-left
 * models the brow, nose and lashes, a warm fill opens the shadow side, and a
 * cool rim from behind keeps the profile silhouette readable.
 */
export function StudioLighting() {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={0.5}>
        <color attach="background" args={['#23252b']} />
        {/* Large key softbox, upper front-left */}
        <Lightformer
          form="rect"
          intensity={5}
          color="#fff4e8"
          position={[-4, 4.5, 6]}
          scale={[7, 5, 1]}
          target={[0, 0, 0]}
        />
        {/* Fill panel, front-right */}
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#ffe9d6"
          position={[6, 0.5, 4]}
          scale={[5, 6, 1]}
          target={[0, 0, 0]}
        />
        {/* Rim strips behind */}
        <Lightformer
          form="rect"
          intensity={3}
          color="#dfe8ff"
          position={[5, 3, -6]}
          scale={[3, 7, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#dfe8ff"
          position={[-6, 2, -5]}
          scale={[2, 6, 1]}
          target={[0, 0, 0]}
        />
        {/* Warm bounce from below, as from a reflector at the chest */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#ffd9bf"
          position={[0, -6, 3]}
          scale={[9, 5, 1]}
          target={[0, 0, 0]}
        />
      </Environment>
      <directionalLight
        position={[-95, 200, 300]}
        intensity={2.5}
        color="#fff8f0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.3}
        shadow-radius={5}
        shadow-blurSamples={16}
      >
        <orthographicCamera attach="shadow-camera" args={[-115, 115, 125, -125, 100, 700]} />
      </directionalLight>
      <directionalLight position={[220, 30, 200]} intensity={0.3} color="#ffeee0" />
      <directionalLight position={[200, 90, -180]} intensity={1.1} color="#dbe6ff" />
    </>
  )
}
