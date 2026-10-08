import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import './style/SectionThree.css'

// ================== Tuning Parameter: Section 3 (Tawaran Kami) ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Skala ukuran card
const CARD_SCALE = 0.679                 // Skala besar-kecil card penawaran di desktop
const MOBILE_CARD_SCALE = 0.79           // Skala besar-kecil card penawaran khusus di responsif HP

// 1b. Transisi Delay Kamera & Animasi Card
const CAMERA_ARRIVE_DELAY_MS = 650       // Delay (ms) menunggu perpindahan kamera selesai baru card muncul
const SECTION_EXIT_DELAY_MS = 750        // Delay (ms) menunggu animasi card keluar saat Back / Next

// 1c. Animasi Entrance & Exit Card (Spin up & Spin down ala Section 2)
const ENTRANCE_TRANSLATE_Y = 220         // Jarak vertikal animasi masuk dari bawah (px)
const EXIT_TRANSLATE_Y = 380             // Jarak vertikal animasi keluar ke bawah (px)
const ENTRANCE_ROTATE_DEG = 20           // Sudut putaran saat masuk
const ENTRANCE_DURATION = '1.1s'         // Durasi animasi masuk (entrance)
const ENTRANCE_STAGGER = 0.14            // Jeda waktu kemunculan antar card (detik)
const EXIT_DURATION = '0.7s'             // Durasi animasi keluar (exit)
const EXIT_STAGGER = 0.1                 // Jeda waktu keluar antar card (detik)

// 1d. Delay Kemunculan Tombol Lanjut ke Portfolio
const FOOTER_BTN_DELAY_MS = 850          // Delay (ms) agar tombol Next Section 3 muncul setelah card masuk

// 2. Sudut rotasi 3D card menghadap kamera (derajat)
const CARD_1_ROTATION_Y = 14             // Card kiri condong +14°
const CARD_2_ROTATION_Y = 0              // Card tengah menghadap lurus 0°
const CARD_3_ROTATION_Y = -14            // Card kanan condong -14°

// 3. Sensitivitas efek Parallax mouse (kepekaan gerak)
const PARALLAX_ROTATION_SENSITIVITY = 10 // Derajat tilt ekstra saat mouse digerakkan
const PARALLAX_TRANSLATION_X = 36        // Geser horizontal maksimum card (px)
const PARALLAX_TRANSLATION_Y = 29        // Geser vertikal maksimum card (px)
const PARALLAX_DEPTH_Z = 20              // Jarak kedalaman Z saat parallax (px)

// 4. [BARU] Kehalusan parallax & sapuan balik
// PARALLAX_DAMP_RATE   : kecepatan kartu "mengikuti" kursor (1/detik). Berbasis waktu (frame-rate independent).
//                        Kecil = licin & melayang, besar = nempel. Menggantikan CSS transition 0.18s yang
//                        di-reset tiap event pointermove (terasa patah-patah).
// LANDED_PARALLAX_DELAY_MS : jeda sebelum parallax aktif saat Section 3 hanya TERSIBAK gelombang (tanpa entrance)
const PARALLAX_DAMP_RATE = 7
const LANDED_PARALLAX_DELAY_MS = 350

