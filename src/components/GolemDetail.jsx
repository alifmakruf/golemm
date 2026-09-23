import { Suspense, useCallback, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import GolemModel from './GolemModel.jsx'
import './GolemDetail.css'

// ---- Tuning ----
const MODEL_SCALE = 1.0
const MODEL_POSITION = [0, 0, 0]
const MODEL_BASE_ROTATION = [0, 0, 0]
const CAMERA_POSITION = [0, 0, 4.5]
const CAMERA_FOV = 35

// ---- Parallax sensitivity per layer ----
const PARALLAX_CANVAS = 5     // canvas golem bergerak sedikit
const PARALLAX_INFO = 10      // info panel bergerak lebih banyak
const PARALLAX_HEADER = 3     // header bergerak paling sedikit
const PARALLAX_BG = 15        // background glow paling banyak

// ---- Mesh info untuk panel kanan ----
const MESH_INFO = {
  kepalaatas: {
    title: 'Kepala Atas',
    subtitle: 'Upper Head Structure',
    description: 'Bagian atas kepala golem yang membentuk mahkota alami dari batu. Permukaan kasar memberi kesan kekuatan dan usia tua.',
    specs: ['1,247 vertices', 'Batu Keras', 'Translation keyframe'],
  },
  mulutbawah: {
    title: 'Mulut Bawah',
    subtitle: 'Lower Jaw Section',
    description: 'Rahang bawah yang terpisah dari bagian atas. Memiliki animasi keyframe translation untuk gerakan "bicara" halus.',
    specs: ['438 vertices', 'Material Keras', 'Animated jaw'],
  },
  alis: {
    title: 'Alis',
    subtitle: 'Brow Ridge',
    description: 'Struktur alis yang membentuk ekspresi wajah golem. Memiliki animasi keyframe yang memberikan kesan "hidup" pada karakter.',
    specs: ['892 vertices', 'Stone Body', 'Shape key ready'],
  },
  matakanan: {
    title: 'Mata Kanan',
    subtitle: 'Right Eye',
    description: 'Bola mata dengan efek emissive glow biru yang bernapas. Mengikuti pergerakan kursor secara real-time.',
    specs: ['142 vertices', 'Emissive Glow', 'Cursor tracking'],
  },
  matakiri: {
    title: 'Mata Kiri',
    subtitle: 'Left Eye',
    description: 'Pasangan mata kiri dengan efek yang identik. Sinkron dengan mata kanan untuk tracking kursor yang natural.',
    specs: ['142 vertices', 'Emissive Glow', 'Cursor tracking'],
  },
}

export default function GolemDetail({ onBack }) {
  const mouse = useRef({ x: 0, y: 0, active: false })
  const canvasContainerRef = useRef(null)
  const sectionRef = useRef(null)
  const [isBreakdown, setIsBreakdown] = useState(false)
  const [hoveredMesh, setHoveredMesh] = useState(null)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })

  // Parallax + mouse tracking
  const handlePointerMove = useCallback((e) => {
    // Parallax dari posisi mouse relatif ke section
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect()
      const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      setParallax({ x: px, y: py })
    }

    // Mouse tracking untuk golem model (hanya saat bukan breakdown)
    if (!isBreakdown && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect()
      mouse.current.x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      mouse.current.y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
    }

    // Canvas tracking untuk breakdown hover detection
    if (isBreakdown && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect()
      mouse.current.x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      mouse.current.y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
    }
  }, [isBreakdown])

  const handleCanvasPointerEnter = useCallback(() => {
    mouse.current.active = true
  }, [])

  const handleCanvasPointerLeave = useCallback(() => {
    mouse.current.active = false
    if (isBreakdown) setHoveredMesh(null)
  }, [isBreakdown])

  const toggleBreakdown = useCallback(() => {
    setIsBreakdown(prev => !prev)
    setHoveredMesh(null)
    mouse.current.active = false
  }, [])

  const activeInfo = hoveredMesh && MESH_INFO[hoveredMesh] ? MESH_INFO[hoveredMesh] : null

  return (
    <section className="golem-detail" ref={sectionRef} onPointerMove={handlePointerMove}>
      {/* Backdrop parallax */}
      <div
        className="golem-detail__backdrop"
        aria-hidden="true"
        style={{ transform: `translate(${parallax.x * PARALLAX_BG}px, ${parallax.y * PARALLAX_BG}px)` }}
      >
        <div className="modern-glow modern-glow--blue" />
        <div className="modern-glow modern-glow--yellow" />
        <div className="modern-grid-pattern" />
      </div>

      {/* Header parallax */}
      <div
        className="golem-detail__header"
        style={{ transform: `translateX(${parallax.x * PARALLAX_HEADER}px)` }}
      >
        <button className="btn-back" onClick={onBack} aria-label="Kembali ke hero">
          ← Kembali
        </button>
        <h2 className="golem-detail__title">Breakdown Golem</h2>
        <button className={`btn-breakdown ${isBreakdown ? 'active' : ''}`} onClick={toggleBreakdown}>
          {isBreakdown ? '◉ Mode Breakdown' : '○ Breakdown'}
        </button>
      </div>

      {/* Main content: canvas + info panel */}
      <div className="golem-detail__content">
        {/* Canvas area */}
        <div
          className="golem-detail__canvas-wrapper"
          style={{ transform: `translate(${parallax.x * -PARALLAX_CANVAS}px, ${parallax.y * -PARALLAX_CANVAS}px)` }}
        >
          <div
            className="golem-detail__canvas-container"
            ref={canvasContainerRef}
            onPointerEnter={handleCanvasPointerEnter}
            onPointerLeave={handleCanvasPointerLeave}
          >
            <Canvas
              camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
            >
              <ambientLight color="#ffffff" intensity={1.2} />
              <directionalLight position={[4, 4, 3]} color="#fffef5" intensity={2.8} />
              <directionalLight position={[-3, 1, 2]} color="#bae6fd" intensity={1.6} />
              <directionalLight position={[0, 4, -2]} color="#fef08a" intensity={1.8} />

              <Suspense fallback={null}>
                <GolemModel
                  mouse={mouse}
                  modelScale={MODEL_SCALE}
                  modelPosition={MODEL_POSITION}
                  baseRotation={MODEL_BASE_ROTATION}
                  onModelClick={null}
                  breakdownMode={isBreakdown}
                  breakdownDistance={30}
                  onMeshHover={isBreakdown ? setHoveredMesh : null}
                  hoveredMesh={hoveredMesh}
                />
              </Suspense>
            </Canvas>
          </div>
        </div>

        {/* Info panel kanan — muncul saat breakdown */}
        <div
          className={`golem-detail__info ${isBreakdown ? 'golem-detail__info--visible' : ''}`}
          style={{ transform: `translate(${parallax.x * PARALLAX_INFO}px, ${parallax.y * PARALLAX_INFO}px)` }}
        >
          {activeInfo ? (
            <div className="info-card info-card--active" key={hoveredMesh}>
              <div className="info-card__header">
                <h3 className="info-card__title">{activeInfo.title}</h3>
                <span className="info-card__subtitle">{activeInfo.subtitle}</span>
              </div>
              <p className="info-card__description">{activeInfo.description}</p>
              <div className="info-card__specs">
                {activeInfo.specs.map((spec, i) => (
                  <div key={i} className="spec-item">
                    <span className="spec-dot" />
                    <span className="spec-text">{spec}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="info-card info-card--empty">
              <div className="info-card__icon">🔍</div>
              <p className="info-card__hint">Hover pada bagian golem untuk melihat detail komponen</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
