import { Suspense, useCallback, useRef, useState } from 'react'
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

// ================== Parallax sensitivity ==================
// Hanya untuk canvas golem — satuan px
const PARALLAX_CANVAS = 6 // canvas golem bergerak saat mouse move

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

export default function GolemHero({ onExplore }) {
  const mouse = useRef({ x: 0, y: 0, active: false })
  const canvasContainerRef = useRef(null)
  const sectionRef = useRef(null)
  const [debris, setDebris] = useState([])
  const [parallax, setParallax] = useState({ x: 0, y: 0 })

  const handlePointerMove = useCallback((event) => {
    // Mouse relative ke canvas → untuk raycasting golem
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect()
      mouse.current.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
      mouse.current.y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
    }
    // Mouse relatif ke seluruh section → untuk parallax CSS
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2  // -1..1
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2  // -1..1
      setParallax({ x: px, y: py })
    }
  }, [])

  // Event listener khusus untuk canvas - cek apakah kursor di area model
  const handleCanvasPointerEnter = useCallback(() => {
    mouse.current.active = true
  }, [])

  const handleCanvasPointerLeave = useCallback(() => {
    mouse.current.active = false
  }, [])

  const handleModelClick = useCallback(() => {
    if (!sectionRef.current) return

    // Tambah class shake
    sectionRef.current.classList.add('shake-active')

    // Spawn debris particles
    const newDebris = Array.from({ length: 12 }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100, // posisi horizontal random 0-100%
      delay: Math.random() * 0.1, // delay 0-100ms
      duration: 1.2 + Math.random() * 0.4, // duration 1.2-1.6s
      size: 4 + Math.random() * 8, // ukuran krikil 4-12px
      angle: Math.random() * 360, // rotasi random
    }))

    setDebris(prev => [...prev, ...newDebris])

    // Hapus debris setelah animasi selesai
    setTimeout(() => {
      setDebris(prev =>
        prev.filter(d => !newDebris.some(nd => nd.id === d.id))
      )
    }, 2000)

    // Hapus class shake setelah animasi selesai (600ms)
    setTimeout(() => {
      sectionRef.current?.classList.remove('shake-active')
    }, 600)
  }, [])

  return (
    <section className="golem-hero" ref={sectionRef} onPointerMove={handlePointerMove}>
      {/* Falling debris/krikil */}
      <div className="debris-container">
        {debris.map(d => (
          <div
            key={d.id}
            className="debris-particle"
            style={{
              left: `${d.left}%`,
              '--animation-delay': `${d.delay}s`,
              '--animation-duration': `${d.duration}s`,
              '--particle-size': `${d.size}px`,
              '--particle-angle': `${d.angle}deg`,
            }}
          />
        ))}
      </div>

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
          style={{ transform: `translate(${parallax.x * -PARALLAX_CANVAS}px, ${parallax.y * -PARALLAX_CANVAS}px)` }}
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
                onModelClick={handleModelClick}
              />
            </Suspense>
          </Canvas>
        </div>

        <div className="golem-hero__content-right">
          {/* <div className="hero-badge">
            <span className="hero-badge__dot" />
            <span>follow cursor interactive</span>
          </div> */}

          <h1 className="hero-title">
            Stone
            <span className="text-gradient"> Golem</span>
          </h1>

          {/* <p className="hero-subtitle">
            cursor interaktif dengan keyframe animasi kedip sederhana menggunakan shape keys di blender agar objek tampak lebih hidup
          </p> */}

          <div className="hero-actions">
            <button className="btn-primary" type="button" onClick={onExplore}>
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
