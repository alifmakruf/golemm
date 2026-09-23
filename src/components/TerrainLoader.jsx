import { useRef, useMemo, useEffect } from 'react'
import { useGLTF, OrbitControls, PerspectiveCamera, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, SSAO } from '@react-three/postprocessing'
import * as THREE from 'three'

// ================== Parameter Tuning: Animasi Keyframe Model Terrain ==================
// Sesuai permintaan:
// 1. Play sekali saat pertama buka web setelah fadeinup selesai
// 2. Masuk section 2 -> play dari awal sampai 2 detik / frame 20
// 3. Klik Back -> lanjutkan dari frame 20 sampai selesai
const TERRAIN_ANIM_SPEED = 1.0              // Kecepatan putar animasi model (1.0 = normal)
const TERRAIN_INITIAL_PLAY_DELAY_SEC = 2.4  // Jeda waktu (detik) setelah web dimuat / fadeinup baru animasi pertama kali diputar
const TERRAIN_S2_STOP_TIME_SEC = 2.0        // Titik berhenti (detik / frame 20) saat masuk Section 2

// ================== Parameter Tuning: Kamera & Orbit ==================
// Posisi kamera awal (Section 1 - Hero)
const TERRAIN_CAMERA_POSITION = [11.68, 2.92, -0.94]
const TERRAIN_ORBIT_TARGET = [-0.09, 1.18, -0.69]
const TERRAIN_CAMERA_FOV = 45

// ---- Parameter Tuning: Transisi Zoom Kamera Section 2 ----
// Sesuai target.txt: Zoom in ke gunung ~1 langkah koordinat dan sedikit ke bawah ~0.5 langkah koordinat
const S2_CAMERA_ZOOM_STEP = [-2.0, -1.5, 0.02] // [dx, dy, dz]
const S2_CAMERA_POSITION = [
  TERRAIN_CAMERA_POSITION[0] + S2_CAMERA_ZOOM_STEP[0], // 10.68
  TERRAIN_CAMERA_POSITION[1] + S2_CAMERA_ZOOM_STEP[1], // 2.42
  TERRAIN_CAMERA_POSITION[2] + S2_CAMERA_ZOOM_STEP[2], // -0.92
]
const CAMERA_TRANSITION_SPEED = 3 // Kecepatan gerak kamera antar section (lerp)

// ================== Parameter Tuning: Langit & Animasi Naik ==================
export const SKY_COLOR = '#23272b'  // Warna langit abu di belakang gunung
const TERRAIN_SPAWN_Y = -3.2        // Posisi awal gunung di bawah (world unit)
const TERRAIN_ANIM_DURATION = 2.5   // Durasi naik gunung saat web dibuka (detik)

// ================== Parameter Tuning: Salju & Badai Angin ==================
const SNOW_COUNT = 1800             // Jumlah partikel salju
const SNOW_AREA_X = 30              // Lebar sebaran salju
const SNOW_AREA_Y = 14              // Tinggi sebaran salju
const SNOW_AREA_Z = 16              // Kedalaman sebaran salju
const S1_SNOW_FALL_SPEED = 2.4      // Kecepatan jatuh di Hero (normal)
const S2_SNOW_FALL_SPEED = 6.4      // Kecepatan jatuh di Section 2 (deras & cepat)
const S1_SNOW_WIND_X = 0.4          // Kecepatan angin horizontal di Hero
const S2_SNOW_WIND_X = -3.5         // Kecepatan angin badai horizontal di Section 2 (ke kiri)
const SNOW_SIZE_MIN = 0.015         // Ukuran partikel min
const SNOW_SIZE_MAX = 0.045         // Ukuran partikel max
const SNOW_COLOR = '#e8f4f8'
const SNOW_OPACITY = 0.85

// ================== Parameter Tuning: Efek Visual & Performa ==================
const ENABLE_BLOOM = true           // Efek glow sinematik (ringan & wajib ada)
const BLOOM_INTENSITY = 0.5         // Kekuatan glow
const BLOOM_LUMINANCE_THRESHOLD = 0.1
const BLOOM_LUMINANCE_SMOOTHING = 1
const BLOOM_RADIUS = 0.5

const ENABLE_SSAO = false           // SSAO dimatikan agar enteng & 60 FPS di semua perangkat
const ENABLE_SNOW_ON_MOBILE = true  // Salju di HP

