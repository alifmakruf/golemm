import { useState, useCallback, useRef, useEffect } from 'react'
import './style/SectionTwo.css'

// ================== Tuning Parameter: Section 2 (Latar Belakang & Tujuan) ==================
// Ubah angka & warna di bawah ini sesuka hati untuk menyesuaikan tampilan card 3D:

// 1. Skala ukuran card (0.7 = 70% dari ukuran normal)
const CARD_SCALE = 0.7                  // Ubah angka ini untuk mengatur besar/kecilnya kedua card

// 1b. Transisi Delay Kamera (Menunggu kamera 3D sampai ke Section 2 baru card muncul)
const CAMERA_ARRIVE_DELAY_MS = 750          // Delay (ms) menunggu animasi out Section 1 & zoom kamera selesai
const SECTION_EXIT_DELAY_MS = 750           // Delay (ms) menunggu card Section 2 turun/exit saat pencet Back

// 1c. Animasi Entrance & Exit Card (muncul dari bawah sambil berputar & turun kembali)
const ENTRANCE_TRANSLATE_Y = 220            // Jarak vertikal animasi masuk dari bawah (px)
const EXIT_TRANSLATE_Y = 380                // Jarak vertikal animasi keluar meluncur ke bawah (px)
const ENTRANCE_ROTATE_DEG = 25              // Derajat putaran saat animasi (semakin besar = makin dramatis)
const ENTRANCE_DURATION = '1.2s'            // Durasi animasi masuk (entrance)
const ENTRANCE_STAGGER = '0.2s'             // Jeda waktu antara card 1 dan card 2 saat masuk
const EXIT_DURATION = '0.75s'               // Durasi animasi keluar (exit)
const EXIT_STAGGER = '0.12s'                // Jeda waktu urutan keluar antar card

// 2. Sudut rotasi 3D card menghadap kamera (derajat)
const CARD_ROTATION_Y_DEG = 20          // Card kiri menghadap +20°, kanan -20°
const MOBILE_CARD_ROTATION_Y_DEG = 0    // Di HP/tablet sudut diperkecil agar teks nyaman dibaca

// 3. Sensitivitas efek Parallax mouse (kepekaan gerak)
const PARALLAX_ROTATION_SENSITIVITY = 10 // Derajat tilt ekstra saat kursor digerakkan
const PARALLAX_TRANSLATION_X = 25       // Geser horizontal maksimum card (px)
const PARALLAX_TRANSLATION_Y = 17       // Geser vertikal maksimum card (px)

