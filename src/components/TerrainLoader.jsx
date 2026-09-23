import { useRef, useMemo } from 'react'
import { useGLTF, OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, SSAO } from '@react-three/postprocessing'
import * as THREE from 'three'

// ---- Tuning: Camera & Orbit ----
const TERRAIN_CAMERA_POSITION = [11.68, 2.92, -0.94]
const TERRAIN_ORBIT_TARGET = [-0.09, 1.18, -0.69]
const TERRAIN_CAMERA_FOV = 45

// ---- Tuning: Sky ----
export const SKY_COLOR = '#23272b'  // warna langit abu di belakang gunung

// ---- Tuning: Animasi Naik Terrain 3D (fade in up hanya untuk gunung 3D) ----
const TERRAIN_SPAWN_Y = -3.2        // posisi awal gunung di bawah (world unit)
const TERRAIN_ANIM_DURATION = 2.5   // durasi naik (detik)

// ---- Tuning: Bloom (ray tracing glow) ----
const BLOOM_INTENSITY = 1   // kekuatan glow (0 = mati, 2+ = sangat terang)
const BLOOM_LUMINANCE_THRESHOLD = 0.1  // threshold brightness agar bloom (0=semua, 1=hanya putih)
const BLOOM_LUMINANCE_SMOOTHING = 1   // transisi halus di threshold
const BLOOM_RADIUS = 0.5   // jangkauan blur bloom

// ---- Tuning: SSAO (ambient occlusion - sudut gelap) ----
const SSAO_INTENSITY = 30    // kedalaman shadow AO
const SSAO_RADIUS = 0.3  // jangkauan AO
const SSAO_BIAS = 0.325 // bias untuk mengurangi shadow acne


// ---- Tuning: Snow ----
const SNOW_COUNT = 1800   // jumlah partikel
const SNOW_AREA_X = 30     // lebar area (world unit)
const SNOW_AREA_Y = 14     // tinggi area
const SNOW_AREA_Z = 16     // kedalaman area
const SNOW_FALL_SPEED = 2.4    // kecepatan jatuh (unit/detik)
const SNOW_DRIFT_X = 0.4    // goyang horizontal max
const SNOW_SIZE_MIN = 0.015  // ukuran partikel min
const SNOW_SIZE_MAX = 0.045  // ukuran partikel max
const SNOW_COLOR = '#e8f4f8'
const SNOW_OPACITY = 0.82


// Snow: Points geometry, partikel jatuh dan wrap
function SnowEffect() {
  const tRef = useRef(0)

  const { positions, speeds, drifts } = useMemo(() => {
    const positions = new Float32Array(SNOW_COUNT * 3)
    const speeds = new Float32Array(SNOW_COUNT)
    const drifts = new Float32Array(SNOW_COUNT)
    for (let i = 0; i < SNOW_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SNOW_AREA_X
      positions[i * 3 + 1] = (Math.random() - 0.5) * SNOW_AREA_Y + SNOW_AREA_Y / 2
      positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW_AREA_Z
      speeds[i] = 0.6 + Math.random() * 0.8
      drifts[i] = (Math.random() - 0.5) * 2
    }
    return { positions, speeds, drifts }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  const mat = useMemo(() => new THREE.PointsMaterial({
    color: SNOW_COLOR,
    size: (SNOW_SIZE_MIN + SNOW_SIZE_MAX) / 2,
    transparent: true,
    opacity: SNOW_OPACITY,
    sizeAttenuation: true,
    depthWrite: false,
  }), [])

  useFrame((_, delta) => {
    tRef.current += delta
    const pos = geo.attributes.position.array
    const yTop = SNOW_AREA_Y
    const yBottom = 0
    for (let i = 0; i < SNOW_COUNT; i++) {
      const idx = i * 3
      pos[idx + 1] -= SNOW_FALL_SPEED * speeds[i] * delta
      pos[idx] += Math.sin(tRef.current * 0.8 + drifts[i]) * SNOW_DRIFT_X * delta
      if (pos[idx + 1] < yBottom) {
        pos[idx] = (Math.random() - 0.5) * SNOW_AREA_X
        pos[idx + 1] = yTop
        pos[idx + 2] = (Math.random() - 0.5) * SNOW_AREA_Z
      }
    }
    geo.attributes.position.needsUpdate = true
  })

  return <points geometry={geo} material={mat} />
}

// Model Terrain dengan animasi naik sendiri di dalam 3D scene (sky tetap diam)
function TerrainModel({ scene }) {
  const groupRef = useRef()
  const progressRef = useRef(0)

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta / TERRAIN_ANIM_DURATION)
      // Ease-out cubic: 1 - pow(1 - t, 3)
      const ease = 1 - Math.pow(1 - progressRef.current, 3)
      if (groupRef.current) {
        groupRef.current.position.y = THREE.MathUtils.lerp(TERRAIN_SPAWN_Y, 0, ease)
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, TERRAIN_SPAWN_Y, 0]}>
      <primitive object={scene} />
    </group>
  )
}

export default function TerrainLoader() {
  const { scene } = useGLTF('/terrainmountain.glb')

  return (
    <>
      {/* Background langit statis (sama dengan index.css var(--bg-void)) */}
      <color attach="background" args={[SKY_COLOR]} />

      <PerspectiveCamera makeDefault position={TERRAIN_CAMERA_POSITION} fov={TERRAIN_CAMERA_FOV} near={0.1} far={1000} />

      <OrbitControls
        target={TERRAIN_ORBIT_TARGET}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.5}
        maxDistance={40.0}
        minPolarAngle={THREE.MathUtils.degToRad(0)}
        maxPolarAngle={THREE.MathUtils.degToRad(180)}
        enablePan={true}
      />

      <ambientLight intensity={3.00} color="#5f5f5f" />
      <directionalLight intensity={2.5} color="#fff4e0" position={[5.00, 6.00, 4.00]} castShadow />
      <spotLight intensity={60} color="#e8f4ff" position={[0.00, 4.00, -6.00]} angle={THREE.MathUtils.degToRad(89)} penumbra={0.15} />
      <directionalLight intensity={1.8} color="#a8d8ff" position={[-8, 3, 2]} />

      <Environment preset="studio" background={false} blur={0.00} />

      {/* Hanya terrain 3D yang naik dari bawah */}
      <TerrainModel scene={scene} />

      {/* Hujan salju */}
      <SnowEffect />

      {/* Ray tracing feel: Bloom + SSAO */}
      <EffectComposer>
        <Bloom
          intensity={BLOOM_INTENSITY}
          luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
          luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
          radius={BLOOM_RADIUS}
        />
        <SSAO
          intensity={SSAO_INTENSITY}
          radius={SSAO_RADIUS}
          bias={SSAO_BIAS}
        />
      </EffectComposer>
    </>
  )
}
