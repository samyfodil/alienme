import { useMemo } from 'react'
import type { GroupProps } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'

type Props = { url: string; targetHeight?: number; groundY?: number; castShadow?: boolean } & Omit<GroupProps, 'ref'>

export function GLModel({ url, targetHeight = 2.6, groundY = -1.25, castShadow = true, ...props }: Props) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const root = skeletonClone(scene)
    root.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
        box.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld))
      }
    })
    if (box.isEmpty()) box.setFromObject(root)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const h = size.y || 1
    const s = targetHeight / h
    const wrap = new THREE.Group()
    root.scale.setScalar(s)
    root.position.set(-center.x * s, -box.min.y * s + groundY, -center.z * s)
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = castShadow
        o.frustumCulled = false
      }
    })
    wrap.add(root)
    return wrap
  }, [scene, targetHeight, groundY, castShadow])
  return <primitive object={obj} {...props} />
}