export default function SectionTwo({ onBack, onNext, isVisible }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const stageRef = useRef(null)

  // State untuk kontrol delay kamera & re-trigger animasi entrance & exit
  const [cardsReady, setCardsReady] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (isVisible) {
      setIsExiting(false)
      // Tunggu kamera zoom in selesai baru tampilkan card & tombol (hanya 1x animasi masuk)
      timerRef.current = setTimeout(() => {
        setCardsReady(true)
        setAnimKey((prev) => prev + 1)
      }, CAMERA_ARRIVE_DELAY_MS)
    } else {
      setCardsReady(false)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isVisible])

  // Handler tombol Back: Mainkan animasi keluar 1 kali bersih, lalu pindah ke Section 1
  const handleBack = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setCardsReady(false)
    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onBack) onBack()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onBack])

  // Handler tombol Next: Mainkan animasi keluar 1 kali bersih, lalu pindah ke Section 3 (tanpa tabrakan)
  const handleNext = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setCardsReady(false)
    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onNext) onNext()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onNext])

  const showSection = isVisible || isExiting

  const entranceClass = isExiting
    ? 'card-entrance--exit'
    : (isVisible && cardsReady)
      ? 'card-entrance--play'
      : ''

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  const handlePointerMove = useCallback((e) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    // Normalisasi -1 sampai 1
    const x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
    const y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
    setMousePos({ x, y })
  }, [])

  const baseAngle = isMobile ? MOBILE_CARD_ROTATION_Y_DEG : CARD_ROTATION_Y_DEG

  // Dynamic parallax rotation & translation dengan scaling
  const leftCardTransform = `
    scale(${CARD_SCALE})
    rotateY(${baseAngle + mousePos.x * PARALLAX_ROTATION_SENSITIVITY}deg)
    rotateX(${-mousePos.y * PARALLAX_ROTATION_SENSITIVITY}deg)
    translate3d(${mousePos.x * -PARALLAX_TRANSLATION_X}px, ${mousePos.y * -PARALLAX_TRANSLATION_Y}px, 20px)
  `

  const rightCardTransform = `
    scale(${CARD_SCALE})
    rotateY(${-baseAngle + mousePos.x * PARALLAX_ROTATION_SENSITIVITY}deg)
    rotateX(${-mousePos.y * PARALLAX_ROTATION_SENSITIVITY}deg)
    translate3d(${mousePos.x * -PARALLAX_TRANSLATION_X}px, ${mousePos.y * -PARALLAX_TRANSLATION_Y}px, 20px)
  `

  return (
    <section
      className={`section-two ${showSection ? 'section-two--visible' : ''}`}
      ref={stageRef}
      onPointerMove={handlePointerMove}
    >
      {/* Efek Garis Angin Kencang (Wind Streaks) saat badai di Section 2 */}
      <div className="wind-overlay" aria-hidden="true">
        <span className="wind-gust wind-gust--1" />
        <span className="wind-gust wind-gust--2" />
        <span className="wind-gust wind-gust--3" />
        <span className="wind-gust wind-gust--4" />
        <span className="wind-gust wind-gust--5" />
      </div>

      {/* Header bar navigasi Section 2 */}
      <header className="section-two__header">
        <button
          className="btn-back"
          type="button"
          onClick={handleBack}
          title="Kembali ke Hero Section"
        >
          <span className="btn-back__arrow">{'<'}</span>
          <span>Back</span>
        </button>
      </header>

      {/* Stage 3D dengan Perspective View */}
      <div className="section-two__stage">
        {/* Card 1: Latar Belakang (Menyerong ke kanan / hadap kamera) */}
        <div
          key={`card-1-${animKey}`}
          className={`card-entrance ${entranceClass}`}
          style={{
            '--entrance-ty': `${ENTRANCE_TRANSLATE_Y}px`,
            '--exit-ty': `${EXIT_TRANSLATE_Y}px`,
            '--entrance-rot': `${ENTRANCE_ROTATE_DEG}deg`,
            '--entrance-dur': ENTRANCE_DURATION,
            '--exit-dur': EXIT_DURATION,
            animationDelay: isExiting ? EXIT_STAGGER : '0s',
          }}
        >
          <article
            className="glass-card glass-card--left"
            style={{ transform: leftCardTransform }}
          >
            <div className="glass-card__specular" />
            <div className="glass-card__rim-glow" />

            <div className="glass-card__inner">
              <div className="card-badge">
                <span className="card-badge__number">01</span>
                <span className="card-badge__text">Tentang GOLEM.inc</span>
              </div>

              <h2 className="card-title">Latar Belakang</h2>
              <h3 className="card-subtitle">Kisah Terciptanya Sang webgl builder</h3>

              <p className="card-paragraph">
                GOLEM.inc adalah perusahaan fiktif yang bergerak di bidang pengembangan teknologi 3D WebGL.
                Dimulai pada tahun 2024, perusahaan ini telah menghasilkan berbagai proyek web 3D
                yang interaktif dan responsif. Terutama pada bidang IoT
              </p>

              <div className="card-tags">
                <span className="card-tag">Inti Bebatuan Purba</span>
                <span className="card-tag">Kristalisasi Abadi</span>
                <span className="card-tag">Penjaga Pegunungan</span>
              </div>
            </div>
          </article>
        </div>

        {/* Kolom 2: Card 2 + Tombol Next di bawahnya */}
        <div className="section-two__col2">
          {/* Card 2: Tujuan (Menyerong ke kiri / hadap kamera) */}
          <div
            key={`card-2-${animKey}`}
            className={`card-entrance ${entranceClass}`}
            style={{
              '--entrance-ty': `${ENTRANCE_TRANSLATE_Y}px`,
              '--exit-ty': `${EXIT_TRANSLATE_Y}px`,
              '--entrance-rot': `-${ENTRANCE_ROTATE_DEG}deg`,
              '--entrance-dur': ENTRANCE_DURATION,
              '--exit-dur': EXIT_DURATION,
              animationDelay: isExiting ? '0s' : ENTRANCE_STAGGER,
            }}
          >
            <article
              className="glass-card glass-card--right"
              style={{ transform: rightCardTransform }}
            >
              <div className="glass-card__specular" />
              <div className="glass-card__rim-glow" />

              <div className="glass-card__inner">
                <div className="card-badge card-badge--gold">
                  <span className="card-badge__number">02</span>
                  <span className="card-badge__text">VISI & TUJUAN</span>
                </div>

                <h2 className="card-title">Tujuan & Visi</h2>
                <h3 className="card-subtitle">Harmonisasi WebGL & Pengalaman 3D</h3>

                <p className="card-paragraph">
                  Proyek ini dibangun untuk mendemonstrasikan perpaduan teknologi 3D WebGL modern
                  dan estetika visual di website. Menghadirkan eksplorasi karakter interaktif,
                  pencahayaan atmosferik, serta simulasi cuaca salju yang dinamis dengan framerate
                  yang stabil dan ringan tanpa mengorbankan kualitas visual.
                </p>

                <div className="card-tags">
                  <span className="card-tag">WebGL 60 FPS</span>
                  <span className="card-tag">Interaktif Parallax</span>
                  <span className="card-tag">Sinematik Bloom</span>
                </div>
              </div>
            </article>
          </div>

          {/* Tombol Next di bawah Card 2 */}

        </div>{/* end col2 */}
        <div
          key={`center-nav-${animKey}`}
          className={`section-two__center-nav ${cardsReady && !isExiting ? 'section-two__center-nav--play' : ''} ${isExiting ? 'section-two__center-nav--exit' : ''}`}
        >
          <button
            className="btn-next-step"
            type="button"
            onClick={handleNext}
            title="Lanjut ke Tawaran Kami (Section 3)"
          >
            <span className="btn-next-step__text">Next</span>
            <span className="btn-next-step__arrow">{'>'}</span>
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <footer className="section-two__footer">
        <span className="footer-hint">...</span>
      </footer>
    </section>
  )
}
