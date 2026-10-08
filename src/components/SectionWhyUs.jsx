import { Suspense, useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, MeshReflectorMaterial, useAnimations } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import TechText from './TechText'
import { useModelWaves } from './TerrainWaves.jsx'
import './style/SectionWhyUs.css'

// ================== Parameter Tuning: Section 3.5 (Kenapa Kami?) ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// --- Model Golem (Content 0) ---
// Golem di-FIT otomatis ke ukuran target dan dipusatkan.
const GOLEM_TARGET_SIZE = 1.7              // Ukuran sisi terpanjang golem di desktop (world unit)
const GOLEM_TARGET_SIZE_MOBILE = 1.4       // Ukuran di HP/tablet
const GOLEM_SCALE = 1.0                    // Pengali tambahan di atas auto-fit (1 = pas, 1.2 = 20% lebih besar)

// --- Posisi Vertikal Golem Head (Content 0) ---
// 0.0 = pas tepat di tengah vertikal pandangan kamera (CAMERA_LOOK_Y = 0.85).
// Ubah nilai ini jika ingin menggeser: positif = naik, negatif = turun.
const GOLEM_HEAD_VERTICAL_OFFSET = 0.0     // Offset vertikal dari tengah kamera (world unit)
const GOLEM_FLOAT_CLEARANCE = 0.55         // Jarak tepi bawah golem ke lantai kaca (world unit)
const GOLEM_BOB_AMPLITUDE = 0.2           // Jarak naik-turun mengambang
const GOLEM_BOB_SPEED = 0.9                // Kecepatan mengambang
const GOLEM_PLAY_ANIMATION = true          // Mainkan animasi ekspresi alis & mulut golem dari GLB
const GOLEM_ANIM_SPEED = 0.8               // Kecepatan animasi kepala golem

// --- Animasi Gelombang (Wave Animation seperti TerrainWaves) ---
const GOLEM_WAVE_ENABLED = true            // Aktifkan animasi ombak wireframe pada model golem & tangan
const GOLEM_WAVE_COLOR = '#67e8f9'         // Warna wireframe ombak golem
const GOLEM_WAVE_AUTO_PULSE = false        // false = gelombang muncul saat diklik (tidak menutupi model terus-menerus)
const GOLEMHAND_WAVE_COLOR = '#67e8f9'     // Warna wireframe ombak tangan
const GOLEMHAND_WAVE_AUTO_PULSE = false    // false = gelombang muncul saat diklik

// Rotasi dasar golem: serong kanan (Y positif) + serong atas (X negatif) = melamun menatap langit
const GOLEM_ROTATION_X = -0.4              // Serong atas (negatif = mendongak, radian)
const GOLEM_ROTATION_Y = 0.35              // Serong kanan (positif = menoleh kanan, radian)
const GOLEM_ROTATION_Z = 0                 // Tidak ada roll
const GOLEM_SWAY_YAW = 0                // Ayunan menoleh kiri-kanan pelan (radian). 0 = diam menghadap tetap
const GOLEM_SWAY_SPEED = 0.65              // Kecepatan ayunan menoleh

// --- Orbit Batu (Putaran Horisontal Batu Mengambang) ---
const TURNTABLE_SPEED = 0.22               // Kecepatan batu mengorbit golem (radian/detik)

// --- Batu/Meteorit Mengambang (PLACEHOLDER — model belum dibuat di Blender) ---
// Sementara memakai dodecahedron flat-shaded. Ganti ke useGLTF saat model siap.
const ROCKS_ENABLED = true                 // Aktifkan/matikan batu placeholder
const ROCK_COUNT = 9                       // Jumlah batu mengambang
const ROCK_RADIUS_MIN = 2.7                // Jarak orbit terdekat dari golem
const ROCK_RADIUS_MAX = 6.9                // Jarak orbit terjauh dari golem
const ROCK_Y_MIN = 0.7                     // Tinggi terendah batu dari lantai
const ROCK_Y_MAX = 3.3                     // Tinggi tertinggi batu dari lantai
const ROCK_SIZE_MIN = 0.09                 // Ukuran terkecil batu
const ROCK_SIZE_MAX = 0.3                  // Ukuran terbesar batu
const ROCK_FLOAT_SPEED = 0.6               // Kecepatan batu naik-turun mengambang
const ROCK_FLOAT_AMPLITUDE = 0.22          // Jarak mengambang naik-turun (world unit)
const ROCK_COLOR = '#15171b'               // Warna batu placeholder
const ROCK_EMISSIVE = '#0a2a44'            // Cahaya samar dari dalam batu (biru kristal)

// --- Lantai Kaca Gelap Reflektif (MeshReflectorMaterial) ---
// Lantai = bidang kaca obsidian yang MEMANTULKAN golem, batu & cahaya, ditambah panggung kaca
// (platform) berbingkai cahaya tepat di bawah golem. Tepi lantai jauh dilebur oleh fog.
const GLASS_FLOOR_ENABLED = false           // Aktifkan/matikan lantai kaca reflektif
const GLASS_FLOOR_SIZE = 60                // Ukuran bidang lantai (besar, tepinya dilebur fog)
const GLASS_FLOOR_COLOR = '#08102c'        // Warna dasar kaca (obsidian biru gelap)
const GLASS_FLOOR_ROUGHNESS = 0.22         // 0 = cermin sempurna, 1 = kusam (kecil = pantulan tajam)
const GLASS_FLOOR_METALNESS = 0.55         // Sifat metalik kaca
const GLASS_FLOOR_REFLECTIVITY = 1         // Kekuatan refleksi (0-1)
const GLASS_FLOOR_MIX_STRENGTH = 2.4       // Seberapa terang pantulan dicampur ke permukaan
const GLASS_FLOOR_MIX_BLUR = 0.8           // Pantulan makin kabur sesuai roughness/jarak
const GLASS_FLOOR_BLUR = [220, 70]         // Blur pantulan [horizontal, vertikal]
const GLASS_FLOOR_RESOLUTION = 1024        // Resolusi pantulan (desktop). Turunkan bila berat
const GLASS_FLOOR_RESOLUTION_MOBILE = 512
const FLOOR_FOG_COLOR = '#070a26'          // Warna fog = warna cakrawala background
const FLOOR_FOG_NEAR = 9                   // Fog mulai dari jarak ini dari kamera
const FLOOR_FOG_FAR = 30                   // Fog menutup penuh di jarak ini

// --- Panggung Kaca (Platform) di Bawah Golem ---
const PLATFORM_ENABLED = false              // Aktifkan/matikan panggung kaca
const PLATFORM_RADIUS = 3.3                // Radius panggung
const PLATFORM_THICKNESS = 0.14            // Tebal panggung
const PLATFORM_OPACITY = 0.38              // Transparansi kaca panggung
const PLATFORM_COLOR = '#0b3a66'           // Warna tubuh kaca panggung
const PLATFORM_RIM_COLOR = '#67e8f9'       // Warna garis cahaya di tepi panggung
const PLATFORM_RIM_INTENSITY = 2.6         // Terang garis tepi (di atas 1 ikut bloom)

// --- Kolam Energi di Bawah Golem (glow + riak cincin) ---
const POOL_ENABLED = false                  // Aktifkan/matikan glow & riak di lantai
const POOL_RADIUS = 3.1                    // Radius glow kolam
const POOL_COLOR_CORE = 'rgba(120, 225, 255, 0.95)'
const POOL_COLOR_MID = 'rgba(56, 130, 255, 0.35)'
const RIPPLE_COUNT = 3                     // Jumlah cincin riak
const RIPPLE_PERIOD = 5.5                  // Detik per siklus riak
const RIPPLE_MAX_SCALE = 4.4               // Seberapa jauh riak melebar
const RIPPLE_COLOR = '#67e8f9'

