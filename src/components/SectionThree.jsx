import { useState, useCallback, useRef, useEffect } from 'react'
import './style/SectionThree.css'

// ================== Tuning Parameter: Section 3 (Tawaran Kami) ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Skala ukuran card (0.62 = sedikit lebih kecil dari Section 2 yang 0.70)
const CARD_SCALE = 0.62                  // Skala besar-kecil card penawaran

// 1b. Transisi Delay Kamera (Menunggu kamera sampai di Section 3 baru card muncul)
const CAMERA_ARRIVE_DELAY_MS = 650       // Delay (ms) menunggu perpindahan kamera selesai
const SECTION_EXIT_DELAY_MS = 750        // Delay (ms) menunggu animasi card keluar

// 1c. Animasi Entrance & Exit Card (Spin up & Spin down ala Section 2)
const ENTRANCE_TRANSLATE_Y = 220         // Jarak vertikal animasi masuk dari bawah (px)
const EXIT_TRANSLATE_Y = 380             // Jarak vertikal animasi keluar ke bawah (px)
const ENTRANCE_ROTATE_DEG = 20           // Sudut putaran saat masuk
const ENTRANCE_DURATION = '1.1s'         // Durasi animasi masuk
const ENTRANCE_STAGGER = 0.14            // Jeda waktu kemunculan antar card (detik)
const EXIT_DURATION = '0.7s'             // Durasi animasi keluar
const EXIT_STAGGER = 0.1                 // Jeda waktu keluar antar card (detik)

// 1d. Delay Kemunculan Tombol Lanjut ke Portfolio (Perbaikan 1.1: Tidak langsung muncul)
const FOOTER_BTN_DELAY_MS = 850          // Delay (ms) agar tombol Next Section 3 muncul setelah card masuk

// 2. Sudut rotasi 3D card menghadap kamera (derajat)
const CARD_1_ROTATION_Y = 14             // Card kiri condong +14°
const CARD_2_ROTATION_Y = 0              // Card tengah menghadap lurus 0°
const CARD_3_ROTATION_Y = -14            // Card kanan condong -14°

// 3. Sensitivitas efek Parallax mouse
const PARALLAX_ROTATION_SENSITIVITY = 8  // Derajat tilt ekstra saat mouse digerakkan
const PARALLAX_TRANSLATION_X = 18        // Geser horizontal maksimum card (px)
const PARALLAX_TRANSLATION_Y = 14        // Geser vertikal maksimum card (px)

