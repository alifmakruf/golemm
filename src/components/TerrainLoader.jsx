import { useRef, useMemo, useEffect } from 'react'
import { useGLTF, OrbitControls, PerspectiveCamera, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useTerrainWaves } from './TerrainWaves.jsx'
import VolumetricClouds from './VolumetricClouds.jsx'
import TerrainFog from './TerrainFog.jsx'

// ================== Parameter Tuning: Animasi Keyframe Model Terrain ==================
// 1. Play sekali saat pertama buka web setelah fadeinup selesai
// 2. Masuk section 2/3 -> play dari awal sampai 2 detik / frame 20 lalu ditahan (hold)
// 3. Klik Back ke section 1 -> lanjutkan dari frame 20 sampai selesai
const TERRAIN_ANIM_SPEED = 1.0              // Kecepatan putar animasi model (1.0 = normal)
const TERRAIN_INITIAL_PLAY_DELAY_SEC = 2.4  // Jeda waktu (detik) setelah web dimuat baru animasi pertama kali diputar
const TERRAIN_S2_STOP_TIME_SEC = 2.0        // Titik berhenti (detik / frame 20) saat masuk Section 2 & 3

// ================== Parameter Tuning: Kamera & Transisi Antar Section ==================
// Posisi kamera Section 1 (Hero)
const TERRAIN_CAMERA_POSITION = [7.68, 2.92, -0.7]
const TERRAIN_ORBIT_TARGET = [-0.09, 2.18, -0.69]
const TERRAIN_CAMERA_FOV = 40

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
const S3_CAMERA_STEP = [-3.1, -0, 2.5] // [dx, dy, dz] posisi kamera
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

// Kecepatan gerak kamera antar section (lerp) — 2.6 agar kamera sampai tepat waktu saat kartu terbit
const CAMERA_TRANSITION_SPEED = 2.6

// ================== Parameter Tuning: Pencahayaan Terrain (Section 1, 2, 3) ==================
// Kecepatan transisi perubahan intensitas & warna cahaya saat berpindah section (lerp)
const LIGHT_TRANSITION_SPEED = 2.4

// Posisi sumber cahaya 3D di dunia [X, Y, Z]
const LIGHT_DIR_POS = [5.00, 6.00, 4.00]      // Arah datang cahaya utama matahari
const LIGHT_SPOT_POS = [0.00, 4.00, -6.00]    // Titik sorot lampu atas gunung
const LIGHT_FILL_POS = [-8.00, 3.00, 2.00]    // Cahaya isi/pantulan samping kiri

// --- PENCAHAYAAN SECTION 1 (Hero - Terang, Segar, Kontras Alami) ---
const S1_LIGHTING = {
  ambientIntensity: 1.,       // Terang cahaya lingkungan merata
  ambientColor: '#8aa2be',     // Warna ambient (biru abu sejuk)
  dirIntensity: .8,           // Kekuatan matahari utama
  dirColor: '#fff4d0',         // Warna matahari (kuning hangat lembut)
  hemiIntensity: .5,          // Cahaya kubah langit
  hemiSkyColor: '#b0e0ff',     // Warna langit atas
  hemiGroundColor: '#1e293b',  // Warna pantulan tanah/dasar
  spotIntensity: 30,           // Lampu sorot puncak
  spotColor: '#e8f4ff',        // Warna lampu sorot
  fillIntensity: .5,          // Lampu pengisi samping
  fillColor: '#8ec5fc',        // Warna pengisi samping
}

// --- PENCAHAYAAN SECTION 2 (Explore / Gunung Zoom - Tegas & Kontras) ---
const S2_LIGHTING = {
  ambientIntensity: .8,       // Terang cahaya lingkungan merata
  ambientColor: '#8aa2be',
  dirIntensity: .8,           // Kekuatan matahari utama
  dirColor: '#fff4d0',
  hemiIntensity: .5,          // Cahaya kubah langit
  hemiSkyColor: '#b0e0ff',
  hemiGroundColor: '#1e293b',
  spotIntensity: 30,           // Lampu sorot puncak
  spotColor: '#e8f4ff',
  fillIntensity: .5,          // Lampu pengisi samping
  fillColor: '#8ec5fc',
}