// --- Debu Kosmik Melayang (partikel) ---
const DUST_ENABLED = true                  // Aktifkan/matikan partikel debu
const DUST_COUNT = 100                     // Jumlah partikel (otomatis dikurangi di HP)
const DUST_COUNT_MOBILE = 80
const DUST_SPREAD_X = 7.5                  // Sebaran horizontal
const DUST_SPREAD_Z = 6                    // Sebaran kedalaman
const DUST_HEIGHT = 5.5                    // Tinggi maksimum sebelum partikel muncul lagi dari lantai
const DUST_SIZE = 0.06                     // Ukuran partikel

// --- Pencahayaan Multi-Titik (Multi-Point Dynamic Lighting) ---
// Lantai kaca ada di y = 0, golem melayang di atasnya.
const MULTI_LIGHTS = [
  // 1. Cyan Elektrik (kiri-atas-depan)
  { color: '#38bdf8', position: [-4.2, 3.4, 3.4], intensity: 2.0, distance: 18 },
  // 2. Violet Galaksi (kanan-atas-depan)
  { color: '#c084fc', position: [4.4, 3.8, 2.6], intensity: 2.8, distance: 18 },
  // 3. Magenta Kosmik (kiri-belakang)
  { color: '#ffffff', position: [-3.4, 2.6, -3.8], intensity: 2.2, distance: 18 },
  // 4. Gold Starlight (kanan-belakang)
  { color: '#ffffff', position: [3.6, 2.4, -3.4], intensity: 1.6, distance: 18 },
  // 5. Caustic Glint (depan, rendah — kilau tajam di wajah golem & lantai)
  { color: '#e0f2fe', position: [0.0, 0.9, 2.4], intensity: 5.2, distance: 20 },
  // 6. Under-Glow (tepat di bawah golem, menyorot ke atas)
  // { color: '#25bdeb', position: [0.0, 0.25, 0.0], intensity: 3.6, distance: 12 },
]

// --- Animasi "Pembatuan" Dr. Stone (Dinonaktifkan agar golem 100% solid batu bertekstur) ---
const HOLOGRAM_ENABLED = false             // false = golem langsung solid batu utuh, tanpa scanline pembatuan
const HOLOGRAM_DURATION_SEC = 2.2          // Durasi total animasi pembatuan (detik)
const HOLOGRAM_WIRE_COLOR = '#93f8ff'      // Warna wireframe scan hologram
const HOLOGRAM_WIRE_OPACITY = 0.05         // Opasitas wireframe saat aktif
const SCAN_WIRE_LEAD = 0                // Seberapa jauh wireframe lebih maju dari scanline solid (0-1 normalized)

// --- Kamera Sinematik ---
// Kamera mulai agak jauh lalu perlahan "dolly in" mengikuti animasi pembatuan,
// kemudian melayang pelan + parallax mengikuti kursor.
const CAMERA_FOV = 45                      // Field of view kamera
const CAMERA_END_DISTANCE = 5.8            // Jarak kamera ke golem setelah dolly selesai (desktop)
const CAMERA_DOLLY_DISTANCE = 2.6          // Jarak tambahan di awal (ditarik mundur sebanyak ini)
const CAMERA_HEIGHT = 1.55                 // Tinggi kamera dari lantai
const CAMERA_LOOK_Y = 0.85                 // Titik yang ditatap kamera (lebih rendah = golem naik di layar, ruang untuk teks)
const CAMERA_FIT_WIDTH = 3.4               // Lebar scene minimum yang harus terlihat (otomatis menjauh di layar sempit/HP)
const CAMERA_PARALLAX_X = 0.45             // Geser kamera horizontal mengikuti kursor
const CAMERA_PARALLAX_Y = 0.2              // Geser kamera vertikal mengikuti kursor

// --- Bloom ---
const BLOOM_INTENSITY = 0.85
const BLOOM_THRESHOLD = 0.18
const BLOOM_SMOOTHING = 0.25
const BLOOM_RADIUS = 0.5

// --- Bintang-bintang background ---
const STAR_COUNT = 80                       // Jumlah bintang di background galaxy

// --- Glitch Text ---
const GLITCH_TEXTS = [
  'COMPILE', 'RENDER_3D', '0x4F2A', 'SYSTEM_READY',
  'DEBUG', 'VERTEX_SHADER', 'GPU_INIT', 'MESH_LOAD',
  'FRAGMENT', 'PIPELINE', 'BUFFER_OK', 'WEBGL_2.0',
  'TEXTURE_MAP', 'RAYTRACE', 'MATRIX_4X4', 'FPS_60',
]
const GLITCH_COUNT = 14                     // Jumlah teks glitch yang tampil sekaligus

// --- Tampilan material golem (sama seperti GolemModel.jsx) ---
const STONE_BRIGHTNESS = 0.35               // Kecerahan batu (0-1)
const CRACK_MATERIAL_NAME = 'Material.005'
const CRACK_GLOW_COLOR = '#4ae0ff'
const CRACK_GLOW_INTENSITY = 0.15        // Sesuaikan dengan GolemModel agar bloom terlihat
const EYE_GLOW_COLOR = '#4ae0ff'
const EYE_GLOW_INTENSITY = 10.55         // Sama seperti GolemModel — cukup terang untuk bloom threshold

// --- Delay & Animasi ---
const SECTION_EXIT_DELAY_MS = 700           // Delay animasi keluar sebelum pindah section

// --- Scroll-Driven 200vh Multi-Content (Content 0: Golem, Content 1: GolemHand) ---
// Total perjalanan terasa 200vh: user benar-benar scroll ke bawah, dan rotasi model
// mengikuti input scroll secara dinamis (Scroll-Driven Animation), bukan durasi statis.
// Animasi fade dihilangkan: model 100% solid, berpindah posisi meluncur naik/turun melewati frame.
// Bintang, debu kosmik, dan batu-batu yang mengorbit TETAP ADA di tengah scene!
const SCROLL_DISTANCE_PX = 1400              // Jarak akumulasi scroll wheel (px) untuk beralih penuh 0 -> 1 (dinaikkan agar transisi lebih lega & tidak numpuk)
const SCROLL_WHEEL_FACTOR = 1.0             // Pengali sensitivitas mouse wheel (1.0 = pas, 1.2 = lebih cepat)
const SCROLL_TOUCH_FACTOR = 1.6             // Pengali sensitivitas touch swipe di layar sentuh
const SCROLL_LERP_SPEED = 8.0               // Kecepatan kehalusan interpolasi gerakan 3D (makin besar = makin reaktif & nempel ke scroll)

// --- Proteksi Scroll Kebablasan (Overshoot Guard) ---
// Melindungi agar scroll di Section 3.5 tidak mudah tergelincir/kebablasan ke Section 3 atau Section 4
const SCROLL_OVERSHOOT_EXIT_PX = 480        // Jarak scroll ekstra saat sudah mentok sebelum keluar section (onNext/onBack)
const OVERSHOOT_COOLDOWN_MS = 350           // Jeda waktu (ms) serap inersia saat baru menyentuh batas sebelum akumulasi exit diizinkan

// --- Parameter Animasi Muncul Konten (Entrance Animation) ---
// Konten 3.5 disembunyikan sampai gelombang ombak selesai menyapu keluar viewport ke kanan atas
const CONTENT_ENTRANCE_DELAY_MS = 140       // Jeda waktu (ms) setelah ombak tiba di kanan atas sebelum konten mulai muncul
const CONTENT_ENTRANCE_OFFSET_Y = 35        // Jarak slide ke atas (px) untuk efek fade in up

// --- Rotasi Scroll-Driven (Sumbu Vertikal Y) ---
// Berputar dinamis sesuai putaran scroll user (scroll dikit = putar dikit, scroll balik = putar balik)
const SCROLL_SPIN_Y = Math.PI * 2.0         // Total putaran sumbu vertikal (radian: 2*PI = 360° putaran penuh)
const SCROLL_SPIN_X = 0.0                   // Putaran sumbu X (tumble vertikal jika diinginkan, default 0 untuk putaran vertikal murni)

