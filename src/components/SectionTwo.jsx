import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import './style/SectionTwo.css'

// ============================================================================
// PARAMETER TUNING: SECTION 2 (EDITORIAL FULL-TEXT TYPOGRAPHY)
// ============================================================================

// 1. Sinkronisasi Kamera & Transisi Antar Section
const CAMERA_ARRIVE_DELAY_MS = 700      // Jeda (ms) menunggu perpindahan kamera 3D selesai baru teks masuk
const SECTION_EXIT_DELAY_MS = 600       // Durasi (ms) menunggu animasi teks keluar selesai baru pindah section

// 2. Durasi Animasi Masuk & Keluar (Smooth & Friendly)
const ENTRANCE_DURATION = '0.85s'       // Kecepatan animasi teks meluncur masuk
const EXIT_DURATION = '0.55s'           // Kecepatan animasi teks meluncur keluar
const STAGGER_DELAY = '0.16s'           // Jeda waktu antara Topik 1 dan Topik 2

// 3. Jarak Luncur Animasi (Slide Offset)
const SLIDE_DISTANCE_PX = 28            // Jarak geser halus saat muncul/keluar (px)

// 4. Efek Interaktif Mouse Parallax
const PARALLAX_ENABLED = true           // Aktifkan parallax kursor mouse di desktop
const PARALLAX_STRENGTH_X = 12          // Maksimum geser horizontal teks mengikuti kursor (px)
const PARALLAX_STRENGTH_Y = 8           // Maksimum geser vertikal teks mengikuti kursor (px)

// ============================================================================
// PARAMETER TUNING: PENERANGAN KURSOR (INVISIBLE RADIUS SPOTLIGHT REVEAL)
// ============================================================================
// Radius kursor transparan (tidak ada garis lingkaran visual), bertindak sebagai
// lampu sorot tak terlihat yang menerangi teks hanya pada bagian yang terkena radius.
// ============================================================================
const SPOTLIGHT_RADIUS_PX = 130         // Radius jangkauan penerangan kursor (px) — atur besar/kecilnya di sini
const SPOTLIGHT_CORE_PERCENT = 35       // Persentase area pusat cahaya yang paling terang penuh (%)

// Warna & Outline Teks Saat Diterangi Radius:
const LIT_TEXT_COLOR = '#ff7070ff'        // Warna isi teks saat terkena cahaya radius
const LIT_OUTLINE_COLOR_T1 = '#ff0000ff'  // Warna outline teks Topik 1 (Cyan)
const LIT_OUTLINE_COLOR_T2 = '#ff0000ff'  // Warna outline teks Topik 2 (Gold)
const LIT_OUTLINE_WIDTH = '.2px'       // Ketebalan outline teks (stroke)
const LIT_GLOW_SPREAD = '0 0 2px'      // Kekuatan pendaran cahaya glow di sekitar outline

// Komponen Pembantu: Teks Editorial Topik 1 & 2
function EditorialContent({ animClass, topic1Transform, topic2Transform, animKey, isLit = false }) {
  return (
    <>
      {/* TOPIK 1: Pojok Kiri Atas (Latar Belakang) */}
      <div
        key={`topic-1-${animKey}-${isLit ? 'lit' : 'base'}`}
        className={`topic-block topic-block--top-left ${animClass} ${isLit ? 'topic-block--lit' : ''}`}
        style={{ transform: topic1Transform }}
      >
        <div className="topic-kicker">
          <span className="topic-kicker__label">TENTANG GOLEM.INC</span>
        </div>

        <h2 className="topic-headline">
          Latar <span className="topic-headline__accent">Belakang</span>
        </h2>

        <h3 className="topic-subheadline">Kisah Terciptanya Sang WebGL Builder</h3>

        <p className="topic-paragraph">
          GOLEM.inc adalah inisiatif eksplorasi teknologi 3D WebGL modern.
          Dimulai pada tahun 2024, berfokus menciptakan pengalaman web imersif yang
          interaktif, artistik, dan responsif — terutama pada integrasi visual real-time dan IoT.
        </p>

        <div className="topic-tags">
          <span className="topic-tag">Inti Bebatuan Purba</span>
          <span className="topic-tag">Kristalisasi Abadi</span>
          <span className="topic-tag">Penjaga Pegunungan</span>
        </div>
      </div>

      {/* TOPIK 2: Pojok Kanan Bawah (Tujuan & Visi) */}
      <div
        key={`topic-2-${animKey}-${isLit ? 'lit' : 'base'}`}
        className={`topic-block topic-block--bottom-right ${animClass} ${isLit ? 'topic-block--lit' : ''}`}
        style={{ transform: topic2Transform }}
      >
        <div className="topic-kicker topic-kicker--gold">
          <span className="topic-kicker__label">VISI & TUJUAN</span>
        </div>

        <h2 className="topic-headline">
          Tujuan & <span className="topic-headline__accent topic-headline__accent--gold">Visi</span>
        </h2>

        <h3 className="topic-subheadline">Harmonisasi WebGL & Pengalaman 3D</h3>

        <p className="topic-paragraph">
          Mendemonstrasikan perpaduan teknologi 3D WebGL modern dan estetika visual website tingkat tinggi.
          Menghadirkan eksplorasi karakter interaktif, pencahayaan atmosferik dinamis, serta simulasi cuaca
          yang stabil 60 FPS dan ringan tanpa kompromi kualitas visual.
        </p>

        <div className="topic-tags">
          <span className="topic-tag topic-tag--highlight">WebGL 60 FPS</span>
          <span className="topic-tag">Interaktif Parallax</span>
          <span className="topic-tag">Sinematik Bloom</span>
        </div>
      </div>
    </>
  )
}

