import { Suspense, useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import GolemModel from './GolemModel.jsx'
import './GolemHero.css'

// ================== Kontrol transform & kamera ==================
// Panel "Location / Rotation / Scale" ala Blender, tapi untuk React.
// Ubah angka-angka ini untuk mengatur ukuran, posisi, dan orientasi
// golem di dalam scene, tanpa perlu menyentuh logika animasi.
const MODEL_SCALE = 1.7 // ukuran keseluruhan model
const MODEL_POSITION = [-0.4, 0.1, 0] // tepat di tengah kolom kiri
const MODEL_BASE_ROTATION = [0.05, 0.35, 0] // menoleh sedikit ke arah teks hero di kanan
const CAMERA_POSITION = [0, 0, 3.4] // [x, y, z] posisi kamera
const CAMERA_FOV = 35 // field of view kamera (derajat)

// ================== Parameter Pencahayaan (Lighting) ==================
// Atur warna, posisi [x, y, z], dan intensitas masing-masing lampu di sini.
const LIGHTS = {
  ambient: {
    color: '#ffffff',
    intensity: 1.2,
  },
  // Lampu utama (key light): menerangi bentuk & tekstur batu
  key: {
    color: '#fffef5',
    position: [4, 4, 3],
    intensity: 2.8,
  },
  // Lampu pengisi (fill light): aksen biru langit lembut
  fill: {
    color: '#bae6fd',
    position: [-3, 1, 2],
    intensity: 1.6,
  },
  // Lampu siluet / rim: aksen hangat kuning lembut
  rim: {
    color: '#fef08a',
    position: [0, 4, -2],
    intensity: 1.8,
  },
}

export default function GolemHero() {
  const mouse = useRef({ x: 0, y: 0, active: false })
  const canvasContainerRef = useRef(null)

  const handlePointerMove = useCallback((event) => {
    // Hitung mouse position RELATIVE KE CANVAS (bukan section)
    // Ini penting untuk akurasi raycasting
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect()
      let x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      let y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      
      // Clamp ke range canvas (-1 sampai 1) untuk smooth edge tracking
      mouse.current.x = Math.max(-1, Math.min(1, x))
      mouse.current.y = Math.max(-1, Math.min(1, y))
    }
  }, [])

  // Event listener khusus untuk canvas - cek apakah kursor di area model
  const handleCanvasPointerEnter = useCallback(() => {
    mouse.current.active = true
  }, [])

  const handleCanvasPointerLeave = useCallback(() => {
    mouse.current.active = false
  }, [])

  return (
    <section className="golem-hero" onPointerMove={handlePointerMove}>
      <div className="golem-hero__backdrop" aria-hidden="true">
        <div className="modern-glow modern-glow--blue" />
        <div className="modern-glow modern-glow--yellow" />
        <div className="modern-grid-pattern" />
      </div>

      <div className="golem-hero__content">
        <div 
          className="golem-hero__canvas-container" 
          ref={canvasContainerRef}
          onPointerEnter={handleCanvasPointerEnter} 
          onPointerLeave={handleCanvasPointerLeave}
        >
          <Canvas
            camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
          >

            <ambientLight color={LIGHTS.ambient.color} intensity={LIGHTS.ambient.intensity} />
            <directionalLight
              position={LIGHTS.key.position}
              color={LIGHTS.key.color}
              intensity={LIGHTS.key.intensity}
            />
            <directionalLight
              position={LIGHTS.fill.position}
              color={LIGHTS.fill.color}
              intensity={LIGHTS.fill.intensity}
            />
            <directionalLight
              position={LIGHTS.rim.position}
              color={LIGHTS.rim.color}
              intensity={LIGHTS.rim.intensity}
            />

            <Suspense fallback={null}>
              <GolemModel
                mouse={mouse}
                modelScale={MODEL_SCALE}
                modelPosition={MODEL_POSITION}
                baseRotation={MODEL_BASE_ROTATION}
              />
            </Suspense>
          </Canvas>
        </div>

        <div className="golem-hero__content-right">
          <div className="hero-badge">
            <span className="hero-badge__dot" />
            <span>follow cursor interactive</span>
          </div>

          <h1 className="hero-title">
            Stone
            <span className="text-gradient"> Golem</span>
          </h1>

          <p className="hero-subtitle">
            cursor interaktif dengan keyframe animasi kedip sederhana menggunakan shape keys di blender agar objek tampak lebih hidup
          </p>

          <div className="hero-actions">
            <button className="btn-primary" type="button">
              Jelajahi Sekarang →
            </button>
            {/* <button className="btn-secondary" type="button">
              Lihat Demo
            </button> */}
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-card__val">60 FPS</span>
              <span className="stat-card__lbl">Smooth Physics</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__val">Real-time</span>
              <span className="stat-card__lbl">Cursor Tracking</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__val">R3F + Drei</span>
              <span className="stat-card__lbl">Web Tech</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