export default function SectionThree({ onBack, onNext, isVisible }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const stageRef = useRef(null)

  const [cardsReady, setCardsReady] = useState(false)
  const [footerReady, setFooterReady] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const timerRef = useRef(null)
  const footerTimerRef = useRef(null)

  useEffect(() => {
    if (isVisible) {
      setIsExiting(false)
      setFooterReady(false)
      timerRef.current = setTimeout(() => {
        setCardsReady(true)
        setAnimKey((prev) => prev + 1)
      }, CAMERA_ARRIVE_DELAY_MS)

      // Tombol lanjut ke portfolio baru muncul setelah card selesai animasi in (Perbaikan 1.1)
      footerTimerRef.current = setTimeout(() => {
        setFooterReady(true)
      }, CAMERA_ARRIVE_DELAY_MS + FOOTER_BTN_DELAY_MS)
    } else {
      setCardsReady(false)
      setFooterReady(false)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (footerTimerRef.current) clearTimeout(footerTimerRef.current)
    }
  }, [isVisible])

  // Handler tombol Back: Mainkan animasi keluar Section 3 sekali, baru pindah ke Section 2
  const handleBack = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setCardsReady(false)
    setFooterReady(false)
    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onBack) onBack()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onBack])

  // Handler tombol Next: Mainkan animasi keluar Section 3 sekali, baru buka Section 4 (2D sheet)
  const handleNext = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setCardsReady(false)
    setFooterReady(false)
    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onNext) onNext()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onNext])

  const showSection = isVisible || isExiting

  const entranceClass = isExiting
    ? 'card-s3-entrance--exit'
    : (isVisible && cardsReady)
      ? 'card-s3-entrance--play'
      : ''

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  const handlePointerMove = useCallback((e) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
    const y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
    setMousePos({ x, y })
  }, [])

  // Kalkulasi transform 3D untuk 3 card
  const getCardTransform = (baseRotY) => {
    const rotY = isMobile ? 0 : baseRotY + mousePos.x * PARALLAX_ROTATION_SENSITIVITY
    const rotX = isMobile ? 0 : -mousePos.y * PARALLAX_ROTATION_SENSITIVITY
    const transX = isMobile ? 0 : mousePos.x * -PARALLAX_TRANSLATION_X
    const transY = isMobile ? 0 : mousePos.y * -PARALLAX_TRANSLATION_Y

    return `
      scale(${CARD_SCALE})
      rotateY(${rotY}deg)
      rotateX(${rotX}deg)
      translate3d(${transX}px, ${transY}px, 20px)
    `
  }

  // Data 3 Tawaran Eksklusif sesuai target.txt
  const offers = [
    {
      id: '01',
      badge: 'ARSITEKTUR WEB 3D',
      title: 'Interactive 3D Web',
      subtitle: 'WebGL & Three.js Terdepan',
      desc: 'Membangun antarmuka situs 3D interaktif yang responsif di seluruh perangkat, dioptimalkan hingga 60 FPS tanpa lag, serta kaya estetika visual imersif.',
      tags: ['Three.js', 'Shader WebGL', 'GPU Optimized'],
      rotY: CARD_1_ROTATION_Y,
      glowType: 'cyan',
      iconSvg: (
        <svg viewBox="0 0 48 48" fill="none" className="card-s3__icon-svg">
          <circle cx="24" cy="24" r="20" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
          <polygon points="24,10 38,20 38,34 24,42 10,34 10,20" stroke="#ffffff" strokeWidth="2" fill="rgba(56, 189, 248, 0.15)" />
          <circle cx="24" cy="24" r="5" fill="#38bdf8" />
        </svg>
      ),
    },
    {
      id: '02',
      badge: 'IOT DIGITAL TWIN',
      title: 'IoT Digital Twin',
      subtitle: 'Telemetri Real-Time & Sensor',
      desc: 'Integrasi visualisasi model 3D interaktif yang terkoneksi langsung dengan sensor perangkat IoT, memungkinkan pemantauan presisi dan kendali intuitif.',
      tags: ['Live Telemetry', 'MQTT / WebSocket', 'Smart Sensor'],
      rotY: CARD_2_ROTATION_Y,
      glowType: 'gold',
      iconSvg: (
        <svg viewBox="0 0 48 48" fill="none" className="card-s3__icon-svg">
          <rect x="12" y="12" width="24" height="24" rx="4" stroke="#fde047" strokeWidth="2" fill="rgba(254, 240, 138, 0.12)" />
          <path d="M12 24h24M24 12v24M6 24h6M36 24h6M24 6v6M24 36v6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="24" r="4" fill="#fde047" />
        </svg>
      ),
    },
    {
      id: '03',
      badge: '2D Website',
      title: 'Modern & Responsive Web Development',
      subtitle: 'UI/UX Friendly & SEO Optimized',
      desc: 'Desain dan pengembangan website modern dengan fokus pada pengalaman pengguna yang intuitif dan optimalisasi mesin pencari (SEO) untuk meningkatkan visibilitas online.',
      tags: ['SEO', 'UI/UX Design', 'Responsive'],
      rotY: CARD_3_ROTATION_Y,
      glowType: 'emerald',
      iconSvg: (
        <svg viewBox="0 0 48 48" fill="none" className="card-s3__icon-svg">
          <path d="M24 4L28 18L42 24L28 30L24 44L20 30L6 24L20 18Z" stroke="#34d399" strokeWidth="2" fill="rgba(52, 211, 153, 0.15)" />
          <circle cx="24" cy="24" r="3" fill="#ffffff" />
        </svg>
      ),
    },
  ]

  return (
    <section
      className={`section-three ${showSection ? 'section-three--visible' : ''}`}
      ref={stageRef}
      onPointerMove={handlePointerMove}
    >
      {/* Header bar navigasi Section 3 */}
      <header className="section-three__header">
        <button
          className="btn-back-s3"
          type="button"
          onClick={handleBack}
          title="Kembali ke Latar Belakang & Visi (Section 2)"
        >
          <span className="btn-back-s3__arrow">{'<'}</span>
          <span>Back</span>
        </button>

        {/* Headline & Sub-headline Section 3 sesuai target.txt */}
        <div className="section-three__headings">
          <h2 className="s3-headline">Tawaran kami</h2>
          <p className="s3-subheadline">
            Berikut adalah penawaran eksklusif yang telah kami persiapkan khusus untuk Anda:
          </p>
        </div>
      </header>

      {/* Stage 3D dengan 3 Card Berjejer */}
      <div className="section-three__stage">
        {offers.map((item, index) => {
          const delayIn = `${index * ENTRANCE_STAGGER}s`
          const delayOut = `${(offers.length - 1 - index) * EXIT_STAGGER}s`

          return (
            <div
              key={`card-s3-${item.id}-${animKey}`}
              className={`card-s3-entrance ${entranceClass}`}
              style={{
                '--s3-entrance-ty': `${ENTRANCE_TRANSLATE_Y}px`,
                '--s3-exit-ty': `${EXIT_TRANSLATE_Y}px`,
                '--s3-entrance-rot': `${index === 0 ? ENTRANCE_ROTATE_DEG : index === 2 ? -ENTRANCE_ROTATE_DEG : 0}deg`,
                '--s3-entrance-dur': ENTRANCE_DURATION,
                '--s3-exit-dur': EXIT_DURATION,
                animationDelay: isExiting ? delayOut : delayIn,
              }}
            >
              <article
                className={`glass-card-s3 glass-card-s3--${item.glowType}`}
                style={{ transform: getCardTransform(item.rotY) }}
              >
                {/* Efek kilap specular sheen kaca */}
                <div className="glass-card-s3__specular" />
                <div className="glass-card-s3__rim-glow" />

                <div className="glass-card-s3__inner">
                  {/* Gambar kartu / icon preview */}
                  <div className="card-s3__preview">
                    {item.iconSvg}
                    <div className="card-s3__badge">
                      <span className="card-s3__badge-num">{item.id}</span>
                      <span className="card-s3__badge-txt">{item.badge}</span>
                    </div>
                  </div>

                  <h3 className="card-s3__title">{item.title}</h3>
                  <h4 className="card-s3__subtitle">{item.subtitle}</h4>

                  <p className="card-s3__paragraph">{item.desc}</p>

                  <div className="card-s3__tags">
                    {item.tags.map((tag) => (
                      <span key={tag} className="card-s3__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          )
        })}

        {/* Tombol Next dipindah ke dalam stage, agar posisinya menempel di bawah
            card persis seperti pola section-two__center-nav di Section Two */}
        <footer className={`section-three__footer ${footerReady && !isExiting ? 'section-three__footer--visible' : ''}`}>
          <button
            className="btn-s3-action"
            type="button"
            onClick={handleNext}
            title="Lanjut ke Portfolio (Section 4)"
          >
            <span className="btn-s3-action__text">Next</span>
            <span className="btn-s3-action__arrow">{'>'}</span>
          </button>
        </footer>
      </div>
    </section>
  )
}
