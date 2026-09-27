import { Suspense, useRef, useLayoutEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ============================================================================
// Komponen ini menggantikan headline teks "GOLEM" (dulu <h1 className=
// "app-headline-text">) dengan model 3D (textgolem.glb). Dirender PERSIS di
// tempat yang sama di App.jsx — di dalam .app-headline-layer — sehingga
// seluruh animasi entrance/exit GSAP, parallax, dan z-index TETAP JALAN APA
// ADANYA, karena GSAP & RAF parallax menganimasikan elemen WRAPPER
// (.app-headline-layer), bukan konten 3D di dalamnya.
//
// Taruh file "textgolem.glb" Anda di folder /public.
// ============================================================================

const HEADLINE_MODEL_PATH = '/textgolem.glb'

// ----------------------------------------------------------------------------
// ROTASI — SUDAH DIVERIFIKASI, JANGAN DIUBAH kecuali Anda re-export model
// dengan orientasi Blender yang berbeda. File textgolem.glb Anda ternyata
// diekspor dengan lebar teks "GOLEM" menghadap ke sumbu kedalaman (Z), bukan
// ke kamera. Rotasi -90° di sumbu Y ini sudah dicek langsung dari geometri
// aslinya (proyeksi vertex model, bukan tebakan visual) dan menghasilkan
// teks yang terbaca tegak & benar: G-O-L-E-M dari kiri ke kanan.
// ----------------------------------------------------------------------------
const HEADLINE_MODEL_ROTATION = [0, -Math.PI / 2, 0]

// ----------------------------------------------------------------------------
// AUTO-FIT — menggantikan cara lama (atur scale & posisi manual dalam world
// unit, gampang bikin bingung & gampang salah per ukuran layar). Di sini
// Anda cukup atur "berapa persen dari layar" yang ingin diisi model, sisanya
// dihitung otomatis dari bounding box asli model + ukuran viewport saat ini
// (responsif, ikut berubah saat resize).
//
// Scale final = MIN(scale berbasis lebar, scale berbasis tinggi) — supaya
// model TIDAK PERNAH overflow/kepotong di salah satu sisi.
// ----------------------------------------------------------------------------
const HEADLINE_FIT_WIDTH_FRACTION = 0.70    // Desktop: maksimal 70% lebar viewport
const HEADLINE_FIT_HEIGHT_FRACTION = 0.32   // Desktop: maksimal 32% tinggi viewport

const HEADLINE_FIT_WIDTH_FRACTION_MOBILE = 0.82
const HEADLINE_FIT_HEIGHT_FRACTION_MOBILE = 0.16

// Pengali TAMBAHAN di atas hasil auto-fit di atas — ini "tombol scale manual"
// yang Anda cari. 1 = ukuran hasil auto-fit apa adanya. 1.1 = 10% lebih besar,
// 0.9 = 10% lebih kecil, dst. Auto-fit tetap menjaga model tidak overflow;
// angka ini cuma memperbesar/memperkecil dari hasil itu.
const HEADLINE_MODEL_SCALE = 0.7        // Desktop
const HEADLINE_MODEL_SCALE_MOBILE = 1 // Mobile

// Geser posisi akhir dari titik tengah layar, dalam FRAKSI viewport
// (0 = tengah layar, +Y = naik ke atas, -Y = turun ke bawah). Nilai di bawah
// meniru posisi teks lama yang berada di dekat atas layar (dulu: top: 6vh).
const HEADLINE_OFFSET_FRACTION = [0, 0.32, 0]         // [x, y, z] Desktop
const HEADLINE_OFFSET_FRACTION_MOBILE = [0, 0.36, 0]  // [x, y, z] Mobile

// Kamera canvas headline ini (terpisah dari kamera terrain & golem)
const HEADLINE_CAMERA_POSITION = [0, 0, 5]
const HEADLINE_CAMERA_FOV = 40

// Auto-rotate halus di sumbu Y tambahan (radian/detik) — isi 0 untuk mematikan
const HEADLINE_AUTOROTATE_SPEED = 0

// Bloom/glow opsional pada model
const HEADLINE_BLOOM_ENABLED = true
const HEADLINE_BLOOM_INTENSITY = 10.5
const HEADLINE_BLOOM_THRESHOLD = 10.4
const HEADLINE_BLOOM_SMOOTHING = 10
const HEADLINE_BLOOM_RADIUS = 10

// Pencahayaan (Lighting) untuk model headline
const HEADLINE_LIGHTS = {
  ambient: { color: '#ffffff', intensity: 0 },
  key: { color: '#fffef5', position: [4, 4, 3], intensity: 2.2 },
  fill: { color: '#bae6fd', position: [-3, 1, 2], intensity: 1.2 },
  rim: { color: '#fef08a', position: [0, 4, -2], intensity: 1.4 },
}

function TextGolemModel({ isMobile }) {
  const { scene } = useGLTF(HEADLINE_MODEL_PATH)
  const groupRef = useRef()
  const { viewport } = useThree()

  // Hitung ulang scale & posisi setiap kali ukuran viewport berubah (resize,
  // rotate device, dsb) atau saat isMobile berpindah — supaya model SELALU
  // pas mengisi persentase layar yang diminta, di ukuran layar berapa pun.
  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return

    // Reset dulu supaya bounding box diukur dari kondisi "netral"
    // (rotasi tetap terpasang dari JSX, scale 1, posisi 0).
    g.scale.set(1, 1, 1)
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(g)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const widthFraction = isMobile ? HEADLINE_FIT_WIDTH_FRACTION_MOBILE : HEADLINE_FIT_WIDTH_FRACTION
    const heightFraction = isMobile ? HEADLINE_FIT_HEIGHT_FRACTION_MOBILE : HEADLINE_FIT_HEIGHT_FRACTION
    const offsetFraction = isMobile ? HEADLINE_OFFSET_FRACTION_MOBILE : HEADLINE_OFFSET_FRACTION
    const manualScale = isMobile ? HEADLINE_MODEL_SCALE_MOBILE : HEADLINE_MODEL_SCALE

    const scaleByWidth = (viewport.width * widthFraction) / size.x
    const scaleByHeight = (viewport.height * heightFraction) / size.y
    const scale = Math.min(scaleByWidth, scaleByHeight) * manualScale

    g.scale.setScalar(scale)
    g.position.set(
      -center.x * scale + viewport.width * offsetFraction[0],
      -center.y * scale + viewport.height * offsetFraction[1],
      -center.z * scale + viewport.width * offsetFraction[2]
    )
  }, [scene, viewport.width, viewport.height, isMobile])

  useFrame((_, delta) => {
    if (HEADLINE_AUTOROTATE_SPEED !== 0 && groupRef.current) {
      groupRef.current.rotation.y += HEADLINE_AUTOROTATE_SPEED * delta
    }
  })

  return (
    <group ref={groupRef} rotation={HEADLINE_MODEL_ROTATION}>
      <primitive object={scene} />
    </group>
  )
}

