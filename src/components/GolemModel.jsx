import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

// ---- Tuning constants -------------------------------------------------
// Semua nilai di bawah ini boleh diubah sesuka hati.
// HEAD_MAX_ROTATION_DEG -> seberapa jauh kepala "menoleh" (dalam derajat).
//   Nilai kecil (5-8) terasa seperti gerakan ~10px yang diminta, karena ini
//   rotasi 3D, bukan pergeseran piksel DOM.
// EYE_MAX_OFFSET -> seberapa jauh bola mata bergeser dari posisi aslinya,
//   dalam satuan world-unit three.js. Rasio 2:1 terhadap kepala meniru
//   permintaan "kepala max 10px, mata max 20px".
// FOLLOW_DAMPING -> makin kecil, makin "lambat/halus" mengejar kursor.
const HEAD_MAX_ROTATION_DEG = 6
const EYE_MAX_OFFSET = 0.045
const FOLLOW_DAMPING = 4.5

// Warna nyala mata (tema: gua kristal, gelap ke oranye)
const EYE_GLOW_COLOR = '#0077ff'
const EYE_GLOW_INTENSITY = 10.55 // dibuat redup, bukan menyilaukan
const EYE_LIGHT_INTENSITY = 0.5

// Kontrol kecepatan & jeda animasi alis (shapekey)
const ANIMATION_SPEED = 0.8 // 1.0 = normal, 0.5 = 2x lebih lambat
const ANIMATION_DELAY_SEC = 4.5 // jeda istirahat antar pengulangan (dalam detik)

// ---- Parameter efek wireframe pemindai (scanner hover) ----------------
const WIREFRAME_ENABLED = true // matikan efek sepenuhnya dari sini
const WIREFRAME_COLOR = '#38bdf8' // warna garis wireframe (hex)
const WIREFRAME_MAX_OPACITY = 0.9 // opasitas maksimum saat terkena pindai (0-1)
const WIREFRAME_FADE_SPEED = 8 // makin besar, makin cepat muncul/menghilang
const WIREFRAME_SCAN_RADIUS = 0.55 // radius luas area pemindaian kursor di model
const WIREFRAME_SCAN_FEATHER = 0.25 // kehalusan gradasi tepi lingkaran pindai
const WIREFRAME_SCALE_OFFSET = 1.015 // sedikit membesar dari mesh asli, mencegah z-fighting
const WIREFRAME_INCLUDE_EYES = false // true = mata ikut dibungkus wireframe juga

const degToRad = (deg) => (deg * Math.PI) / 180

// Helper: pasang mesh dengan geometry + transform (posisi/rotasi/skala)
// ASLI dari node hasil export Blender. Ini penting -- setiap bagian golem
// (kepalaatas, alis, mulutbawah, mata) punya scale non-uniform sendiri2
// yang membentuk potongan "slab" batunya. Kalau transform ini tidak
// ditiru, semua bagian akan render di ukuran/posisi default (0,0,0) dan
// modelnya jadi tidak kelihatan / berantakan -- inilah penyebab golem
// sempat tidak muncul sama sekali.
function Part({ node, material, innerRef, extraChildren }) {
  if (!node) return null
  return (
    <mesh
      name={node.name}
      ref={innerRef}
      geometry={node.geometry}
      material={material || node.material}
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
      morphTargetDictionary={node.morphTargetDictionary}
      morphTargetInfluences={node.morphTargetInfluences}
      castShadow
      receiveShadow
    >
      {extraChildren}
    </mesh>
  )
}

// Overlay wireframe untuk satu bagian golem. Memakai geometry yang sama
// persis dengan Part aslinya (termasuk morph target alis, supaya wireframe
// ikut "berubah bentuk" saat animasi kedip/gerak jalan), tapi di-scale
// sedikit lebih besar (WIREFRAME_SCALE_OFFSET) supaya garisnya tidak
// tenggelam/z-fighting dengan permukaan solid batu di baliknya.
function WireframePart({ node, material, innerRef }) {
  if (!node) return null
  const scale = useMemo(
    () => new THREE.Vector3(
      node.scale.x * WIREFRAME_SCALE_OFFSET,
      node.scale.y * WIREFRAME_SCALE_OFFSET,
      node.scale.z * WIREFRAME_SCALE_OFFSET,
    ),
    [node],
  )
  return (
    <mesh
      ref={innerRef}
      geometry={node.geometry}
      material={material}
      position={node.position}
      rotation={node.rotation}
      scale={scale}
      morphTargetDictionary={node.morphTargetDictionary}
      morphTargetInfluences={node.morphTargetInfluences}
      renderOrder={1}
    />
  )
}