// --- Pergerakan Model (Jarak diperjauh agar konten 1 dan 2 tidak bertumpuk) ---
const GOLEM_TRAVEL_Y = 5.8                  // Jarak model Golem meluncur naik ke atas keluar layar saat discroll (world unit)
const GOLEMHAND_TRAVEL_Y = 5.8              // Jarak model GolemHand meluncur dari bawah layar ke tengah panggung (world unit)
const TRAVEL_SCALE_DROP = 0.15              // Pengurangan skala saat model meluncur menjauh (0.15 = mengecil 15%)

// --- Model 3D GolemHand (/golemhand.glb) ---
const GOLEMHAND_MODEL_SIZE = 3.9            // Ukuran sisi terpanjang model tangan di desktop (world unit)
const GOLEMHAND_MODEL_SIZE_MOBILE = 1.35    // Ukuran model tangan di HP/tablet
const GOLEMHAND_MODEL_SCALE = 1.0           // Pengali skala tambahan di atas auto-fit
const GOLEMHAND_MODEL_Y = 0.45              // Posisi ketinggian tangan di tengah panggung (world unit)
const GOLEMHAND_MODEL_ROT_X = 3          // Kemiringan sumbu X (radian, agak condong ke depan)
const GOLEMHAND_MODEL_ROT_Y = -1          // Rotasi sumbu vertikal Y (radian, menghadap agak serong kanan)
const GOLEMHAND_MODEL_ROT_Z = -.5           // Kemiringan roll (radian)
const GOLEMHAND_BOB_AMPLITUDE = 0.25        // Jarak naik-turun tangan mengambang
const GOLEMHAND_BOB_SPEED = 0.85            // Kecepatan mengambang tangan
const GOLEMHAND_PLAY_ANIMATION = true       // Mainkan animasi gerak jari tangan dari file GLB
const GOLEMHAND_ANIM_SPEED = 0.9           // Kecepatan animasi gerakan jari tangan
const GOLEMHAND_CRACK_GLOW_COLOR = '#4ae0ff' // Warna glow retakan biru kristal tangan
const GOLEMHAND_CRACK_GLOW_INTENSITY = 0.55 // Intensitas cahaya retakan tangan

// --- Parameter TechText Content 0 (Kenapa Memilih Kami?) ---
const WHYUS_HEADLINE_TEXT = 'Kenapa Memilih Kami?' // Teks headline interaktif Content 0
const WHYUS_HEADLINE_FONT_SIZE = 79                // Ukuran font sama dengan Hand To Hand
const WHYUS_HEADLINE_FONT_WEIGHT = 700             // Ketebalan huruf
const WHYUS_HEADLINE_LETTER_SPACING = -0.04        // Spasi antar huruf (em)
const WHYUS_HEADLINE_COLOR = '#ffffff'             // Warna huruf
const WHYUS_HEADLINE_ACCENT = '#67e8f9'            // Warna frame & partikel
const WHYUS_HEADLINE_REACH = 180                   // Radius efek hover kursor (px)
const WHYUS_HEADLINE_SPECKS = 12                   // Jumlah partikel aktif (0 = off)
const WHYUS_HEADLINE_REVEAL = 'letter'             // Mode reveal: 'letter' | 'area' | 'off'
const CONTENT_0_SHOW_SUBTITLE = false              // Subtitle dimatikan sesuai arahan (layout tengah atas)
const CONTENT_0_SUBTITLE = 'Pengalaman visual 3D interaktif yang dibangun dengan teknologi mutakhir dan perhatian pada setiap detail.'

// --- Parameter TechText GolemHand (Content 1) ---
const GOLEMHAND_TEXT = 'Hand To Hand'          // Teks headline interaktif
const GOLEMHAND_FONT_SIZE = 79              // Ukuran font (px) — proporsional di tengah atas
const GOLEMHAND_FONT_WEIGHT = 700           // Ketebalan huruf
const GOLEMHAND_LETTER_SPACING = -0.04      // Spasi antar huruf (em)
const GOLEMHAND_COLOR = '#ffffff'           // Warna huruf
const GOLEMHAND_ACCENT = '#67e8f9'          // Warna frame & partikel
const GOLEMHAND_REACH = 180                 // Radius efek hover (px)
const GOLEMHAND_SPECKS = 12                 // Jumlah partikel aktif (0 = off)
const GOLEMHAND_REVEAL = 'letter'           // Mode reveal: 'letter' | 'area' | 'off'

// --- Indikator Scroll 200vh (Track di Samping Kanan) ---
const SHOW_SCROLL_INDICATOR = true          // Tampilkan track bar scroll di samping kanan layar


// ========== Three.js Sub-Components ==========

// Pseudo-random deterministik: tata letak batu/debu konsisten tiap kali section dibuka
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Tekstur gradasi radial (dipakai untuk glow lantai, sprite partikel, dan alphaMap lantai)
function makeRadialTexture(stops, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([at, color]) => g.addColorStop(at, color))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Mata golem (di luar komponen utama supaya tidak di-remount)
function EyePart({ node, material }) {
  if (!node) return null
  return (
    <mesh
      name={node.name}
      geometry={node.geometry}
      material={material}
      position={node.position}
      rotation={node.rotation}
      scale={node.scale}
      morphTargetDictionary={node.morphTargetDictionary}
      morphTargetInfluences={node.morphTargetInfluences}
    />
  )
}