const SectionThree = forwardRef(function SectionThree({ onBack, onNext, isVisible, instant = false }, ref) {
  const stageRef = useRef(null)

  const [cardsReady, setCardsReady] = useState(false)
  const [footerReady, setFooterReady] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [canParallax, setCanParallax] = useState(false)
  // landed = Section 3 muncul karena TERSIBAK gelombang (kembali dari 3.5): kartu langsung
  // dalam posisi akhir, tidak terbang lagi dari bawah. Dibaca dari prop `instant` pada saat section
  // menjadi terlihat, lalu dipertahankan sampai section benar-benar disembunyikan.
  const [landed, setLanded] = useState(false)
  const instantRef = useRef(instant)
  instantRef.current = instant
  const timerRef = useRef(null)
  const footerTimerRef = useRef(null)
  const parallaxTimerRef = useRef(null)

  // --- Parallax imperatif (nol re-render React) ---
  const cardElsRef = useRef([])                      // elemen <article> tiap kartu
  const pointerTargetRef = useRef({ x: 0, y: 0 })    // posisi kursor ternormalisasi -1..1
  const pointerCurrentRef = useRef({ x: 0, y: 0 })   // posisi yang sudah di-smooth
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  // Kalkulasi transform 3D untuk 1 kartu pada posisi kursor (mx, my)
  const buildCardTransform = useCallback((baseRotY, mx, my) => {
    const scale = isMobile ? MOBILE_CARD_SCALE : CARD_SCALE
    const rotY = isMobile ? 0 : baseRotY + mx * PARALLAX_ROTATION_SENSITIVITY
    const rotX = isMobile ? 0 : -my * PARALLAX_ROTATION_SENSITIVITY
    const transX = isMobile ? 0 : mx * -PARALLAX_TRANSLATION_X
    const transY = isMobile ? 0 : my * -PARALLAX_TRANSLATION_Y

    return `scale(${scale}) rotateY(${rotY.toFixed(3)}deg) rotateX(${rotX.toFixed(3)}deg) translate3d(${transX.toFixed(2)}px, ${transY.toFixed(2)}px, ${PARALLAX_DEPTH_Z}px)`
  }, [isMobile])

  const rotYs = [CARD_1_ROTATION_Y, CARD_2_ROTATION_Y, CARD_3_ROTATION_Y]

  const applyParallax = useCallback(() => {
    const { x, y } = pointerCurrentRef.current
    cardElsRef.current.forEach((el, i) => {
      if (el) el.style.transform = buildCardTransform(rotYs[i] ?? 0, x, y)
    })
  }, [buildCardTransform])

  useEffect(() => {
    if (isVisible) {
      setIsExiting(false)
      setFooterReady(false)
      setCanParallax(false)
      pointerTargetRef.current = { x: 0, y: 0 }
      pointerCurrentRef.current = { x: 0, y: 0 }

      if (instantRef.current) {
        // TERSIBAK gelombang: langsung mendarat, tanpa delay kamera & tanpa terbang dari bawah
        setLanded(true)
        setCardsReady(true)
        setFooterReady(true)
        parallaxTimerRef.current = setTimeout(() => setCanParallax(true), LANDED_PARALLAX_DELAY_MS)
      } else {
        setLanded(false)
        timerRef.current = setTimeout(() => {
          setCardsReady(true)
          setAnimKey((prev) => prev + 1)

          // Parallax baru aktif setelah animasi masuk selesai mendarat sempurna (1.1s + stagger)
          parallaxTimerRef.current = setTimeout(() => {
            setCanParallax(true)
          }, 1300)
        }, CAMERA_ARRIVE_DELAY_MS)

        // Tombol lanjut ke portfolio baru muncul setelah card selesai animasi in
        footerTimerRef.current = setTimeout(() => {
          setFooterReady(true)
        }, CAMERA_ARRIVE_DELAY_MS + FOOTER_BTN_DELAY_MS)
      }
    } else {
      setLanded(false)
      setCardsReady(false)
      setFooterReady(false)
      setCanParallax(false)
      pointerTargetRef.current = { x: 0, y: 0 }
      pointerCurrentRef.current = { x: 0, y: 0 }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (footerTimerRef.current) clearTimeout(footerTimerRef.current)
      if (parallaxTimerRef.current) clearTimeout(parallaxTimerRef.current)
    }
  }, [isVisible])

  // Handler tombol Back: Mainkan animasi keluar Section 3 sekali, baru pindah ke Section 2
  const handleBack = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setCardsReady(false)
    setFooterReady(false)
    setCanParallax(false)
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
    setCanParallax(false)
    timerRef.current = setTimeout(() => {
      setIsExiting(false)
      if (onNext) onNext()
    }, SECTION_EXIT_DELAY_MS)
  }, [isExiting, onNext])

  // Dipanggil dari App.jsx lewat scroll (menggantikan tombol Next/Back lama) —
  // tetap memainkan animasi keluar yang sama sebelum benar-benar pindah section.
  useImperativeHandle(ref, () => ({
    next: handleNext,
    back: handleBack,
  }), [handleNext, handleBack])

  const showSection = isVisible || isExiting
  // [FIX] `landed` baru true SETELAH effect jalan (1 render terlambat) => frame pertama tersibak memakai
  // transisi fade biasa (berkedip). Pakai prop `instant` langsung supaya mode instan aktif sejak frame pertama.
  const instantMode = (landed || instant) && isVisible && !isExiting

  const entranceClass = isExiting
    ? 'card-s3-entrance--exit'
    : (isVisible && cardsReady)
      ? (landed ? 'card-s3-entrance--landed' : 'card-s3-entrance--play')
      : ''

  // Parallax: kursor hanya menggeser TARGET (ref); loop rAF di bawah menghaluskannya
  // lalu menulis transform langsung ke elemen kartu. Tidak ada setState per pointermove.
  useEffect(() => {
    if (!canParallax || isMobile) return undefined

    const onMove = (e) => {
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      pointerTargetRef.current.x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      pointerTargetRef.current.y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const k = 1 - Math.exp(-PARALLAX_DAMP_RATE * dt)
      const cur = pointerCurrentRef.current
      const tgt = pointerTargetRef.current
      const dx = tgt.x - cur.x
      const dy = tgt.y - cur.y
      // Berhenti menulis DOM saat sudah diam (hemat), tetap polling target
      if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
        cur.x += dx * k
        cur.y += dy * k
        applyParallax()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [canParallax, isMobile, applyParallax])

  // Saat parallax tidak aktif (belum mulai / sedang keluar) kartu dipastikan berada di posisi netral.
  useEffect(() => {
    if (canParallax) return
    pointerCurrentRef.current = { x: 0, y: 0 }
    applyParallax()
  }, [canParallax, applyParallax])

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
      className={`section-three ${showSection ? 'section-three--visible' : ''} ${instantMode ? 'section-three--instant' : ''} ${isExiting ? 'section-three--leaving' : ''}`}
      ref={stageRef}
    >
      {/* Header bar navigasi Section 3 */}
      <header className="section-three__header">
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
                ref={(el) => {
                  cardElsRef.current[index] = el
                  // Kartu di-remount tiap animKey berganti -> pulihkan transform terakhir
                  if (el) el.style.transform = buildCardTransform(item.rotY, pointerCurrentRef.current.x, pointerCurrentRef.current.y)
                }}
              >
                {/* Efek kilap specular sheen kaca */}
                <div className="glass-card-s3__specular" />
                <div className="glass-card-s3__rim-glow" />

                <div className="glass-card-s3__inner">
                  {/* Gambar kartu / icon preview */}
                  <div className="card-s3__preview">
                    {item.iconSvg}
                    <div className="card-s3__badge">
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
      </div>
    </section>
  )
}
)

export default SectionThree