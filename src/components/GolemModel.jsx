import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, Html } from '@react-three/drei'
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

// Info mesh untuk label di canvas
const MESH_LABELS = {
  kepalaatas: 'Kepala Atas',
  mulutbawah: 'Mulut Bawah',
  alis: 'Alis',
}

export default function GolemModel({
  mouse,
  modelScale,
  modelPosition,
  baseRotation,
  onModelClick,
  breakdownMode = false,
  breakdownDistance = 30,
  onMeshHover = null,
  hoveredMesh = null,
}) {
  const { camera } = useThree()
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
  const lastClickTime = useRef(0) // prevent double-click spam

  useEffect(() => {
    if (!actions) return
    const actionList = Object.values(actions).filter(Boolean)
    if (actionList.length === 0) return

    // Stop semua animations saat breakdown mode aktif
    if (breakdownMode) {
      actionList.forEach((act) => {
        act.stop()
        act.reset()
      })
      return
    }

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
  }, [actions, breakdownMode])

  // Handle click detection pada model
  useEffect(() => {
    const handlePointerDown = () => {
      const now = Date.now()
      if (now - lastClickTime.current < 300) return // debounce: max 1 click per 300ms
      lastClickTime.current = now

      if (!pivotRef.current || !mouse.current.active) return

      raycaster.current.setFromCamera(
        { x: mouse.current.x, y: -mouse.current.y },
        camera
      )

      pivotRef.current.updateWorldMatrix(true, true)
      const hits = raycaster.current.intersectObject(centeredRef.current, true)

      if (hits.length > 0 && onModelClick) {
        onModelClick()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [onModelClick, camera])

  // Setup line connectors untuk breakdown visualization
  const lineRef = useRef(null)

  useLayoutEffect(() => {
    if (!breakdownMode || !centeredRef.current) return

    // Create line connector antara mesh
    const positions = new Float32Array([
      0, 0.5, 0,  // kepala atas
      0, -0.3, 0, // mulut bawah
      0.2, 0, 0,  // alis
      0, 0.5, 0,  // kembali ke kepala
    ])

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      linewidth: 2,
      transparent: true,
      opacity: 0.6,
    })

    const line = new THREE.Line(geometry, material)
    lineRef.current = line
    centeredRef.current.add(line)

    return () => {
      if (centeredRef.current && lineRef.current) {
        centeredRef.current.remove(lineRef.current)
      }
    }
  }, [breakdownMode])

  const basePositions = useRef({ right: new THREE.Vector3(), left: new THREE.Vector3() })
  const currentRotation = useRef({ x: 0, y: 0 })
  const currentEyeOffset = useRef({ x: 0, y: 0 })
  // Simpan posisi asli GLB untuk reset saat keluar breakdown mode
  const meshBasePositions = useRef({ kepalaatas: new THREE.Vector3(), mulutbawah: new THREE.Vector3(), alis: new THREE.Vector3() })
  const wasBreakdown = useRef(false) // track transisi keluar breakdown

  // Mata kanan & kiri memakai material yang sama (Material.002).
  const eyeMaterial = useMemo(() => {
    const baseMat = materials?.['Material.002'] || (materials && Object.values(materials)[0])
    const mat = baseMat ? baseMat.clone() : new THREE.MeshStandardMaterial()
    mat.emissive = new THREE.Color(EYE_GLOW_COLOR)
    mat.emissiveIntensity = EYE_GLOW_INTENSITY
    mat.toneMapped = false
    return mat
  }, [materials])

  // Per-mesh stone materials — clone terpisah agar bisa highlight independen
  const stoneMats = useMemo(() => {
    const base = materials && Object.values(materials)[0]
    if (!base) return { kepalaatas: undefined, mulutbawah: undefined, alis: undefined }
    return {
      kepalaatas: base.clone(),
      mulutbawah: base.clone(),
      alis: base.clone(),
    }
  }, [materials])

  const highlightColor = useMemo(() => new THREE.Color('#1e90ff'), [])
  const noEmissive = useMemo(() => new THREE.Color(0, 0, 0), [])

  useEffect(() => {
    if (nodes?.matakanan) basePositions.current.right.copy(nodes.matakanan.position)
    if (nodes?.matakiri) basePositions.current.left.copy(nodes.matakiri.position)
    // Simpan posisi asli GLB untuk mesh batu
    if (nodes?.kepalaatas) meshBasePositions.current.kepalaatas.copy(nodes.kepalaatas.position)
    if (nodes?.mulutbawah) meshBasePositions.current.mulutbawah.copy(nodes.mulutbawah.position)
    if (nodes?.alis) meshBasePositions.current.alis.copy(nodes.alis.position)
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
    // Disable semua interaksi saat breakdown mode aktif
    if (breakdownMode) {
      wasBreakdown.current = true
      if (pivotRef.current && centeredRef.current) {
        pivotRef.current.position.set(modelPosition[0], modelPosition[1], modelPosition[2])
        pivotRef.current.scale.set(modelScale, modelScale, modelScale)
        pivotRef.current.rotation.set(baseRotation[0], baseRotation[1], baseRotation[2])

        // Apply breakdown positions ke setiap mesh dengan coordinate-based system
        // breakdownSeparation: 10-60px → convert ke coordinate (0.009-0.054)
        const coordinateDistance = (breakdownDistance / 100) * 0.09

        const kepalaatasMesh = centeredRef.current.getObjectByName('kepalaatas')
        if (kepalaatasMesh) {
          kepalaatasMesh.position.copy(meshBasePositions.current.kepalaatas)
          kepalaatasMesh.position.y += coordinateDistance * 0.5
        }
        const mulutbawahMesh = centeredRef.current.getObjectByName('mulutbawah')
        if (mulutbawahMesh) {
          mulutbawahMesh.position.copy(meshBasePositions.current.mulutbawah)
          mulutbawahMesh.position.y -= coordinateDistance * 0.5
        }
        const alisMesh = centeredRef.current.getObjectByName('alis')
        if (alisMesh) {
          alisMesh.position.copy(meshBasePositions.current.alis)
          alisMesh.position.x += coordinateDistance * 0.3
        }

        // Hover detection per-mesh saat breakdown
        if (onMeshHover && mouse.current.active) {
          raycaster.current.setFromCamera({ x: mouse.current.x, y: -mouse.current.y }, state.camera)
          pivotRef.current.updateWorldMatrix(true, true)
          const hits = raycaster.current.intersectObject(centeredRef.current, true)
          onMeshHover(hits.length > 0 ? hits[0].object.name : null)
        } else if (onMeshHover && !mouse.current.active) {
          onMeshHover(null)
        }

        // Update line connector positions
        if (lineRef.current) {
          const kp = kepalaatasMesh || centeredRef.current.getObjectByName('kepalaatas')
          const mb = mulutbawahMesh || centeredRef.current.getObjectByName('mulutbawah')
          const al = alisMesh || centeredRef.current.getObjectByName('alis')
          if (kp && mb && al) {
            const p = lineRef.current.geometry.attributes.position.array
            p[0] = kp.position.x; p[1] = kp.position.y; p[2] = kp.position.z
            p[3] = mb.position.x; p[4] = mb.position.y; p[5] = mb.position.z
            p[6] = al.position.x; p[7] = al.position.y; p[8] = al.position.z
            p[9] = kp.position.x; p[10] = kp.position.y; p[11] = kp.position.z
            lineRef.current.geometry.attributes.position.needsUpdate = true
          }
        }
      }

      // Highlight hovered mesh
      for (const [name, mat] of Object.entries(stoneMats)) {
        if (!mat) continue
        if (name === hoveredMesh) {
          mat.emissive.lerp(highlightColor, 1 - Math.exp(-8 * delta))
          mat.emissiveIntensity = 0.5
        } else {
          mat.emissive.lerp(noEmissive, 1 - Math.exp(-8 * delta))
          mat.emissiveIntensity = 0
        }
      }

      return
    }

    // Reset posisi mesh hanya sekali saat baru keluar dari breakdown mode
    // (tidak setiap frame — itu akan membunuh animasi dari AnimationMixer)
    if (wasBreakdown.current && centeredRef.current) {
      const kepalaatasMesh = centeredRef.current.getObjectByName('kepalaatas')
      if (kepalaatasMesh) kepalaatasMesh.position.copy(meshBasePositions.current.kepalaatas)
      const mulutbawahMesh = centeredRef.current.getObjectByName('mulutbawah')
      if (mulutbawahMesh) mulutbawahMesh.position.copy(meshBasePositions.current.mulutbawah)
      const alisMesh = centeredRef.current.getObjectByName('alis')
      if (alisMesh) alisMesh.position.copy(meshBasePositions.current.alis)
    }
    wasBreakdown.current = false

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
        <Part node={nodes.kepalaatas} material={stoneMats.kepalaatas}
          extraChildren={breakdownMode ? (
            <Html distanceFactor={3} center position={[0.14, 0.02, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`mesh-label ${hoveredMesh === 'kepalaatas' ? 'mesh-label--active' : ''}`}>Kepala Atas</div>
            </Html>
          ) : undefined}
        />
        <Part node={nodes.mulutbawah} material={stoneMats.mulutbawah}
          extraChildren={breakdownMode ? (
            <Html distanceFactor={3} center position={[0.14, -0.02, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`mesh-label ${hoveredMesh === 'mulutbawah' ? 'mesh-label--active' : ''}`}>Mulut Bawah</div>
            </Html>
          ) : undefined}
        />
        <Part node={nodes.alis} material={stoneMats.alis}
          extraChildren={breakdownMode ? (
            <Html distanceFactor={3} center position={[0.14, 0, 0]} style={{ pointerEvents: 'none' }}>
              <div className={`mesh-label ${hoveredMesh === 'alis' ? 'mesh-label--active' : ''}`}>Alis</div>
            </Html>
          ) : undefined}
        />

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