// Model golem — animasi "pembatuan" Dr. Stone:
// Scanline naik dari bawah: wireframe hanya tampil di atas scanline,
// solid hanya tampil di bawah scanline. Keduanya bergerak bersamaan.
// Golem dipusatkan lewat bounding box & di-fit ke ukuran target, lalu melayang di atas lantai.
function GolemWhyUs({ hologramProgress, scrollProgRef, isMobile, isContentEntered }) {
  const { nodes, materials, animations } = useGLTF('/models/golem.glb')
  const outerRef = useRef()      // grup luar: posisi melayang, rotasi, skala hasil auto-fit
  const centeredRef = useRef()   // grup dalam: kompensasi supaya titik tengah model = origin grup luar
  const layoutRef = useRef({ fit: 1, baseY: 1.5, scanStart: 0, scanEnd: 3.5 })
  const { actions } = useAnimations(animations, centeredRef)

  // Putar animasi alis & mulut golem dari file GLB
  useEffect(() => {
    if (!GOLEM_PLAY_ANIMATION || !actions) return
    Object.values(actions).forEach((action) => {
      if (action) {
        action.reset().fadeIn(0.4).play()
        action.setEffectiveTimeScale(GOLEM_ANIM_SPEED)
      }
    })
    return () => {
      Object.values(actions).forEach((action) => action?.stop())
    }
  }, [actions])

  // Efek ombak wireframe (Wave animation) seperti TerrainWaves pada kepala golem
  useModelWaves(centeredRef, {
    color: GOLEM_WAVE_COLOR,
    autoPulse: GOLEM_WAVE_AUTO_PULSE && GOLEM_WAVE_ENABLED,
    pulseInterval: 5.0,
  })

  // ClippingPlane (world space):
  // solidClip: normal (0,-1,0) → lolos jika y <= constant → solid muncul DI BAWAH scanline
  // wireClip:  normal (0, 1,0) → lolos jika y >= -constant → wire muncul DI ATAS scanline
  const solidClip = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), -10))
  const wireClip = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 10))

  // Material wireframe scan (per-instance, bukan shared)
  const wireframeMat = useMemo(() => {
    if (!HOLOGRAM_ENABLED) return null
    return new THREE.MeshBasicMaterial({
      color: HOLOGRAM_WIRE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: HOLOGRAM_WIRE_OPACITY,
      depthWrite: false,
      toneMapped: false,
      clippingPlanes: [wireClip.current],
      clipIntersection: false,
    })
  }, [])

  // Material mata bercahaya
  const eyeMaterial = useMemo(() => {
    const baseMat = materials?.['Material.002'] || (materials && Object.values(materials)[0])
    const mat = baseMat ? baseMat.clone() : new THREE.MeshStandardMaterial()
    mat.transparent = true
    mat.emissive = new THREE.Color(EYE_GLOW_COLOR)
    mat.emissiveIntensity = EYE_GLOW_INTENSITY
    mat.toneMapped = false
    if (HOLOGRAM_ENABLED) mat.clippingPlanes = [solidClip.current]
    return mat
  }, [materials])

  // Pusatkan & fit model. Diukur di ruang lokal grup luar (tidak terpengaruh rotasi/posisi),
  // jadi hasilnya stabil walau scene sudah berputar.
  useLayoutEffect(() => {
    const outer = outerRef.current
    const centered = centeredRef.current
    if (!outer || !centered || !nodes?.kepalaatas) return

    outer.position.set(0, 0, 0)
    outer.rotation.set(0, 0, 0)
    outer.scale.setScalar(1)
    centered.position.set(0, 0, 0)
    outer.updateWorldMatrix(true, false)
    centered.updateWorldMatrix(false, true)

    const inv = new THREE.Matrix4().copy(outer.matrixWorld).invert()
    const box = new THREE.Box3()
    const tmp = new THREE.Box3()
    const m = new THREE.Matrix4()
    centered.traverse((o) => {
      if (!o.isMesh || o.userData.isScanOverlay || !o.geometry) return
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
      m.multiplyMatrices(inv, o.matrixWorld)
      tmp.copy(o.geometry.boundingBox).applyMatrix4(m)
      box.union(tmp)
    })
    if (box.isEmpty()) return

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const target = isMobile ? GOLEM_TARGET_SIZE_MOBILE : GOLEM_TARGET_SIZE
    const fit = (target / maxDim) * GOLEM_SCALE

    centered.position.set(-center.x, -center.y, -center.z)

    const halfDiag = (Math.hypot(size.x, size.y, size.z) * fit) / 2
    // Posisi vertikal pas di tengah layar: sejajar dengan titik tatap kamera (CAMERA_LOOK_Y = 0.85)
    const baseY = CAMERA_LOOK_Y + GOLEM_HEAD_VERTICAL_OFFSET
    layoutRef.current = {
      fit,
      baseY,
      // Rentang scan pembatuan mengikuti ukuran golem sebenarnya
      scanStart: baseY - halfDiag - 0.1,
      scanEnd: baseY + halfDiag + 0.1,
    }
    outer.position.set(0, baseY, 0)
    outer.scale.setScalar(fit)
  }, [nodes, isMobile])

  // Gelapkan batu, buat retakan bercahaya, pasang clipping plane solid
  const tunedMaterials = useRef(new Map())
  useEffect(() => {
    const restore = []
    const cache = tunedMaterials.current
    const tune = (orig) => {
      if (cache.has(orig)) return cache.get(orig)
      const c = orig.clone()
      c.transparent = true
      if (orig.name === CRACK_MATERIAL_NAME) {
        c.emissive = new THREE.Color(CRACK_GLOW_COLOR)
        c.emissiveIntensity = CRACK_GLOW_INTENSITY
        c.toneMapped = false // Bloom threshold bisa mendeteksi glow retakan
      } else if (c.color) {
        c.color.multiplyScalar(STONE_BRIGHTNESS)
      }
      // Solid mesh hanya diclip jika mode hologram diaktifkan
      if (HOLOGRAM_ENABLED) c.clippingPlanes = [solidClip.current]
      cache.set(orig, c)
      return c
    }
      ;[nodes?.kepalaatas, nodes?.mulutbawah, nodes?.alis].forEach((n) => {
        if (!n) return
        n.traverse((o) => {
          if (!o.isMesh || !o.material) return
          restore.push([o, o.material])
          o.material = Array.isArray(o.material) ? o.material.map(tune) : tune(o.material)
        })
      })
    return () => {
      restore.forEach(([o, m]) => { o.material = m })
      cache.forEach((c) => c.dispose())
      cache.clear()
    }
  }, [nodes])

  // Wireframe overlay meshes (hanya di atas scanline)
  const overlayRefs = useRef([])
  useEffect(() => {
    if (!HOLOGRAM_ENABLED || !wireframeMat) return
    const targets = []
      ;[nodes?.kepalaatas, nodes?.mulutbawah, nodes?.alis, nodes?.matakanan, nodes?.matakiri].forEach((n) => {
        if (!n) return
        const collect = (o) => { if (o.isMesh) targets.push(o) }
        n.isMesh ? collect(n) : n.traverse(collect)
      })
    const overlays = targets.map((mesh) => {
      const ov = new THREE.Mesh(mesh.geometry, wireframeMat)
      ov.scale.setScalar(1.002)
      ov.renderOrder = 2
      ov.userData.isScanOverlay = true
      ov.raycast = () => { }
      mesh.add(ov)
      return { ov, parent: mesh }
    })
    overlayRefs.current = overlays
    return () => overlays.forEach(({ ov, parent }) => parent.remove(ov))
  }, [nodes, wireframeMat])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const L = layoutRef.current
    const outer = outerRef.current
    if (!outer) return

    // Scroll-Driven Animation: posisi & rotasi mengikuti langsung scrollProgress (0.0 .. 1.0)
    const p = scrollProgRef.current

    // Culling performa: sembunyikan jika belum masuk atau sudah meluncur jauh ke atas di luar jangkauan kamera
    if (!isContentEntered || p >= 0.995) {
      outer.visible = false
      return
    }

    outer.visible = true

    // Posisi Y: meluncur naik ke atas keluar layar saat discroll (SOLID, TANPA FADE)
    outer.position.y = L.baseY + Math.sin(t * GOLEM_BOB_SPEED) * GOLEM_BOB_AMPLITUDE + p * GOLEM_TRAVEL_Y

    // Rotasi Y: berputar pada sumbu vertikal mengikuti input scroll secara dinamis
    outer.rotation.x = GOLEM_ROTATION_X + Math.sin(t * 0.6) * 0.025 + p * SCROLL_SPIN_X
    outer.rotation.y = GOLEM_ROTATION_Y + Math.sin(t * GOLEM_SWAY_SPEED) * GOLEM_SWAY_YAW + p * SCROLL_SPIN_Y
    outer.rotation.z = GOLEM_ROTATION_Z + Math.sin(t * 0.5) * 0.012

    // Skala mengecil halus saat meluncur ke atas
    const currentScale = L.fit * (1 - p * TRAVEL_SCALE_DROP)
    outer.scale.setScalar(currentScale)

    // Animasi scanline pembatuan di awal entrance
    const scanP = hologramProgress.current // 0 → 1
    const totalRange = L.scanEnd - L.scanStart
    const solidY = L.scanStart + scanP * totalRange
    const wireY = L.scanStart + Math.min(1, scanP + SCAN_WIRE_LEAD) * totalRange
    solidClip.current.constant = solidY
    wireClip.current.constant = -wireY

    // Wireframe fade hanya saat entrance pembatuan
    if (wireframeMat) {
      wireframeMat.opacity = HOLOGRAM_WIRE_OPACITY * Math.max(0, 1 - Math.pow(scanP, 3))
      wireframeMat.visible = scanP < 0.98
    }

    // Napas mata: saat hologram off, langsung nyala penuh (tanpa multiplier scanP)
    const breathe = 1 + Math.sin(t * 1.4) * 0.08
    const scanFactor = HOLOGRAM_ENABLED ? Math.min(1, scanP * 2) : 1
    eyeMaterial.emissiveIntensity = EYE_GLOW_INTENSITY * breathe * scanFactor
  })

  return (
    <group ref={outerRef} rotation={[GOLEM_ROTATION_X, GOLEM_ROTATION_Y, GOLEM_ROTATION_Z]}>
      <group ref={centeredRef}>
        {nodes.kepalaatas && <primitive object={nodes.kepalaatas} />}
        {nodes.mulutbawah && <primitive object={nodes.mulutbawah} />}
        {nodes.alis && <primitive object={nodes.alis} />}
        <EyePart node={nodes.matakanan} material={eyeMaterial} />
        <EyePart node={nodes.matakiri} material={eyeMaterial} />
      </group>
    </group>
  )
}