// --- PENCAHAYAAN SECTION 3 (Malam / Tebing - Gelap, Mistis, Sinar Bulan) ---
const S3_LIGHTING = {
  ambientIntensity: 0.75,      // Redup syahdu suasana malam
  ambientColor: '#4a607a',
  dirIntensity: 1.1,           // Sinar bulan redup
  dirColor: '#c5d8ea',
  hemiIntensity: 0.6,          // Langit malam pekat
  hemiSkyColor: '#4f729b',
  hemiGroundColor: '#0f172a',
  spotIntensity: 15,           // Sorot lembut
  spotColor: '#9ec4e8',
  fillIntensity: 0.8,          // Pengisi malam redup
  fillColor: '#4d7ea8',
}

// ================== Parameter Tuning: Langit & Animasi Naik ==================
// CATATAN PENTING: SKY_COLOR TIDAK lagi dipasang sebagai scene.background di Canvas.
// Sebelumnya <color attach="background"> membuat Canvas opaque (solid), sehingga
// apapun yang diletakkan di belakang Canvas (mis. headline text) akan selalu tertutup.
// Sekarang Canvas dibiarkan transparan (gl alpha:true, clearAlpha:0 - diatur di App.jsx),
// dan warna langit dipindahkan ke layer CSS terpisah (.app-sky-layer di App.jsx) yang
// berada di belakang headline text, dan headline text berada di belakang Canvas ini.
// SKY_COLOR tetap di-export supaya App.jsx bisa memakai warna yang sama persis.
export const SKY_COLOR = '#0c0c0fff'  // Warna langit abu di belakang gunung
const TERRAIN_SPAWN_Y = -3.2        // Posisi awal gunung di bawah (world unit)
const TERRAIN_OFFSET_Y = -0.6       // Posisi akhir (diam) gunung di sumbu Y. 0 = posisi asli, negatif = turun, positif = naik
const TERRAIN_ANIM_DURATION = 2.5   // Durasi naik gunung saat web dibuka (detik)

// ================== Parameter Tuning: Salju & Badai Angin ==================
const SNOW_COUNT = 200             // Jumlah partikel salju
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
const FIREFLIES_COLOR = '#01c4ff'   // Warna kuning emas berkilau
const FIREFLIES_SIZE = 0.09         // Ukuran partikel kunang-kunang
const FIREFLIES_SPEED = 0.35        // Kecepatan melayang debu emas

// ================== Parameter Tuning: Efek Visual & Performa ==================
const ENABLE_BLOOM = true           // Efek glow sinematik (ringan & hemat daya)
const BLOOM_INTENSITY = 0.7        // Kekuatan glow
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
  useTerrainWaves(groupRef, activeSection)

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
        groupRef.current.position.y = THREE.MathUtils.lerp(TERRAIN_SPAWN_Y, TERRAIN_OFFSET_Y, ease)
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

      {/* Kabut asap tipis yang mengalir mengelilingi terrain (parameter: FOG_CONFIG di TerrainFog.jsx).
          Dipasang di dalam group ini agar ikut naik saat animasi gunung muncul. */}
      <TerrainFog scene={scene} activeSection={activeSection} />
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

