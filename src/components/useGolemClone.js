import { useMemo } from 'react'
import { useGraph } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

// Clone scene golem per pemakai. useGLTF meng-cache satu scene; tanpa clone, <primitive object={nodes.x} />
// di dua <Canvas> berebut parent yang sama (Object3D hanya boleh punya satu parent).
// Geometry & texture tetap dibagi bersama, hanya hierarki node yang diduplikasi.
export function useGolemClone(url = '/models/golem.glb') {
  const { scene, animations } = useGLTF(url)
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { nodes, materials } = useGraph(clone)
  return { nodes, materials, animations }
}