// Model tangan golem (/golemhand.glb) — Content 1
// Dipusatkan lewat bounding box & di-fit ke ukuran target, melayang di scene yang sama dengan batu-batu orbit
function GolemHandModel({ scrollProgRef, isMobile, isContentEntered }) {
  const outerRef = useRef()
  const centeredRef = useRef()
  const layoutRef = useRef({ fit: 1 })
  const { scene, animations } = useGLTF('/golemhand.glb')
  const { actions } = useAnimations(animations, outerRef)

  // Efek ombak wireframe (Wave animation) seperti TerrainWaves pada tangan golem
  useModelWaves(centeredRef, {
    color: GOLEMHAND_WAVE_COLOR,
    autoPulse: GOLEMHAND_WAVE_AUTO_PULSE && GOLEM_WAVE_ENABLED,
    pulseInterval: 5.5,
  })

  // Mainkan animasi gerak jari tangan dari file GLB jika ada
  useEffect(() => {
    if (!GOLEMHAND_PLAY_ANIMATION || !actions) return
    Object.values(actions).forEach((action) => {
      if (action) {
        action.reset().fadeIn(0.5).play()
        action.setEffectiveTimeScale(GOLEMHAND_ANIM_SPEED)
      }
    })
    return () => {
      Object.values(actions).forEach((action) => action?.stop())
    }
  }, [actions])

  // Tuning material: glow retakan cyan (tanpa fade, solid)
  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const prepareMat = (m) => {
          m.opacity = 1
          if (m.name === 'Material.005' || m.name === 'bluerift') {
            m.emissive = new THREE.Color(GOLEMHAND_CRACK_GLOW_COLOR)
            m.emissiveIntensity = GOLEMHAND_CRACK_GLOW_INTENSITY
            m.toneMapped = false // Penting agar bloom threshold bisa mendeteksi emissive glow
          }
        }
        if (Array.isArray(o.material)) {
          o.material.forEach(prepareMat)
        } else {
          prepareMat(o.material)
        }
      }
    })
  }, [scene])

  // Auto-fit & auto-center bounding box
  useLayoutEffect(() => {
    const centered = centeredRef.current
    if (!centered) return

    centered.position.set(0, 0, 0)
    centered.rotation.set(0, 0, 0)
    centered.scale.setScalar(1)
    centered.updateWorldMatrix(true, true)

    const box = new THREE.Box3().setFromObject(centered)
    if (box.isEmpty()) return

    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const targetSize = isMobile ? GOLEMHAND_MODEL_SIZE_MOBILE : GOLEMHAND_MODEL_SIZE
    const fit = (targetSize / maxDim) * GOLEMHAND_MODEL_SCALE

    centered.position.set(-center.x, -center.y, -center.z)
    layoutRef.current = { fit }

    if (outerRef.current) {
      outerRef.current.position.set(0, GOLEMHAND_MODEL_Y - GOLEMHAND_TRAVEL_Y, 0)
      outerRef.current.scale.setScalar(fit * (1 - TRAVEL_SCALE_DROP))
      outerRef.current.visible = false
    }
  }, [scene, isMobile])

  useFrame((state) => {
    const outer = outerRef.current
    if (!outer) return

    // Scroll-Driven Animation: posisi & rotasi mengikuti langsung scrollProgress (0.0 .. 1.0)
    const p = scrollProgRef.current

    // Culling performa: sembunyikan jika belum masuk atau masih jauh di bawah layar
    if (!isContentEntered || p <= 0.005) {
      outer.visible = false
      return
    }

    outer.visible = true
    const factor = 1 - p
    const t = state.clock.elapsedTime
    const fit = layoutRef.current.fit || 1

    // Posisi Y: meluncur naik dari bawah layar ke posisi tengah panggung (SOLID, TANPA FADE)
    outer.position.y = GOLEMHAND_MODEL_Y + Math.sin(t * GOLEMHAND_BOB_SPEED) * GOLEMHAND_BOB_AMPLITUDE - factor * GOLEMHAND_TRAVEL_Y

    // Rotasi Y: berputar pada sumbu vertikal mengikuti input scroll secara dinamis
    outer.rotation.y = GOLEMHAND_MODEL_ROT_Y - factor * SCROLL_SPIN_Y
    outer.rotation.x = GOLEMHAND_MODEL_ROT_X - factor * SCROLL_SPIN_X
    outer.rotation.z = GOLEMHAND_MODEL_ROT_Z

    // Skala membesar ke normal saat sampai di tengah panggung
    const currentScale = fit * (1 - factor * TRAVEL_SCALE_DROP)
    outer.scale.setScalar(currentScale)
  })

  return (
    <group ref={outerRef} visible={false}>
      <group ref={centeredRef}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

// Batu/meteorit mengambang (PLACEHOLDER) — mengorbit golem, flat-shaded dengan glow kristal samar
function FloatingRocks() {
  const rocksData = useMemo(() => {
    const rand = mulberry32(35)
    const data = []
    for (let i = 0; i < ROCK_COUNT; i++) {
      const angle = (i / ROCK_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.5
      const radius = ROCK_RADIUS_MIN + rand() * (ROCK_RADIUS_MAX - ROCK_RADIUS_MIN)
      const y = ROCK_Y_MIN + rand() * (ROCK_Y_MAX - ROCK_Y_MIN)
      data.push({
        position: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        baseY: y,
        size: ROCK_SIZE_MIN + Math.pow(rand(), 1.6) * (ROCK_SIZE_MAX - ROCK_SIZE_MIN),
        squash: [1, 0.65 + rand() * 0.6, 0.8 + rand() * 0.5],
        phase: rand() * Math.PI * 2,
        speed: ROCK_FLOAT_SPEED * (0.7 + rand() * 0.6),
        rotSpeed: (rand() - 0.5) * 0.6,
      })
    }
    return data
  }, [])

  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ROCK_COLOR,
        emissive: ROCK_EMISSIVE,
        emissiveIntensity: 0.55,
        roughness: 0.8,
        metalness: 0.25,
        flatShading: true,
      }),
    []
  )
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  const refs = useRef([])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((grp, i) => {
      if (!grp) return
      const rock = rocksData[i]
      grp.position.y = rock.baseY + Math.sin(t * rock.speed + rock.phase) * ROCK_FLOAT_AMPLITUDE
      grp.rotation.x += rock.rotSpeed * delta * 0.6
      grp.rotation.z += rock.rotSpeed * delta * 0.45
    })
  })

  return (
    <>
      {rocksData.map((rock, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el }} position={rock.position}>
          <mesh geometry={geometry} material={material} scale={[rock.size * rock.squash[0], rock.size * rock.squash[1], rock.size * rock.squash[2]]} />
        </group>
      ))}
    </>
  )
}