// Snow: Points geometry dengan simulasi badai angin kencang dinamis
function SnowEffect({ activeSection = 1 }) {
  const tRef = useRef(0)
  const currentSpeed = useRef(S1_SNOW_FALL_SPEED)
  const currentWind = useRef(S1_SNOW_WIND_X)

  const { positions, speeds, drifts } = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3)
    const spd = new Float32Array(SNOW_COUNT)
    const drf = new Float32Array(SNOW_COUNT)
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SNOW_AREA_X
      pos[i * 3 + 1] = (Math.random() - 0.5) * SNOW_AREA_Y + SNOW_AREA_Y / 2
      pos[i * 3 + 2] = (Math.random() - 0.5) * SNOW_AREA_Z
      spd[i] = 0.6 + Math.random() * 0.8
      drf[i] = (Math.random() - 0.5) * 2
    }
    return { positions: pos, speeds: spd, drifts: drf }
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

    // Smooth lerp kecepatan & angin saat transisi section
    const targetSpeed = activeSection === 2 ? S2_SNOW_FALL_SPEED : S1_SNOW_FALL_SPEED
    const targetWind = activeSection === 2 ? S2_SNOW_WIND_X : S1_SNOW_WIND_X
    const lerpRate = 1 - Math.exp(-2.5 * delta)

    currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, lerpRate)
    currentWind.current = THREE.MathUtils.lerp(currentWind.current, targetWind, lerpRate)

    const pos = geo.attributes.position.array
    const yTop = SNOW_AREA_Y
    const yBottom = 0

    for (let i = 0; i < SNOW_COUNT; i++) {
      const idx = i * 3
      pos[idx + 1] -= currentSpeed.current * speeds[i] * delta
      pos[idx] += (currentWind.current + Math.sin(tRef.current * 1.2 + drifts[i]) * 0.4) * delta

      // Wrap partikel saat keluar batas bawah atau samping (terbawa angin)
      if (pos[idx + 1] < yBottom || pos[idx] < -SNOW_AREA_X / 2) {
        pos[idx] = (Math.random() * 0.7) * SNOW_AREA_X
        pos[idx + 1] = yTop
        pos[idx + 2] = (Math.random() - 0.5) * SNOW_AREA_Z
      }
    }
    geo.attributes.position.needsUpdate = true
  })

  return <points geometry={geo} material={mat} />
}

// Model Terrain dengan animasi keyframe bawaan GLB & kontrol antar section
function TerrainModel({ scene, animations, activeSection = 1 }) {
  const groupRef = useRef()
  const progressRef = useRef(0)
  const prevSectionRef = useRef(activeSection)
  const hasPlayedInitialRef = useRef(false)
  const isHoldingAtS2Ref = useRef(false)

  // Ambil actions dari animasi model 3D
  const { actions, names } = useAnimations(animations, groupRef)

  // 1. Initial Load: Putar animasi sekali di awal setelah delay fadeinup selesai
  useEffect(() => {
    if (!actions || names.length === 0) return
    const mainAction = actions[names[0]]
    if (!mainAction) return

    mainAction.clampWhenFinished = true
    mainAction.setLoop(THREE.LoopOnce, 1)
    mainAction.timeScale = TERRAIN_ANIM_SPEED

    const timer = setTimeout(() => {
      if (!hasPlayedInitialRef.current && activeSection === 1) {
        hasPlayedInitialRef.current = true
        mainAction.reset().play()
      }
    }, TERRAIN_INITIAL_PLAY_DELAY_SEC * 1000)

    return () => clearTimeout(timer)
  }, [actions, names, activeSection])

  // 2. Transisi Section 1 <-> Section 2
  useEffect(() => {
    if (!actions || names.length === 0) return
    const mainAction = actions[names[0]]
    if (!mainAction) return

    mainAction.clampWhenFinished = true
    mainAction.setLoop(THREE.LoopOnce, 1)
    mainAction.timeScale = TERRAIN_ANIM_SPEED

    if (activeSection === 2 && prevSectionRef.current === 1) {
      // Masuk ke Section 2: Putar animasi dari awal sampai 2 detik (frame 20) lalu tahan (hold)
      isHoldingAtS2Ref.current = false
      mainAction.reset()
      mainAction.paused = false
      mainAction.play()
    } else if (activeSection === 1 && prevSectionRef.current === 2) {
      // Klik Back: Lanjutkan animasi dari frame 20 (2 detik) sampai selesai
      isHoldingAtS2Ref.current = false
      mainAction.paused = false
      mainAction.play()
    }

    prevSectionRef.current = activeSection
  }, [activeSection, actions, names])

  useFrame((_, delta) => {
    // Animasi naik gunung fisik saat web pertama dimuat
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta / TERRAIN_ANIM_DURATION)
      const ease = 1 - Math.pow(1 - progressRef.current, 3)
      if (groupRef.current) {
        groupRef.current.position.y = THREE.MathUtils.lerp(TERRAIN_SPAWN_Y, 0, ease)
      }
    }

    // Tahan animasi di Section 2 tepat saat mencapai TERRAIN_S2_STOP_TIME_SEC (frame 20 / 2 detik)
    if (activeSection === 2 && !isHoldingAtS2Ref.current && actions && names.length > 0) {
      const mainAction = actions[names[0]]
      if (mainAction && mainAction.time >= TERRAIN_S2_STOP_TIME_SEC) {
        mainAction.time = TERRAIN_S2_STOP_TIME_SEC
        mainAction.paused = true
        isHoldingAtS2Ref.current = true
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, TERRAIN_SPAWN_Y, 0]}>
      <primitive object={scene} />
    </group>
  )
}