// Dynamic Atmospheric Lighting: lerp dinamis antar Section 1, 2, dan 3
function DynamicLighting({ activeSection = 1 }) {
  const ambRef = useRef()
  const dirRef = useRef()
  const hemiRef = useRef()
  const spotRef = useRef()
  const fillRef = useRef()

  // Target warna (dibuat sekali untuk mencegah GC spike / lag)
  const targetColors = useMemo(() => ({
    amb: new THREE.Color(),
    dir: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    spot: new THREE.Color(),
    fill: new THREE.Color(),
  }), [])

  useFrame((_, delta) => {
    // Ambil konfigurasi pencahayaan sesuai section aktif
    const cfg = activeSection === 3 ? S3_LIGHTING : activeSection === 2 ? S2_LIGHTING : S1_LIGHTING
    const lerpRate = 1 - Math.exp(-LIGHT_TRANSITION_SPEED * delta)

    if (ambRef.current) {
      ambRef.current.intensity = THREE.MathUtils.lerp(ambRef.current.intensity, cfg.ambientIntensity, lerpRate)
      targetColors.amb.set(cfg.ambientColor)
      ambRef.current.color.lerp(targetColors.amb, lerpRate)
    }
    if (dirRef.current) {
      dirRef.current.intensity = THREE.MathUtils.lerp(dirRef.current.intensity, cfg.dirIntensity, lerpRate)
      targetColors.dir.set(cfg.dirColor)
      dirRef.current.color.lerp(targetColors.dir, lerpRate)
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = THREE.MathUtils.lerp(hemiRef.current.intensity, cfg.hemiIntensity, lerpRate)
      targetColors.hemiSky.set(cfg.hemiSkyColor)
      targetColors.hemiGround.set(cfg.hemiGroundColor)
      hemiRef.current.color.lerp(targetColors.hemiSky, lerpRate)
      hemiRef.current.groundColor.lerp(targetColors.hemiGround, lerpRate)
    }
    if (spotRef.current) {
      spotRef.current.intensity = THREE.MathUtils.lerp(spotRef.current.intensity, cfg.spotIntensity, lerpRate)
      targetColors.spot.set(cfg.spotColor)
      spotRef.current.color.lerp(targetColors.spot, lerpRate)
    }
    if (fillRef.current) {
      fillRef.current.intensity = THREE.MathUtils.lerp(fillRef.current.intensity, cfg.fillIntensity, lerpRate)
      targetColors.fill.set(cfg.fillColor)
      fillRef.current.color.lerp(targetColors.fill, lerpRate)
    }
  })

  return (
    <>
      <ambientLight ref={ambRef} intensity={S1_LIGHTING.ambientIntensity} color={S1_LIGHTING.ambientColor} />
      <hemisphereLight ref={hemiRef} skyColor={S1_LIGHTING.hemiSkyColor} groundColor={S1_LIGHTING.hemiGroundColor} intensity={S1_LIGHTING.hemiIntensity} />
      <directionalLight ref={dirRef} intensity={S1_LIGHTING.dirIntensity} color={S1_LIGHTING.dirColor} position={LIGHT_DIR_POS} />
      <spotLight
        ref={spotRef}
        intensity={S1_LIGHTING.spotIntensity}
        color={S1_LIGHTING.spotColor}
        position={LIGHT_SPOT_POS}
        angle={THREE.MathUtils.degToRad(89)}
        penumbra={0.2}
      />
      <directionalLight ref={fillRef} intensity={S1_LIGHTING.fillIntensity} color={S1_LIGHTING.fillColor} position={LIGHT_FILL_POS} />
    </>
  )
}

export default function TerrainLoader({ activeSection = 1 }) {
  const { scene, animations } = useGLTF('/terrainmountain.glb')
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  const shouldEnableSnow = !isMobile || ENABLE_SNOW_ON_MOBILE

  return (
    <>
      {/* Background langit DIHAPUS dari sini (lihat catatan SKY_COLOR di atas).
          Canvas dibiarkan transparan agar headline text di layer CSS App.jsx
          bisa terlihat di balik gunung. */}

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

      {/* Awan Volumetrik 3D Realistis dengan Gaussian Blur di Langit */}
      <VolumetricClouds activeSection={activeSection} />

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