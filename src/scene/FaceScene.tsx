import { HeadRoot } from './HeadRoot'
import { StudioLighting } from './StudioLighting'
import type { FaceId } from '../state/store'

export function FaceScene({ faceId }: { faceId: FaceId }) {
  return (
    <group>
      <StudioLighting />
      <HeadRoot faceId={faceId} />
    </group>
  )
}
