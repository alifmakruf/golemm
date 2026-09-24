import { useRef, useMemo, useEffect } from 'react'
import { useGLTF, OrbitControls, PerspectiveCamera, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ================== Parameter Tuning: Animasi Keyframe Model Terrain ==================
// 1. Play sekali saat pertama buka web setelah fadeinup selesai
// 2. Masuk section 2/3 -> play dari awal sampai 2 detik / frame 20 lalu ditahan (hold)
// 3. Klik Back ke section 1 -> lanjutkan dari frame 20 sampai selesai
const TERRAIN_ANIM_SPEED = 1.0              // Kecepatan putar animasi model (1.0 = normal)
const TERRAIN_INITIAL_PLAY_DELAY_SEC = 2.4  // Jeda waktu (detik) setelah web dimuat baru animasi pertama kali diputar
const TERRAIN_S2_STOP_TIME_SEC = 2.0        // Titik berhenti (detik / frame 20) saat masuk Section 2 & 3

// ================== Parameter Tuning: Kamera & Transisi Antar Section ==================
// Posisi kamera Section 1 (Hero)
const TERRAIN_CAMERA_POSITION = [11.68, 2.92, -0.94]
const TERRAIN_ORBIT_TARGET = [-0.09, 1.18, -0.69]
const TERRAIN_CAMERA_FOV = 45

// Posisi kamera Section 2 (Zoom in ~1 koordinat, turun ~0.5 koordinat ke gunung)
const S2_CAMERA_ZOOM_STEP = [-2.0, -1.5, 0.02] // [dx, dy, dz] posisi kamera
const S2_CAMERA_POSITION = [
  TERRAIN_CAMERA_POSITION[0] + S2_CAMERA_ZOOM_STEP[0], // 9.68
  TERRAIN_CAMERA_POSITION[1] + S2_CAMERA_ZOOM_STEP[1], // 1.42
  TERRAIN_CAMERA_POSITION[2] + S2_CAMERA_ZOOM_STEP[2], // -0.92
]
// Rotasi / sudut pandang kamera Section 2 (menggeser titik fokus target lookAt [dx, dy, dz]):
const S2_CAMERA_TARGET_STEP = [0, 0, 4.2] // Sesuaikan [dx, dy, dz] untuk memutar arah hadap kamera di Section 2
const S2_CAMERA_TARGET = [
  TERRAIN_ORBIT_TARGET[0] + S2_CAMERA_TARGET_STEP[0],
  TERRAIN_ORBIT_TARGET[1] + S2_CAMERA_TARGET_STEP[1],
  TERRAIN_ORBIT_TARGET[2] + S2_CAMERA_TARGET_STEP[2],
]

// Posisi kamera Section 3 (Bergerak sedikit ke kiri dan sedikit maju mendekati tebing)
// Anda bisa menyesuaikan [dx, dy, dz] di bawah ini agar sudut kamera sesuai selera:
const S3_CAMERA_STEP = [-7.1, -0.6, 0.5] // [dx, dy, dz] posisi kamera
const S3_CAMERA_POSITION = [
  TERRAIN_CAMERA_POSITION[0] + S3_CAMERA_STEP[0],
  TERRAIN_CAMERA_POSITION[1] + S3_CAMERA_STEP[1],
  TERRAIN_CAMERA_POSITION[2] + S3_CAMERA_STEP[2],
]
// Rotasi / sudut pandang kamera Section 3 (menggeser titik fokus target lookAt [dx, dy, dz]):
const S3_CAMERA_TARGET_STEP = [0, 3, -1] // Sesuaikan [dx, dy, dz] untuk memutar arah hadap kamera di Section 3
const S3_CAMERA_TARGET = [
  TERRAIN_ORBIT_TARGET[0] + S3_CAMERA_TARGET_STEP[0],
  TERRAIN_ORBIT_TARGET[1] + S3_CAMERA_TARGET_STEP[1],
  TERRAIN_ORBIT_TARGET[2] + S3_CAMERA_TARGET_STEP[2],
]

const CAMERA_TRANSITION_SPEED = 1.8 // Kecepatan gerak kamera antar section (lerp)

// ================== Parameter Tuning: Langit & Animasi Naik ==================
export const SKY_COLOR = '#23272b'  // Warna langit abu di belakang gunung
const TERRAIN_SPAWN_Y = -3.2        // Posisi awal gunung di bawah (world unit)
const TERRAIN_ANIM_DURATION = 2.5   // Durasi naik gunung saat web dibuka (detik)

// ================== Parameter Tuning: Salju & Badai Angin ==================
const SNOW_COUNT = 700             // Jumlah partikel salju
const SNOW_AREA_X = 30              // Lebar sebaran salju
const SNOW_AREA_Y = 14              // Tinggi sebaran salju
const SNOW_AREA_Z = 16              // Kedalaman sebaran salju

// Kecepatan & arah angin per section:
const S1_SNOW_FALL_SPEED = 2.4      // Kecepatan jatuh di Hero (normal)
const S2_SNOW_FALL_SPEED = 4.4      // Kecepatan jatuh di Section 2 (deras & cepat)
const S3_SNOW_FALL_SPEED = 1.1      // Kecepatan jatuh di Section 3 (santai & perlahan)

const S1_SNOW_WIND_X = 0.4          // Angin sepoi di Hero
const S2_SNOW_WIND_X = -4.5         // Angin badai kencang ke kiri di Section 2
const S3_SNOW_WIND_X = -0.5         // Angin reda & tenang di Section 3

// Opacity partikel salju:
const SNOW_OPACITY = 0.85           // Opacity dasar partikel salju
const S1_SNOW_OPACITY = 0.85        // Hero
const S2_SNOW_OPACITY = 0.85        // Section 2
const S3_SNOW_OPACITY = 0.22        // Di Section 3 salju semakin sedikit & tipis

const SNOW_SIZE_MIN = 0.015         // Ukuran partikel min
const SNOW_SIZE_MAX = 0.045         // Ukuran partikel max
const SNOW_COLOR = '#e8f4f8'

// ================== Parameter Tuning: Kunang-Kunang / Debu Emas (Section 3) ==================
// Sesuai target.txt: Muncul kunang-kunang/debu emas bercahaya di Section 3
const FIREFLIES_COUNT = 85          // Jumlah partikel kunang-kunang (ringan & stabil 60 FPS)
const FIREFLIES_COLOR = '#fde047'   // Warna kuning emas berkilau
const FIREFLIES_SIZE = 0.09         // Ukuran partikel kunang-kunang
const FIREFLIES_SPEED = 0.35        // Kecepatan melayang debu emas

// ================== Parameter Tuning: Efek Visual & Performa ==================
const ENABLE_BLOOM = true           // Efek glow sinematik (ringan & hemat daya)
const BLOOM_INTENSITY = 0.55        // Kekuatan glow
const BLOOM_LUMINANCE_THRESHOLD = 0.1
const BLOOM_LUMINANCE_SMOOTHING = 1
const BLOOM_RADIUS = 0.5

const ENABLE_SSAO = false           // SSAO dimatikan agar enteng & 60 FPS di semua perangkat
const ENABLE_SNOW_ON_MOBILE = true  // Salju di HP

// Snow: Points geometry dengan simulasi angin dinamis per section
function SnowEffect({ activeSection = 1 }) {
  const tRef = useRef(0)
  const currentSpeed = useRef(S1_SNOW_FALL_SPEED)
  const currentWind = useRef(S1_SNOW_WIND_X)
  const currentOpacity = useRef(S1_SNOW_OPACITY)

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

    let targetSpeed = S1_SNOW_FALL_SPEED
    let targetWind = S1_SNOW_WIND_X
    let targetOpacity = S1_SNOW_OPACITY

    if (activeSection === 2) {
      targetSpeed = S2_SNOW_FALL_SPEED
      targetWind = S2_SNOW_WIND_X
      targetOpacity = S2_SNOW_OPACITY
    } else if (activeSection === 3) {
      targetSpeed = S3_SNOW_FALL_SPEED
      targetWind = S3_SNOW_WIND_X
      targetOpacity = S3_SNOW_OPACITY
    } else if (activeSection >= 4) {
      targetOpacity = 0 // Sembunyikan saat masuk website 2D
    }

    const lerpRate = 1 - Math.exp(-2.5 * delta)
    currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, lerpRate)
    currentWind.current = THREE.MathUtils.lerp(currentWind.current, targetWind, lerpRate)
    currentOpacity.current = THREE.MathUtils.lerp(currentOpacity.current, targetOpacity, lerpRate)
    mat.opacity = currentOpacity.current

    if (currentOpacity.current <= 0.02) return

    const pos = geo.attributes.position.array
    const yTop = SNOW_AREA_Y
    const yBottom = 0

    for (let i = 0; i < SNOW_COUNT; i++) {
      const idx = i * 3
      pos[idx + 1] -= currentSpeed.current * speeds[i] * delta
      pos[idx] += (currentWind.current + Math.sin(tRef.current * 1.2 + drifts[i]) * 0.4) * delta

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

// Fireflies / Debu Emas Bercahaya (Hanya di Section 3)
function FirefliesEffect({ activeSection = 1 }) {
  const pointsRef = useRef()
  const opacityRef = useRef(0)

  const { positions, speeds, phases } = useMemo(() => {
    const pos = new Float32Array(FIREFLIES_COUNT * 3)
    const spd = new Float32Array(FIREFLIES_COUNT)
    const phs = new Float32Array(FIREFLIES_COUNT)
    for (let i = 0; i < FIREFLIES_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18
      pos[i * 3 + 1] = Math.random() * 6 - 0.5
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12
      spd[i] = 0.6 + Math.random() * 0.8
      phs[i] = Math.random() * Math.PI * 2
    }
    return { positions: pos, speeds: spd, phases: phs }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  const mat = useMemo(() => new THREE.PointsMaterial({
    color: FIREFLIES_COLOR,
    size: FIREFLIES_SIZE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }), [])

  useFrame((state, delta) => {
    const targetOpacity = activeSection === 3 ? 0.95 : 0
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 1 - Math.exp(-2.5 * delta))
    mat.opacity = opacityRef.current

    if (opacityRef.current <= 0.01) return

    const t = state.clock.elapsedTime * FIREFLIES_SPEED
    const pos = geo.attributes.position.array

    for (let i = 0; i < FIREFLIES_COUNT; i++) {
      const idx = i * 3
      pos[idx + 1] += Math.sin(t * speeds[i] + phases[i]) * 0.007
      pos[idx] += Math.cos(t * 0.6 + phases[i]) * 0.004
    }
    geo.attributes.position.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geo} material={mat} />
}

// Model Terrain dengan animasi keyframe bawaan GLB & kontrol antar section
function TerrainModel({ scene, animations, activeSection = 1 }) {
  const groupRef = useRef()
  const progressRef = useRef(0)
  const prevSectionRef = useRef(activeSection)
  const hasPlayedInitialRef = useRef(false)
  const isHoldingAtS2Ref = useRef(false)

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

  // 2. Transisi Antar Section
  useEffect(() => {
    if (!actions || names.length === 0) return
    const mainAction = actions[names[0]]
    if (!mainAction) return

    mainAction.clampWhenFinished = true
    mainAction.setLoop(THREE.LoopOnce, 1)
    mainAction.timeScale = TERRAIN_ANIM_SPEED

    if ((activeSection === 2 || activeSection === 3) && prevSectionRef.current === 1) {
      // Masuk ke Section 2 atau 3 dari Hero: Putar animasi dari awal sampai 2 detik (frame 20) lalu tahan (hold)
      isHoldingAtS2Ref.current = false
      mainAction.reset()
      mainAction.paused = false
      mainAction.play()
    } else if (activeSection === 1 && prevSectionRef.current >= 2) {
      // Klik Back ke Section 1: Lanjutkan animasi dari frame 20 (2 detik) sampai selesai
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

    // Tahan animasi di Section 2 & 3 tepat saat mencapai TERRAIN_S2_STOP_TIME_SEC (frame 20 / 2 detik)
    if (activeSection >= 2 && !isHoldingAtS2Ref.current && actions && names.length > 0) {
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

// Controller Kamera yang mengatur pergerakan halus posisi dan rotasi antar Section (1, 2, 3)
function CameraController({ activeSection = 1 }) {
  const controlsRef = useRef()
  const currentPos = useRef(new THREE.Vector3(...TERRAIN_CAMERA_POSITION))
  const currentTarget = useRef(new THREE.Vector3(...TERRAIN_ORBIT_TARGET))

  useFrame((state, delta) => {
    let targetPos = TERRAIN_CAMERA_POSITION
    let targetLookAt = TERRAIN_ORBIT_TARGET

    if (activeSection === 2) {
      targetPos = S2_CAMERA_POSITION
      targetLookAt = S2_CAMERA_TARGET
    } else if (activeSection === 3) {
      targetPos = S3_CAMERA_POSITION
      targetLookAt = S3_CAMERA_TARGET
    }

    const lerpRate = 1 - Math.exp(-CAMERA_TRANSITION_SPEED * delta)
    currentPos.current.x = THREE.MathUtils.lerp(currentPos.current.x, targetPos[0], lerpRate)
    currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, targetPos[1], lerpRate)
    currentPos.current.z = THREE.MathUtils.lerp(currentPos.current.z, targetPos[2], lerpRate)

    currentTarget.current.x = THREE.MathUtils.lerp(currentTarget.current.x, targetLookAt[0], lerpRate)
    currentTarget.current.y = THREE.MathUtils.lerp(currentTarget.current.y, targetLookAt[1], lerpRate)
    currentTarget.current.z = THREE.MathUtils.lerp(currentTarget.current.z, targetLookAt[2], lerpRate)

    state.camera.position.copy(currentPos.current)

    if (controlsRef.current) {
      controlsRef.current.target.copy(currentTarget.current)
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
      enabled={activeSection === 1}
    />
  )
}

// Dynamic Atmospheric Lighting: Gelap & mistis di Section 3, terang di Section 1 & 2
function DynamicLighting({ activeSection = 1 }) {
  const ambRef = useRef()
  const dirRef = useRef()
  const hemiRef = useRef()
  const spotRef = useRef()

  useFrame((_, delta) => {
    const isDarkSection = activeSection === 3
    const targetAmb = isDarkSection ? 0.75 : 1.8
    const targetDir = isDarkSection ? 1.1 : 2.8
    const targetHemi = isDarkSection ? 0.6 : 1.5
    const targetSpot = isDarkSection ? 15 : 30
    const lerpRate = 1 - Math.exp(-2.2 * delta)

    if (ambRef.current) ambRef.current.intensity = THREE.MathUtils.lerp(ambRef.current.intensity, targetAmb, lerpRate)
    if (dirRef.current) dirRef.current.intensity = THREE.MathUtils.lerp(dirRef.current.intensity, targetDir, lerpRate)
    if (hemiRef.current) hemiRef.current.intensity = THREE.MathUtils.lerp(hemiRef.current.intensity, targetHemi, lerpRate)
    if (spotRef.current) spotRef.current.intensity = THREE.MathUtils.lerp(spotRef.current.intensity, targetSpot, lerpRate)
  })

  return (
    <>
      <ambientLight ref={ambRef} intensity={1.8} color="#8aa2be" />
      <hemisphereLight ref={hemiRef} skyColor="#b0e0ff" groundColor="#1e293b" intensity={1.5} />
      <directionalLight ref={dirRef} intensity={2.8} color="#fff4d0" position={[5.00, 6.00, 4.00]} />
      <spotLight
        ref={spotRef}
        intensity={30}
        color="#e8f4ff"
        position={[0.00, 4.00, -6.00]}
        angle={THREE.MathUtils.degToRad(89)}
        penumbra={0.2}
      />
      <directionalLight intensity={1.5} color="#8ec5fc" position={[-8, 3, 2]} />
    </>
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

      {/* Lighting dinamis: meredup gelap malam di Section 3 */}
      <DynamicLighting activeSection={activeSection} />

      {/* Gunung 3D dengan keyframe animasi */}
      <TerrainModel scene={scene} animations={animations} activeSection={activeSection} />

      {/* Hujan salju dinamis (berkurang drastis & angin tenang di Section 3) */}
      {shouldEnableSnow && <SnowEffect activeSection={activeSection} />}

      {/* Kunang-kunang / debu emas bercahaya di Section 3 */}
      <FirefliesEffect activeSection={activeSection} />

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
