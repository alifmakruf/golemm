import { Suspense, useCallback, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import GolemModel from './GolemModel.jsx'
import './GolemDetail.css'

const MODEL_SCALE = 1.7
const MODEL_POSITION = [0, 0, 0]
const MODEL_BASE_ROTATION = [0, 0, 0]
const CAMERA_POSITION = [0, 0, 3.5]
const CAMERA_FOV = 35

const COMPOSITION_CARDS = [
  // Left side
  {
    id: 1,
    title: 'Kepala Atas',
    description: 'Struktur kepala bagian atas dengan detail wajah yang tajam',
    specs: ['1,247 vertices', 'Batu Keras'],
    side: 'left',
  },
  {
    id: 2,
    title: 'Mulut Bawah',
    description: 'Bagian rahang dan mulut dengan ekspresi intens',
    specs: ['438 vertices', 'Material Keras'],
    side: 'left',
  },
  {
    id: 3,
    title: 'Struktur Wajah',
    description: 'Framework dasar yang membentuk karakter utama',
    specs: ['892 vertices', 'Stone Body'],
    side: 'left',
  },
  // Right side
  {
    id: 4,
    title: 'Mata & Alis',
    description: 'Fitur wajah dengan efek glow biru yang bernapas',
    specs: ['284 vertices', 'Emissive Glow'],
    side: 'right',
  },
  {
    id: 5,
    title: 'Detail Tekstur',
    description: 'Permukaan dengan kedalaman visual yang realistis',
    specs: ['4K Normal Map', 'High Detail'],
    side: 'right',
  },
  {
    id: 6,
    title: 'Pencahayaan',
    description: 'Multi-light setup untuk efek 3D dramatic',
    specs: ['3 Light Sources', 'Dynamic Shadow'],
    side: 'right',
  },
]

export default function GolemDetail({ onBack }) {
  const mouse = useRef({ x: 0, y: 0, active: false })
  const canvasContainerRef = useRef(null)
  const [isBreakdown, setIsBreakdown] = useState(false)
  const [breakdownSeparation, setBreakdownSeparation] = useState(30)
  const [showSeparationControl, setShowSeparationControl] = useState(false)

  const handlePointerMove = useCallback((event) => {
    if (isBreakdown) return // Disable tracking saat breakdown mode
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect()
      let x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      let y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      mouse.current.x = Math.max(-1, Math.min(1, x))
      mouse.current.y = Math.max(-1, Math.min(1, y))
    }
  }, [isBreakdown])

  const handleCanvasPointerEnter = useCallback(() => {
    if (!isBreakdown) mouse.current.active = true
  }, [isBreakdown])

  const handleCanvasPointerLeave = useCallback(() => {
    mouse.current.active = false
  }, [])

  const toggleBreakdown = useCallback(() => {
    setIsBreakdown(prev => !prev)
    mouse.current.active = false // Disable raycast saat toggle
  }, [])

  return (
    <section className="golem-detail">
      <div className="golem-detail__backdrop" aria-hidden="true">
        <div className="modern-glow modern-glow--blue" />
        <div className="modern-glow modern-glow--yellow" />
        <div className="modern-grid-pattern" />
      </div>

      {/* Header dengan tombol */}
      <div className="golem-detail__header">
        <button className="btn-back" onClick={onBack} aria-label="Kembali ke hero">
          ← Kembali
        </button>
        <h2 className="golem-detail__title">Komposisi Detail Golem</h2>
        <button className={`btn-breakdown ${isBreakdown ? 'active' : ''}`} onClick={toggleBreakdown}>
          {isBreakdown ? '◉ Mode Breakdown' : '○ Breakdown'}
        </button>
        {isBreakdown && (
          <div className="separation-control">
            <label htmlFor="separation-slider">Distance:</label>
            <input
              id="separation-slider"
              type="range"
              min="10"
              max="60"
              value={breakdownSeparation}
              onChange={(e) => setBreakdownSeparation(Number(e.target.value))}
              className="slider"
            />
            <span className="separation-value">{breakdownSeparation}px</span>
          </div>
        )}
      </div>

      <div className="golem-detail__content">
        {/* Left Cards */}
        <div className="golem-detail__cards golem-detail__cards--left">
          {COMPOSITION_CARDS.filter(c => c.side === 'left').map(card => (
            <div key={card.id} className="composition-card">
              <div className="composition-card__header">
                <h3 className="composition-card__title">{card.title}</h3>
              </div>
              <p className="composition-card__description">{card.description}</p>
              <div className="composition-card__specs">
                {card.specs.map((spec, i) => (
                  <div key={i} className="spec-item">
                    <span className="spec-dot" />
                    <span className="spec-text">{spec}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas - Golem di tengah */}
        <div className="golem-detail__canvas-wrapper">
          <div 
            className="golem-detail__canvas-container"
            ref={canvasContainerRef}
            onPointerMove={handlePointerMove}
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
                  breakdownDistance={breakdownSeparation}
                />
              </Suspense>
            </Canvas>
          </div>
        </div>

        {/* Right Cards */}
        <div className="golem-detail__cards golem-detail__cards--right">
          {COMPOSITION_CARDS.filter(c => c.side === 'right').map(card => (
            <div key={card.id} className="composition-card">
              <div className="composition-card__header">
                <h3 className="composition-card__title">{card.title}</h3>
              </div>
              <p className="composition-card__description">{card.description}</p>
              <div className="composition-card__specs">
                {card.specs.map((spec, i) => (
                  <div key={i} className="spec-item">
                    <span className="spec-dot" />
                    <span className="spec-text">{spec}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown info */}
      {isBreakdown && (
        <div className="breakdown-info">
          <span className="breakdown-icon">⚙️</span>
          Mode Breakdown Aktif - Interaktif dan animasi nonaktif
        </div>
      )}
    </section>
  )
}