// Controller Kamera yang mengatur zoom halus antara Section 1 dan Section 2
function CameraController({ activeSection = 1 }) {
  const controlsRef = useRef()
  const currentPos = useRef(new THREE.Vector3(...TERRAIN_CAMERA_POSITION))

  useFrame((state, delta) => {
    const targetPos = activeSection === 2 ? S2_CAMERA_POSITION : TERRAIN_CAMERA_POSITION
    const lerpRate = 1 - Math.exp(-CAMERA_TRANSITION_SPEED * delta)

    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, targetPos[0], lerpRate)
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, targetPos[1], lerpRate)
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, targetPos[2], lerpRate)

    state.camera.position.copy(currentPos.current)

    if (controlsRef.current) {
      controlsRef.current.target.set(TERRAIN_ORBIT_TARGET[0], TERRAIN_ORBIT_TARGET[1], TERRAIN_ORBIT_TARGET[2])
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      target={TERRAIN_ORBIT_TARGET}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.5}
      maxDistance={40.0}
      minPolarAngle={THREE.MathUtils.degToRad(0)}
      maxPolarAngle={THREE.MathUtils.degToRad(180)}
      enablePan={activeSection === 1}
      enabled={activeSection === 1} // Saat di Section 2, kamera terkunci sinematik zoom in
    />
  )
}

export default function TerrainLoader({ activeSection = 1 }) {
  const { scene, animations } = useGLTF('/terrainmountain.glb')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  const shouldEnableSnow = !isMobile || ENABLE_SNOW_ON_MOBILE

  return (
    <>
      {/* Background langit statis */}
      <color attach="background" args={[SKY_COLOR]} />

      <PerspectiveCamera
        makeDefault
        position={TERRAIN_CAMERA_POSITION}
        fov={TERRAIN_CAMERA_FOV}
        near={0.1}
        far={1000}
      />

      {/* Controller kamera halus */}
      <CameraController activeSection={activeSection} />

      {/* Lighting sinematik gunung */}
      <ambientLight intensity={1.8} color="#8aa2be" />
      <hemisphereLight skyColor="#b0e0ff" groundColor="#1e293b" intensity={1.5} />
      <directionalLight intensity={2.8} color="#fff4d0" position={[5.00, 6.00, 4.00]} />
      <spotLight
        intensity={30}
        color="#e8f4ff"
        position={[0.00, 4.00, -6.00]}
        angle={THREE.MathUtils.degToRad(89)}
        penumbra={0.2}
      />
      <directionalLight intensity={1.5} color="#8ec5fc" position={[-8, 3, 2]} />

      {/* Gunung 3D dengan keyframe animasi */}
      <TerrainModel scene={scene} animations={animations} activeSection={activeSection} />

      {/* Hujan salju dinamis (kecepatan & angin mengikuti activeSection) */}
      {shouldEnableSnow && <SnowEffect activeSection={activeSection} />}

      {/* Ray tracing Bloom: super ringan dengan multisampling 0 */}
      {ENABLE_BLOOM && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={BLOOM_INTENSITY}
            luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
            luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
            radius={BLOOM_RADIUS}
          />
        </EffectComposer>
      )}
    </>
  )
}