const SectionTwo = forwardRef(function SectionTwo({ onBack, onNext, isVisible }, ref) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const stageRef = useRef(null)

  // State sinkronisasi: teks baru siap (ready) SETELAH transisi kamera selesai
  const [isReady, setIsReady] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [canParallax, setCanParallax] = useState(false)

  const timerRef = useRef(null)
  const parallaxTimerRef = useRef(null)

  useEffect(() => {
    if (isVisible) {
      setIsExiting(false)
      setIsReady(false)
      setCanParallax(false)
      setMousePos({ x: 0, y: 0 })

      // TUNGGU kamera 3D selesai bergerak zoom in ke gunung, baru animasi teks dimainkan
      timerRef.current = setTimeout(() => {
        setIsReady(true)
        setAnimKey((prev) => prev + 1)

        parallaxTimerRef.current = setTimeout(() => {
          setCanParallax(true)
        }, 900)
      }, CAMERA_ARRIVE_DELAY_MS)
    } else {
      setIsReady(false)
      setIsExiting(false)
      setCanParallax(false)
      setMousePos({ x: 0, y: 0 })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (parallaxTimerRef.current) clearTimeout(parallaxTimerRef.current)
    }
  }, [isVisible])

  // Handler tombol / scroll Back
  const handleBack = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setIsReady(false)
    setCanParallax(false)

    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onBack) onBack()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onBack])

  // Handler tombol / scroll Next
  const handleNext = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setIsReady(false)
    setCanParallax(false)

    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onNext) onNext()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onNext])

  useImperativeHandle(ref, () => ({
    next: handleNext,
    back: handleBack,
  }), [handleNext, handleBack])

  const showSection = isVisible || isExiting

  // Update Posisi Kursor & Spotlight Mask (Performa 60-120 FPS tanpa re-render React)
  useEffect(() => {
    if (!isVisible || isExiting) return

    let rafId = null

    const handlePointerMove = (e) => {
      const clientX = e.clientX
      const clientY = e.clientY

      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null

        // 1. Update posisi spotlight mask pada container stage secara instan di GPU
        if (stageRef.current) {
          stageRef.current.style.setProperty('--mouse-x', `${clientX}px`)
          stageRef.current.style.setProperty('--mouse-y', `${clientY}px`)
        }

        // 2. Update parallax kursor mouse
        if (PARALLAX_ENABLED && canParallax) {
          const x = (clientX / window.innerWidth) * 2 - 1
          const y = (clientY / window.innerHeight) * 2 - 1
          setMousePos({ x, y })
        }
      })
    }

    const handlePointerLeave = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (stageRef.current) {
        // Pindahkan spotlight keluar layar saat mouse meninggalkan window
        stageRef.current.style.setProperty('--mouse-x', '-9999px')
        stageRef.current.style.setProperty('--mouse-y', '-9999px')
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('mouseleave', handlePointerLeave)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('mouseleave', handlePointerLeave)
    }
  }, [isVisible, isExiting, canParallax])

  const animClass = isExiting
    ? 'topic-block--exit'
    : isReady
      ? 'topic-block--play'
      : ''

  const topic1Transform = PARALLAX_ENABLED && canParallax
    ? `translate3d(${mousePos.x * -PARALLAX_STRENGTH_X}px, ${mousePos.y * -PARALLAX_STRENGTH_Y}px, 0)`
    : 'none'

  const topic2Transform = PARALLAX_ENABLED && canParallax
    ? `translate3d(${mousePos.x * PARALLAX_STRENGTH_X * 0.8}px, ${mousePos.y * PARALLAX_STRENGTH_Y * 0.8}px, 0)`
    : 'none'

  return (
    <section
      className={`section-two section-two-editorial ${showSection ? 'section-two-editorial--visible' : ''}`}
      ref={stageRef}
      style={{
        '--slide-dist': `${SLIDE_DISTANCE_PX}px`,
        '--enter-dur': ENTRANCE_DURATION,
        '--exit-dur': EXIT_DURATION,
        '--stagger-delay': STAGGER_DELAY,
        '--spotlight-radius': `${SPOTLIGHT_RADIUS_PX}px`,
        '--spotlight-core': `${SPOTLIGHT_CORE_PERCENT}%`,
        '--s2-lit-color': LIT_TEXT_COLOR,
        '--s2-lit-outline-t1': LIT_OUTLINE_COLOR_T1,
        '--s2-lit-outline-t2': LIT_OUTLINE_COLOR_T2,
        '--s2-lit-outline-width': LIT_OUTLINE_WIDTH,
        '--s2-lit-glow-spread': LIT_GLOW_SPREAD,
      }}
    >
      {/* LAYER 1: Teks Normal (Base Layer) */}
      <div className="editorial-layer editorial-layer--base">
        <EditorialContent
          animClass={animClass}
          topic1Transform={topic1Transform}
          topic2Transform={topic2Transform}
          animKey={animKey}
          isLit={false}
        />
      </div>

      {/* LAYER 2: Teks Bersinar dengan Outline & Warna yang Diterangi Radius Kursor
          Radius kursor ini TRANSPARAN (tidak ada garis visual), hanya menyinari teks via radial mask */}
      <div className="editorial-layer editorial-layer--lit" aria-hidden="true">
        <EditorialContent
          animClass={animClass}
          topic1Transform={topic1Transform}
          topic2Transform={topic2Transform}
          animKey={animKey}
          isLit={true}
        />
      </div>
    </section>
  )
})

export default SectionTwo