// Debu kosmik: partikel kecil bercahaya yang naik pelan dari lantai, memberi kedalaman & suasana
function DustMotes({ isMobile }) {
  const count = isMobile ? DUST_COUNT_MOBILE : DUST_COUNT
  const pointsRef = useRef()

  const { positions, speeds, drift, colors } = useMemo(() => {
    const rand = mulberry32(77)
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    const drf = new Float32Array(count)
    const palette = ['#7dd3fc', '#e0f2fe', '#c4b5fd', '#ffffff', '#67e8f9'].map((c) => new THREE.Color(c))
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (rand() - 0.5) * 2 * DUST_SPREAD_X
      pos[i * 3 + 1] = rand() * DUST_HEIGHT
      pos[i * 3 + 2] = (rand() - 0.5) * 2 * DUST_SPREAD_Z
      spd[i] = 0.05 + rand() * 0.17
      drf[i] = rand() * Math.PI * 2
      const c = palette[Math.floor(rand() * palette.length)]
      col[i * 3 + 0] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }
    return { positions: pos, speeds: spd, drift: drf, colors: col }
  }, [count])

  const sprite = useMemo(
    () => makeRadialTexture([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']], 64),
    []
  )
  useEffect(() => () => sprite.dispose(), [sprite])

  useFrame((state, delta) => {
    const pts = pointsRef.current
    if (!pts) return
    const t = state.clock.elapsedTime
    const attr = pts.geometry.attributes.position
    const arr = attr.array
    for (let i = 0; i < count; i++) {
      let y = arr[i * 3 + 1] + speeds[i] * delta
      if (y > DUST_HEIGHT) y = 0.05
      arr[i * 3 + 1] = y
      arr[i * 3] += Math.sin(t * 0.4 + drift[i]) * 0.04 * delta
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} renderOrder={4} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={DUST_SIZE}
        map={sprite}
        vertexColors
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </points>
  )
}

// Kolam energi di lantai tepat di bawah golem: glow bernapas + cincin riak yang melebar & memudar
function EnergyPool() {
  const glowRef = useRef()
  const ringRefs = useRef([])

  const glowTex = useMemo(
    () => makeRadialTexture([[0, POOL_COLOR_CORE], [0.35, POOL_COLOR_MID], [1, 'rgba(0,0,0,0)']]),
    []
  )
  useEffect(() => () => glowTex.dispose(), [glowTex])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (glowRef.current) glowRef.current.material.opacity = 0.62 + Math.sin(t * 1.3) * 0.12
    ringRefs.current.forEach((ring, i) => {
      if (!ring) return
      const p = (t / RIPPLE_PERIOD + i / RIPPLE_COUNT) % 1
      ring.scale.setScalar(0.5 + p * RIPPLE_MAX_SCALE)
      // fade-in cepat di awal, fade-out halus di akhir
      ring.material.opacity = Math.pow(1 - p, 2) * Math.min(1, p * 6) * 0.55
    })
  })

  return (
    <group position={[0, 0.02, 0]}>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[POOL_RADIUS, 64]} />
        <meshBasicMaterial
          map={glowTex}
          transparent
          opacity={0.62}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      {Array.from({ length: RIPPLE_COUNT }).map((_, i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el }} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <ringGeometry args={[0.96, 1, 96]} />
          <meshBasicMaterial
            color={RIPPLE_COLOR}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
    </group>
  )
}

