/** Neutral studio lighting for the clay head: soft ambient dome, a key from
 *  the upper front-left, and a rim from behind-right so the profile
 *  silhouette stays readable. */
export function StudioLighting() {
  return (
    <>
      <hemisphereLight args={['#dfe5ec', '#4a4640', 0.9]} />
      <directionalLight position={[-160, 180, 260]} intensity={1.4} />
      <directionalLight position={[220, 60, -160]} intensity={0.5} />
    </>
  )
}