export default function GolemModel({
  mouse,
  modelScale,
  modelPosition,
  baseRotation,
}) {
  const { nodes, materials, animations } = useGLTF('/models/golem.glb')

  const pivotRef = useRef() // grup luar: yang berotasi (menoleh)
  const centeredRef = useRef() // grup dalam: kompensasi supaya golem berada di tengah pivot
  const eyeRightRef = useRef()
  const eyeLeftRef = useRef()

  const { actions } = useAnimations(animations, centeredRef)

  const uniformsRef = useRef({
    uHitPoint: { value: new THREE.Vector3(999, 999, 999) },
    uRadius: { value: WIREFRAME_SCAN_RADIUS },
    uFeather: { value: WIREFRAME_SCAN_FEATHER },
    uOpacity: { value: 0 },
  })

  // Material wireframe dengan custom shader pemindai lokal di sekitar kursor
  const wireframeMaterial = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: WIREFRAME_COLOR,
      wireframe: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHitPoint = uniformsRef.current.uHitPoint
      shader.uniforms.uRadius = uniformsRef.current.uRadius
      shader.uniforms.uFeather = uniformsRef.current.uFeather
      shader.uniforms.uOpacity = uniformsRef.current.uOpacity

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vScanWorldPos;`
      ).replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vScanWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uHitPoint;
         uniform float uRadius;
         uniform float uFeather;
         uniform float uOpacity;
         varying vec3 vScanWorldPos;`
      ).replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float scanDist = distance(vScanWorldPos, uHitPoint);
         float scanMask = smoothstep(uRadius, max(0.0, uRadius - uFeather), scanDist);
         gl_FragColor.a *= (scanMask * uOpacity);
         if (gl_FragColor.a < 0.005) discard;`
      )
    }

    return mat
  }, [])

  const raycaster = useRef(new THREE.Raycaster())
  const wireframeOpacity = useRef(0)

  useEffect(() => {
    if (!actions) return
    const actionList = Object.values(actions).filter(Boolean)
    if (actionList.length === 0) return

    actionList.forEach((act) => {
      act.timeScale = ANIMATION_SPEED
      act.setLoop(THREE.LoopOnce, 1)
      act.clampWhenFinished = true
      act.reset().play()
    })

    let timer
    const playWithDelay = () => {
      timer = setTimeout(() => {
        actionList.forEach((act) => act.reset().play())
      }, ANIMATION_DELAY_SEC * 1000)
    }

    const mixer = actionList[0].getMixer()
    const onFinished = (e) => {
      if (e.action === actionList[0]) {
        playWithDelay()
      }
    }

    mixer.addEventListener('finished', onFinished)
    return () => {
      clearTimeout(timer)
      mixer.removeEventListener('finished', onFinished)
    }
  }, [actions])

  const basePositions = useRef({ right: new THREE.Vector3(), left: new THREE.Vector3() })
  const currentRotation = useRef({ x: 0, y: 0 })
  const currentEyeOffset = useRef({ x: 0, y: 0 })

  // Mata kanan & kiri memakai material yang sama (Material.002).
  const eyeMaterial = useMemo(() => {
    const baseMat = materials?.['Material.002'] || (materials && Object.values(materials)[0])
    const mat = baseMat ? baseMat.clone() : new THREE.MeshStandardMaterial()
    mat.emissive = new THREE.Color(EYE_GLOW_COLOR)
    mat.emissiveIntensity = EYE_GLOW_INTENSITY
    mat.toneMapped = false
    return mat
  }, [materials])

  useEffect(() => {
    if (nodes?.matakanan) basePositions.current.right.copy(nodes.matakanan.position)
    if (nodes?.matakiri) basePositions.current.left.copy(nodes.matakiri.position)
  }, [nodes])

  // Pusatkan model: hitung bounding box lalu geser grup dalam supaya
  // titik tengah golem jatuh tepat di origin grup luar (pivot rotasi).
  useLayoutEffect(() => {
    if (!centeredRef.current || !pivotRef.current || !nodes?.kepalaatas) return
    centeredRef.current.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(centeredRef.current)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    centeredRef.current.position.set(-center.x, -center.y, -center.z)
  }, [nodes])

  useFrame((state, delta) => {
    const targetX = mouse.current.y * -degToRad(HEAD_MAX_ROTATION_DEG)
    const targetY = mouse.current.x * degToRad(HEAD_MAX_ROTATION_DEG)

    const t = 1 - Math.exp(-FOLLOW_DAMPING * delta)
    currentRotation.current.x += (targetX - currentRotation.current.x) * t
    currentRotation.current.y += (targetY - currentRotation.current.y) * t

    if (pivotRef.current) {
      pivotRef.current.position.set(modelPosition[0], modelPosition[1], modelPosition[2])
      pivotRef.current.scale.set(modelScale, modelScale, modelScale)
      pivotRef.current.rotation.x = baseRotation[0] + currentRotation.current.x
      pivotRef.current.rotation.y = baseRotation[1] + currentRotation.current.y
      pivotRef.current.rotation.z = baseRotation[2]
    }

    // Offset mata, dibatasi (clamp) supaya tidak melebihi EYE_MAX_OFFSET
    const rawX = mouse.current.x * EYE_MAX_OFFSET
    const rawY = mouse.current.y * -EYE_MAX_OFFSET
    const len = Math.hypot(rawX, rawY)
    const scale = len > EYE_MAX_OFFSET ? EYE_MAX_OFFSET / len : 1
    const targetEyeX = rawX * scale
    const targetEyeY = rawY * scale

    currentEyeOffset.current.x += (targetEyeX - currentEyeOffset.current.x) * t
    currentEyeOffset.current.y += (targetEyeY - currentEyeOffset.current.y) * t

    if (eyeRightRef.current) {
      eyeRightRef.current.position.x = basePositions.current.right.x + currentEyeOffset.current.x
      eyeRightRef.current.position.y = basePositions.current.right.y + currentEyeOffset.current.y
    }
    if (eyeLeftRef.current) {
      eyeLeftRef.current.position.x = basePositions.current.left.x + currentEyeOffset.current.x
      eyeLeftRef.current.position.y = basePositions.current.left.y + currentEyeOffset.current.y
    }

    // Napas nyala mata yang sangat halus, tetap redup
    const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.08
    eyeMaterial.emissiveIntensity = EYE_GLOW_INTENSITY * breathe

    // ---- Deteksi hover & pemindai wireframe lokal --------------------
    if (WIREFRAME_ENABLED && pivotRef.current && centeredRef.current) {
      let isHovering = false

      if (mouse.current.active) {
        raycaster.current.setFromCamera(
          { x: mouse.current.x, y: -mouse.current.y },
          state.camera,
        )
        pivotRef.current.updateWorldMatrix(true, true)
        const hits = raycaster.current.intersectObject(centeredRef.current, true)
        if (hits.length > 0) {
          isHovering = true
          // Lerp titik pusat pindai agar pergerakan wireframe mengikuti kursor sangat mulus
          uniformsRef.current.uHitPoint.value.lerp(hits[0].point, 1 - Math.exp(-20 * delta))
        }
      }

      const targetOpacity = isHovering ? WIREFRAME_MAX_OPACITY : 0
      wireframeOpacity.current += (targetOpacity - wireframeOpacity.current) * (1 - Math.exp(-WIREFRAME_FADE_SPEED * delta))
      uniformsRef.current.uOpacity.value = wireframeOpacity.current
      wireframeMaterial.visible = wireframeOpacity.current > 0.01
    }
  })

  return (
    <group ref={pivotRef}>
      <group ref={centeredRef}>
        <Part node={nodes.kepalaatas} material={materials.batu} />
        <Part node={nodes.mulutbawah} material={materials.batu} />
        <Part node={nodes.alis} material={materials.batu} />

        <Part
          node={nodes.matakanan}
          material={eyeMaterial}
          innerRef={eyeRightRef}
          extraChildren={
            <pointLight color={EYE_GLOW_COLOR} intensity={EYE_LIGHT_INTENSITY} distance={0.6} decay={2} />
          }
        />
        <Part
          node={nodes.matakiri}
          material={eyeMaterial}
          innerRef={eyeLeftRef}
          extraChildren={
            <pointLight color={EYE_GLOW_COLOR} intensity={EYE_LIGHT_INTENSITY} distance={0.6} decay={2} />
          }
        />

        {WIREFRAME_ENABLED && (
          <>
            <WireframePart node={nodes.kepalaatas} material={wireframeMaterial} />
            <WireframePart node={nodes.mulutbawah} material={wireframeMaterial} />
            <WireframePart node={nodes.alis} material={wireframeMaterial} />
            {WIREFRAME_INCLUDE_EYES && (
              <>
                <WireframePart node={nodes.matakanan} material={wireframeMaterial} />
                <WireframePart node={nodes.matakiri} material={wireframeMaterial} />
              </>
            )}
          </>
        )}
      </group>
    </group>
  )
}

useGLTF.preload('/models/golem.glb')