// Panggung kaca: slab transparan berbingkai cahaya, duduk di atas lantai reflektif
function GlassPlatform() {
  return (
    <group>
      {/* Tubuh kaca (permukaan atas di y ≈ 0.01) */}
      <mesh position={[0, 0.01 - PLATFORM_THICKNESS / 2, 0]} renderOrder={1}>
        <cylinderGeometry args={[PLATFORM_RADIUS, PLATFORM_RADIUS, PLATFORM_THICKNESS, 96, 1]} />
        <meshPhysicalMaterial
          color={PLATFORM_COLOR}
          transparent
          opacity={PLATFORM_OPACITY}
          roughness={0.05}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={1}
          depthWrite={false}
        />
      </mesh>
      {/* Garis cahaya tipis di tepi panggung */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={3}>
        <ringGeometry args={[PLATFORM_RADIUS - 0.035, PLATFORM_RADIUS, 128]} />
        <meshBasicMaterial
          color={new THREE.Color(PLATFORM_RIM_COLOR).multiplyScalar(PLATFORM_RIM_INTENSITY)}
          toneMapped={false}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// Lantai kaca reflektif: memantulkan golem, batu & cahaya. Tepi jauh dilebur fog (tanpa horizon keras).
function GlassFloor({ isMobile }) {
  return (
    <group>
      {POOL_ENABLED && <EnergyPool />}
      {PLATFORM_ENABLED && <GlassPlatform />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[GLASS_FLOOR_SIZE, GLASS_FLOOR_SIZE, 1, 1]} />
        <MeshReflectorMaterial
          color={GLASS_FLOOR_COLOR}
          roughness={GLASS_FLOOR_ROUGHNESS}
          metalness={GLASS_FLOOR_METALNESS}
          mirror={GLASS_FLOOR_REFLECTIVITY}
          resolution={isMobile ? GLASS_FLOOR_RESOLUTION_MOBILE : GLASS_FLOOR_RESOLUTION}
          blur={GLASS_FLOOR_BLUR}
          mixBlur={GLASS_FLOOR_MIX_BLUR}
          mixStrength={GLASS_FLOOR_MIX_STRENGTH}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
        />
      </mesh>
    </group>
  )
}

// Orbit: memutar batu-batu horisontal mengelilingi golem
function Turntable({ children }) {
  const groupRef = useRef()
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += TURNTABLE_SPEED * delta
  })
  return <group ref={groupRef}>{children}</group>
}

// Kamera sinematik: dolly-in saat entrance (mengikuti progress pembatuan),
// lalu melayang pelan + parallax mengikuti kursor. Otomatis menjauh di layar sempit supaya
// golem tidak terpotong.
function CameraRig({ hologramProgress }) {
  const pointer = useRef({ x: 0, y: 0 })
  const smooth = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((state, delta) => {
    const cam = state.camera
    const p = hologramProgress.current
    const ease = 1 - Math.pow(1 - Math.min(1, p * 1.05), 3) // easeOutCubic

    const fov = THREE.MathUtils.degToRad(cam.fov)
    const aspect = state.size.width / Math.max(1, state.size.height)
    const fitDist = CAMERA_FIT_WIDTH / (2 * Math.tan(fov / 2) * aspect)
    const endDist = Math.max(CAMERA_END_DISTANCE, fitDist)
    const dist = THREE.MathUtils.lerp(endDist + CAMERA_DOLLY_DISTANCE, endDist, ease)

    const k = 1 - Math.exp(-3 * delta)
    smooth.current.x += (pointer.current.x - smooth.current.x) * k
    smooth.current.y += (pointer.current.y - smooth.current.y) * k

    const drift = Math.sin(state.clock.elapsedTime * 0.18) * 0.25
    cam.position.set(
      smooth.current.x * CAMERA_PARALLAX_X + drift,
      CAMERA_HEIGHT + (1 - ease) * 0.6 - smooth.current.y * CAMERA_PARALLAX_Y,
      dist
    )
    cam.lookAt(0, CAMERA_LOOK_Y, 0)
  })

  return null
}

// Scene utama di dalam Canvas
// clippingPlanes diaktifkan di renderer agar clippingPlane material bekerja
function WhyUsScene({ hologramProgress, scrollProgRef, targetProgRef, sectionDomRef, isMobile, isContentEntered }) {
  const { gl } = useThree()

  useEffect(() => {
    gl.localClippingEnabled = true
    return () => { gl.localClippingEnabled = false }
  }, [gl])

  // Scroll-Driven Animation Loop: interpolasi scrollProgress dengan lerp damping 60-120fps
  useFrame((state, delta) => {
    // Lerp smooth scroll progres (0.0 .. 1.0)
    scrollProgRef.current += (targetProgRef.current - scrollProgRef.current) * Math.min(1, delta * SCROLL_LERP_SPEED)

    // Update CSS custom property pada container DOM secara langsung (zero re-render!)
    if (sectionDomRef.current) {
      sectionDomRef.current.style.setProperty('--scroll-p', scrollProgRef.current.toFixed(4))
    }
  })

  return (
    <>
      <CameraRig hologramProgress={hologramProgress} />

      {/* Fog: melebur tepi jauh lantai ke warna cakrawala */}
      <fog attach="fog" args={[FLOOR_FOG_COLOR, FLOOR_FOG_NEAR, FLOOR_FOG_FAR]} />

      {/* Multi-Point Dynamic Lighting */}
      {MULTI_LIGHTS.map((light, i) => (
        <pointLight
          key={i}
          position={light.position}
          color={light.color}
          intensity={light.intensity}
          distance={light.distance}
          decay={2}
        />
      ))}

      {/* Rim light cyan untuk siluet golem & tangan */}
      <directionalLight position={[0, 4, -4]} color="#00f0ff" intensity={1.2} />

      {/* Ambient agar golem tetap terbaca */}
      <ambientLight color="#1a2a4a" intensity={1.2} />

      {/* Lantai kaca STATIS — tidak ikut berputar */}
      {GLASS_FLOOR_ENABLED && <GlassFloor isMobile={isMobile} />}

      {/* Golem melayang di tengah (Content 0) — Scroll-Driven */}
      <Suspense fallback={null}>
        <GolemWhyUs
          hologramProgress={hologramProgress}
          scrollProgRef={scrollProgRef}
          isMobile={isMobile}
          isContentEntered={isContentEntered}
        />
      </Suspense>

      {/* Model tangan Golem (Content 1) — Scroll-Driven */}
      <Suspense fallback={null}>
        <GolemHandModel
          scrollProgRef={scrollProgRef}
          isMobile={isMobile}
          isContentEntered={isContentEntered}
        />
      </Suspense>

      {/* Batu mengorbit golem (TETAP ADA & BERPUTAR DI KEDUA KONTEN!) */}
      {ROCKS_ENABLED && (
        <Turntable>
          <FloatingRocks />
        </Turntable>
      )}

      {/* Debu kosmik (TETAP ADA DI KEDUA KONTEN!) */}
      {DUST_ENABLED && <DustMotes isMobile={isMobile} />}

      {/* Bloom efek glow */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={BLOOM_INTENSITY}
          luminanceThreshold={BLOOM_THRESHOLD}
          luminanceSmoothing={BLOOM_SMOOTHING}
          radius={BLOOM_RADIUS}
        />
      </EffectComposer>
    </>
  )
}


// ========== Star Generator (CSS) ==========
function generateStars(count) {
  const stars = []
  for (let i = 0; i < count; i++) {
    stars.push({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      dur: `${2 + Math.random() * 4}s`,
      delay: `${Math.random() * 3}s`,
      brightness: 0.3 + Math.random() * 0.7,
      size: 1 + Math.random() * 2,
    })
  }
  return stars
}

// ========== Glitch Text Generator ==========
function generateGlitchTexts(count) {
  const texts = []
  for (let i = 0; i < count; i++) {
    texts.push({
      id: i,
      text: GLITCH_TEXTS[Math.floor(Math.random() * GLITCH_TEXTS.length)],
      left: `${5 + Math.random() * 85}%`,
      top: `${5 + Math.random() * 85}%`,
      dur: `${5 + Math.random() * 8}s`,
      delay: `${Math.random() * 5}s`,
      opacity: 0.03 + Math.random() * 0.05,
      rotate: `${(Math.random() - 0.5) * 20}deg`,
    })
  }
  return texts
}


// ========== Main Component ==========
const SectionWhyUs = forwardRef(function SectionWhyUs({ isVisible, onBack, onNext, isPreview = false }, ref) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  const [isExiting, setIsExiting] = useState(false)
  const isExitingRef = useRef(false)
  const sectionDomRef = useRef(null)

  // Status kesiapan konten: konten disembunyikan sampai gelombang tiba di kanan atas (bukan preview)
  const [isContentEntered, setIsContentEntered] = useState(false)
  const [isContentEntering, setIsContentEntering] = useState(false)
  const boundaryHitTimeRef = useRef(0)

  // Scroll-Driven Animation state & refs (200vh total feel)
  const targetProgRef = useRef(0)        // 0.0 .. 1.0 (target dari input scroll)
  const scrollProgRef = useRef(0)        // 0.0 .. 1.0 (smooth interpolated)
  const overshootRef = useRef(0)         // Akumulasi scroll saat sudah mentok di 0 atau 1
  const timerRef = useRef(null)
  const hologramProgress = useRef(0)
  const hologramStartTime = useRef(null)

  // Generate stars & glitch once
  const stars = useMemo(() => generateStars(STAR_COUNT), [])
  const glitchTexts = useMemo(() => generateGlitchTexts(GLITCH_COUNT), [])

  // Kontrol kemunculan konten: objek di 3.5 disembunyikan sampai ombak selesai menyapu keluar viewport (isPreview false)
  useEffect(() => {
    if (isVisible && !isPreview) {
      const t = setTimeout(() => {
        setIsContentEntering(true)
        setIsContentEntered(true)
      }, CONTENT_ENTRANCE_DELAY_MS)
      return () => clearTimeout(t)
    } else {
      setIsContentEntered(false)
      setIsContentEntering(false)
      targetProgRef.current = 0
      scrollProgRef.current = 0
      overshootRef.current = 0
      boundaryHitTimeRef.current = 0
      isExitingRef.current = false
      if (sectionDomRef.current) {
        sectionDomRef.current.style.setProperty('--scroll-p', '0')
      }
    }
  }, [isVisible, isPreview])

  // Hologram entrance animation timing
  useEffect(() => {
    if (isVisible && !isPreview && HOLOGRAM_ENABLED) {
      hologramProgress.current = 0
      hologramStartTime.current = performance.now()
      const animate = () => {
        if (!hologramStartTime.current) return
        const elapsed = (performance.now() - hologramStartTime.current) / 1000
        hologramProgress.current = Math.min(1, elapsed / HOLOGRAM_DURATION_SEC)
        if (hologramProgress.current < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    } else {
      hologramProgress.current = 0
      hologramStartTime.current = null
    }
  }, [isVisible, isPreview])

  // Handler input wheel delta dari App.jsx (atau touch)
  const onWheelDelta = useCallback((deltaY) => {
    if (isExitingRef.current || !isContentEntered) return

    const now = performance.now()
    const delta = deltaY * SCROLL_WHEEL_FACTOR
    const prev = targetProgRef.current
    const step = delta / SCROLL_DISTANCE_PX
    const next = Math.max(0, Math.min(1, prev + step))

    // Deteksi jika baru saja mencapai batas (prev berada di tengah lalu menyentuh 0 atau 1)
    if ((prev > 0.001 && next <= 0.001) || (prev < 0.999 && next >= 0.999)) {
      boundaryHitTimeRef.current = now
      overshootRef.current = 0
      targetProgRef.current = next
      return
    }

    targetProgRef.current = next

    // Cek jika sedang mentok di ujung atas (konten 0) dan terus scroll ke atas
    if (prev <= 0 && delta < 0) {
      if (now - boundaryHitTimeRef.current < OVERSHOOT_COOLDOWN_MS) {
        return // Serap inersia scroll yang tersisa
      }
      overshootRef.current += Math.abs(delta)
      if (overshootRef.current > SCROLL_OVERSHOOT_EXIT_PX) {
        overshootRef.current = 0
        isExitingRef.current = true
        setIsExiting(true)
        setIsContentEntered(false)
        timerRef.current = setTimeout(() => {
          setIsExiting(false)
          isExitingRef.current = false
          if (onBack) onBack()
        }, 220)
      }
      return
    }

    // Cek jika sedang mentok di ujung bawah (konten 1) dan terus scroll ke bawah
    if (prev >= 1 && delta > 0) {
      if (now - boundaryHitTimeRef.current < OVERSHOOT_COOLDOWN_MS) {
        return // Serap inersia scroll yang tersisa
      }
      overshootRef.current += Math.abs(delta)
      if (overshootRef.current > SCROLL_OVERSHOOT_EXIT_PX) {
        overshootRef.current = 0
        isExitingRef.current = true
        setIsExiting(true)
        setIsContentEntered(false)
        timerRef.current = setTimeout(() => {
          setIsExiting(false)
          isExitingRef.current = false
          if (onNext) onNext()
        }, 220)
      }
      return
    }

    // Reset overshoot saat sedang di dalam rentang
    overshootRef.current = 0
  }, [onBack, onNext, isContentEntered])

  // Handler touch delta untuk layar sentuh HP
  const onTouchDelta = useCallback((dy) => {
    if (isExitingRef.current || !isContentEntered) return
    const now = performance.now()
    const delta = dy * SCROLL_TOUCH_FACTOR
    const prev = targetProgRef.current
    const step = delta / SCROLL_DISTANCE_PX
    const next = Math.max(0, Math.min(1, prev + step))

    if ((prev > 0.001 && next <= 0.001) || (prev < 0.999 && next >= 0.999)) {
      boundaryHitTimeRef.current = now
      overshootRef.current = 0
      targetProgRef.current = next
      return
    }

    targetProgRef.current = next

    if (prev <= 0 && delta < 0) {
      if (now - boundaryHitTimeRef.current < OVERSHOOT_COOLDOWN_MS) return
      overshootRef.current += Math.abs(delta)
      if (overshootRef.current > SCROLL_OVERSHOOT_EXIT_PX) {
        overshootRef.current = 0
        isExitingRef.current = true
        setIsExiting(true)
        setIsContentEntered(false)
        timerRef.current = setTimeout(() => {
          setIsExiting(false)
          isExitingRef.current = false
          if (onBack) onBack()
        }, 220)
      }
      return
    }

    if (prev >= 1 && delta > 0) {
      if (now - boundaryHitTimeRef.current < OVERSHOOT_COOLDOWN_MS) return
      overshootRef.current += Math.abs(delta)
      if (overshootRef.current > SCROLL_OVERSHOOT_EXIT_PX) {
        overshootRef.current = 0
        isExitingRef.current = true
        setIsExiting(true)
        setIsContentEntered(false)
        timerRef.current = setTimeout(() => {
          setIsExiting(false)
          isExitingRef.current = false
          if (onNext) onNext()
        }, 220)
      }
      return
    }

    overshootRef.current = 0
  }, [onBack, onNext, isContentEntered])

  // Handler touch end
  const onTouchEnd = useCallback(() => {
    overshootRef.current = 0
  }, [])

  // Handler imperative next / back (jika dipanggil dari keyboard / tombol)
  const next = useCallback(() => {
    if (targetProgRef.current < 0.95) {
      targetProgRef.current = 1
    } else {
      if (onNext) onNext()
    }
  }, [onNext])

  const back = useCallback(() => {
    if (targetProgRef.current > 0.05) {
      targetProgRef.current = 0
    } else {
      if (onBack) onBack()
    }
  }, [onBack])

  // Expose imperative handle untuk App.jsx
  useImperativeHandle(ref, () => ({
    next,
    back,
    onWheelDelta,
    onTouchDelta,
    onTouchEnd,
  }), [next, back, onWheelDelta, onTouchDelta, onTouchEnd])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const showSection = isVisible || isExiting

  return (
    <section
      ref={sectionDomRef}
      className={`section-why-us ${(showSection || isPreview) ? 'section-why-us--visible' : ''}`}
      style={{
        '--scroll-p': '0',
        // isPreview: tampil di bawah Section 3 (z-index < 4), pointer-events nonaktif, langsung terlihat penuh tanpa delay transisi
        ...(isPreview ? { zIndex: 2, pointerEvents: 'none', opacity: 1, transform: 'none', visibility: 'visible', transition: 'none' } : {}),
      }}
    >
      {/* Galaxy Background + aurora yang bernapas pelan */}
      <div className="section-why-us__bg" />
      <div className="section-why-us__aurora" />

      {/* Sinar cahaya (god rays) dari atas */}
      <div className="section-why-us__rays" />

      {/* Bintang-bintang */}
      <div className="section-why-us__stars">
        {stars.map((star) => (
          <div
            key={star.id}
            className="section-why-us__star"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              '--star-dur': star.dur,
              '--star-delay': star.delay,
              '--star-brightness': star.brightness,
            }}
          />
        ))}
      </div>

      {/* Glitch text mengambang */}
      <div className="section-why-us__glitch-layer">
        {glitchTexts.map((gt) => (
          <div
            key={gt.id}
            className="section-why-us__glitch-text"
            style={{
              left: gt.left,
              top: gt.top,
              '--glitch-dur': gt.dur,
              '--glitch-delay': gt.delay,
              '--glitch-opacity': gt.opacity,
              transform: `rotate(${gt.rotate})`,
            }}
          >
            {gt.text}
          </div>
        ))}
      </div>

      {/* Canvas 3D — Shared scene (tetap aktif di content 0 & 1, batu orbit & debu tetap ada) */}
      <div className="section-why-us__canvas">
        <Canvas
          frameloop={showSection ? 'always' : 'never'}
          camera={{ position: [0, CAMERA_HEIGHT, CAMERA_END_DISTANCE + CAMERA_DOLLY_DISTANCE], fov: CAMERA_FOV }}
          dpr={isMobile ? [1, 1.25] : [1, 1.5]}
          gl={{
            antialias: false,
            alpha: true,
            clearAlpha: 0,
            powerPreference: 'high-performance',
          }}
          events={false}
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <WhyUsScene
            hologramProgress={hologramProgress}
            scrollProgRef={scrollProgRef}
            targetProgRef={targetProgRef}
            sectionDomRef={sectionDomRef}
            isMobile={isMobile}
            isContentEntered={isContentEntered}
          />
        </Canvas>
      </div>

      {/* Lapisan sinematik di atas canvas: lens streak, vignette, film grain */}
      <div className="section-why-us__flare" />
      <div className="section-why-us__vignette" />
      <div className="section-why-us__grain" />

      {/* Konten teks overlay — content 0 (tengah atas, Scroll-Driven) */}
      <div className={`section-why-us__content ${!isContentEntered ? 'section-why-us__content--hidden' : isContentEntering ? 'section-why-us__content--entering' : ''}`}>
        <div className="section-why-us__headline-techtext">
          <TechText
            text={WHYUS_HEADLINE_TEXT}
            fontSize={WHYUS_HEADLINE_FONT_SIZE}
            fontWeight={WHYUS_HEADLINE_FONT_WEIGHT}
            letterSpacing={WHYUS_HEADLINE_LETTER_SPACING}
            color={WHYUS_HEADLINE_COLOR}
            accentColor={WHYUS_HEADLINE_ACCENT}
            reach={WHYUS_HEADLINE_REACH}
            specks={WHYUS_HEADLINE_SPECKS}
            reveal={WHYUS_HEADLINE_REVEAL}
            draggable={true}
            sweep={true}
          />
        </div>
        {CONTENT_0_SHOW_SUBTITLE && (
          <>
            <span className="section-why-us__divider" />
            <p className="section-why-us__subtitle">{CONTENT_0_SUBTITLE}</p>
          </>
        )}
      </div>

      {/* Content 1: GolemHand — TechText headline di tengah atas (Scroll-Driven) */}
      <div className={`section-why-us__golemhand ${!isContentEntered ? 'section-why-us__content--hidden' : ''}`}>
        <div className="section-why-us__golemhand-techtext">
          <TechText
            text={GOLEMHAND_TEXT}
            fontSize={GOLEMHAND_FONT_SIZE}
            fontWeight={GOLEMHAND_FONT_WEIGHT}
            letterSpacing={GOLEMHAND_LETTER_SPACING}
            color={GOLEMHAND_COLOR}
            accentColor={GOLEMHAND_ACCENT}
            reach={GOLEMHAND_REACH}
            specks={GOLEMHAND_SPECKS}
            reveal={GOLEMHAND_REVEAL}
            draggable={true}
            sweep={true}
          />
        </div>
      </div>

      {/* Track Indikator Scroll 200vh di Samping Kanan */}
      {SHOW_SCROLL_INDICATOR && (
        <div className={`section-why-us__scroll-track ${!isContentEntered ? 'section-why-us__content--hidden' : ''}`}>
          <div className="section-why-us__scroll-thumb" />
        </div>
      )}
    </section>
  )
})

useGLTF.preload('/models/golem.glb')
useGLTF.preload('/golemhand.glb')

export default SectionWhyUs