export default function HeadlineModel({ isMobile = false }) {
  return (
    <Canvas
      className="app-headline-canvas"
      camera={{ position: HEADLINE_CAMERA_POSITION, fov: HEADLINE_CAMERA_FOV }}
      dpr={isMobile ? [1, 1.25] : [1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <ambientLight color={HEADLINE_LIGHTS.ambient.color} intensity={HEADLINE_LIGHTS.ambient.intensity} />
      <directionalLight
        position={HEADLINE_LIGHTS.key.position}
        color={HEADLINE_LIGHTS.key.color}
        intensity={HEADLINE_LIGHTS.key.intensity}
      />
      <directionalLight
        position={HEADLINE_LIGHTS.fill.position}
        color={HEADLINE_LIGHTS.fill.color}
        intensity={HEADLINE_LIGHTS.fill.intensity}
      />
      <directionalLight
        position={HEADLINE_LIGHTS.rim.position}
        color={HEADLINE_LIGHTS.rim.color}
        intensity={HEADLINE_LIGHTS.rim.intensity}
      />

      <Suspense fallback={null}>
        <TextGolemModel isMobile={isMobile} />
      </Suspense>

      {HEADLINE_BLOOM_ENABLED && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={HEADLINE_BLOOM_INTENSITY}
            luminanceThreshold={HEADLINE_BLOOM_THRESHOLD}
            luminanceSmoothing={HEADLINE_BLOOM_SMOOTHING}
            radius={HEADLINE_BLOOM_RADIUS}
          />
        </EffectComposer>
      )}
    </Canvas>
  )
}

useGLTF.preload(HEADLINE_MODEL_PATH)
