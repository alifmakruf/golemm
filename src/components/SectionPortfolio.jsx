import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { EASE } from '../gsap/eases.js'
import './style/SectionPortfolio.css'

// ================== Parameter Tuning: Section 4 (Portfolio) & Section 5 (Kontak) ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Kecepatan Animasi Marquee Trusted Board (detik untuk 1 putaran penuh)
const TRUSTED_BOARD_SPEED_SEC = 28       // Semakin kecil angka = lari semakin cepat

// 2. Animasi Masuk (In) Card Section 4 — sekarang dipicu SAAT card masuk layar
// (scroll-reveal), bukan semuanya sekaligus, supaya ringan di HP.
const CARD_ENTRANCE_DURATION = '0.8s'   // Durasi animasi masuk card (desktop)
const CARD_ENTRANCE_STAGGER_SEC = 0.1   // Jeda antar card yang muncul bersamaan (detik)
const CARD_INIT_SCALE = 0.92            // Skala awal card (desktop saja)
const CARD_INIT_ROTATE_DEG = 2          // Rotasi awal card (desktop saja; mobile tanpa rotasi)
const ENTRANCE_START_DELAY_FRAC = 0.5   // Mulai animasi konten setelah sheet meluncur sekian % (0-1). Kurva sheet kini
// easeInOut (pelan di awal), jadi konten baru mulai saat sheet sudah ~setengah jalan.
const MOBILE_BREAKPOINT_PX = 960        // <= lebar ini dianggap mobile: animasi dibuat lebih ringan

// 3. Durasi Transisi Sheet Putih dari bawah (detik)
// [SELARAS] Diekspor & dipakai App.jsx + SectionWhyUs.jsx supaya fade-out terrain, efek "mundur" Section 3.5,
// kunci scroll, dan sheet ini semuanya memakai durasi yang SAMA. Kurvanya (--sheet-ease) ada di SectionPortfolio.css.
export const SHEET_TRANSITION_SEC = 1.0
const SHEET_TRANSITION_DURATION = `${SHEET_TRANSITION_SEC}s`

// 5. Data Kontak Pribadi (Bisa langsung diubah di sini)
const CONTACT_DATA = {
  name: 'MOHAMMAD FIRMAN ALIF MARUF',
  role: 'Creative WebGL & 3D Web Engineer',
  email: 'alifmakruf098@gmail.com',
  phone: '+62 857-0633-6657',
  location: 'Sidoarjo, Indonesia',
  status: 'Mahasiswa',
}

// Data 4 Project Portfolio sesuai target.txt
// Parameter path gambar (src): Anda dapat mengubah path file gambar ini sesuai aset yang diletakkan di src/assets/ atau public/
// Parameter url: link web asli project (dibuka di tab baru lewat tombol "Lihat"). GANTI dengan link asli Anda.
const PROJECTS = [
  {
    id: 'proj-1',
    title: 'Stone Golem 3D Showcase',
    sub: 'Eksplorasi WebGL & Shaders Interaktif',
    desc: 'Pengembangan landing page 3D interaktif real-time dengan karakter golem batu bertekstur realistis, pencahayaan dinamis, partikel cuaca salju, dan post-processing bloom.',
    tech: ['React Three Fiber', 'Three.js', 'WebGL', 'GLSL Shaders'],
    bgGradient: 'linear-gradient(135deg, #ffffffff 0%, #ffffffff 100%)',
    accentColor: '#38bdf8',
    // Ganti path gambar berikut sesuai nama file Anda di src/assets/
    image: '/project-1.png',
    url: 'https://golemm.vercel.app',
  },
  {
    id: 'proj-2',
    title: 'IoT Smart Home Digital Twin',
    sub: 'Visualisasi indicator lampu dan sensor Real-Time',
    desc: 'Platform dashboard monitoring hardware rumah berbasis kembaran digital 3D. Terhubung dengan live sensor MQTT dan WebSocket untuk Suhu ruangan dan lampu.',
    tech: ['Three.js', 'ESP32', 'Node.js', 'MQTT', 'Chart.js'],
    bgGradient: 'linear-gradient(135deg, #ffffffff 0%, #ffffffff 100%)',
    accentColor: '#60a5fa',
    image: '/project-2.png',
    url: 'https://hao-web-lyart.vercel.app',
  },
  {
    id: 'proj-3',
    title: 'My Personal Profile',
    sub: '3D interactive website, Custom cursor and Parallax Effect',
    desc: 'Website personal profile yang menggunakan model 3D pedang kayu dengan efek trail dan efek parallax untuk pergerakan kursor',
    tech: ['WebGL', 'Three.js', 'Blender', 'Vite'],
    bgGradient: 'linear-gradient(135deg, #ffffffff 0%, #ffffffff 100%)',
    accentColor: '#34d399',
    image: '/project-3.png',
    url: 'https://firmanalif.vercel.app',
  },
  {
    id: 'proj-4',
    title: 'Agrowatch',
    sub: 'Sistem pelaporan lahan pertanian dengan map interaktif',
    desc: 'Sistem pelaporan lahan pertanian yang memungkinkan petani melaporkan kondisi lahan mereka secara real-time dengan menggunakan map interaktif yang terhubung dengan Dashboard manajemen.',
    tech: ['Leaflet', 'React', 'JavaScript', 'API REST'],
    bgGradient: 'linear-gradient(135deg, #ffffffff 0%, #ffffffff 100%)',
    accentColor: '#c084fc',
    image: '/project-4.png',
    url: 'https://agrowatch-seven.vercel.app',
  },
]

// Daftar Teknologi & Tools yang digunakan sesuai target.txt
const TECH_STACK = [
  { name: 'React', desc: 'UI Framework', badge: 'v18' },
  { name: 'Three.js', desc: '3D Graphics', badge: 'v0.169' },
  { name: 'React Three Fiber', desc: 'R3F Declarative', badge: 'v8' },
  { name: 'WebGL & GLSL', desc: 'Shader GPU', badge: 'v2.0' },
  { name: 'Vite', desc: 'Next-Gen Bundler', badge: 'v5' },
  { name: 'Blender 3D', desc: 'Modeling & Rigging', badge: 'v4.2' },
  { name: 'JavaScript / TS', desc: 'Modern ECMAScript', badge: 'ESNext' },
  { name: 'Node.js', desc: 'IoT Backend & API', badge: 'v20' },
  { name: 'PostProcessing', desc: 'Bloom & Atmospheric', badge: 'v6' },
]

// Trusted Board Client (Running Card Marquee dari kiri ke kanan)
const CLIENT_LOGOS = [
  { name: 'VERTEX LABS', category: 'Creative Tech' },
  { name: 'NOVA DYNAMICS', category: 'Robotics & AI' },
  { name: 'AETHER DIGITAL', category: 'Spatial Computing' },
  { name: 'NEXUS IOT', category: 'Smart Devices' },
  { name: 'SOLARIS MEDIA', category: 'Interactive Web' },
  { name: 'TITAN HEAVYWORKS', category: 'Industrial IoT' },
]

export default function SectionPortfolio({ isVisible, onBackTo3D }) {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [formSent, setFormSent] = useState(false)
  const [showMoreModal, setShowMoreModal] = useState(false)
  const formRef = useRef(null)
  const rootRef = useRef(null)
  const section4HeaderRef = useRef(null)
  const section5HeaderRef = useRef(null)
  const moreDrawerRef = useRef(null)
  const cardRefs = useRef([])

  // Reset status form jika berganti section
  useEffect(() => {
    if (!isVisible) {
      setFormSent(false)
      setShowMoreModal(false)
    }
  }, [isVisible])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormSent(true)
    setTimeout(() => {
      setFormData({ name: '', email: '', subject: '', message: '' })
    }, 4000)
  }

  // ============================================================
  // ANIMASI IN/OUT — dioptimalkan untuk mobile.
  //
  // Perubahan dibanding versi lama:
  //  1. Animasi masuk header & card dijalankan SAAT Section 4 dibuka (bukan saat
  //     mount, ketika halaman masih di luar layar dan animasinya terbuang percuma).
  //  2. Scroll-reveal: elemen baru dianimasikan begitu masuk layar
  //     (IntersectionObserver), jadi HP tidak menganimasikan 4 card + 2 header
  //     sekaligus bersamaan dengan transisi sheet & render 3D di belakangnya.
  //  3. Mulai setelah sheet meluncur sebagian (ENTRANCE_START_DELAY_FRAC) supaya
  //     dua animasi besar tidak berebut frame di detik yang sama.
  //  4. Di mobile: tanpa rotasi/scale, durasi & stagger lebih pendek.
  //     Hanya opacity + transform (jalan di GPU compositor).
  //  5. Reset ke keadaan tersembunyi dilakukan SETELAH sheet selesai meluncur
  //     keluar (dulu langsung, sehingga konten menghilang lebih dulu dari sheet).
  //  6. Hormati "prefers-reduced-motion".
  // ============================================================
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const sheetSec = parseFloat(SHEET_TRANSITION_DURATION)
    const compact = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Daftar elemen yang dianimasikan (urutan = urutan di halaman)
    const items = [
      { el: section4HeaderRef.current, kind: 'header' },
      ...cardRefs.current.map((el, idx) => ({ el, kind: 'card', idx })),
      { el: section5HeaderRef.current, kind: 'header' },
    ].filter((it) => it.el)

    const hiddenVars = (it) =>
      it.kind === 'header'
        ? { opacity: 0, y: compact ? 12 : 18 }
        : {
          opacity: 0,
          y: compact ? 22 : 32,
          scale: compact ? 1 : CARD_INIT_SCALE,
          rotate: compact ? 0 : (it.idx % 2 === 0 ? CARD_INIT_ROTATE_DEG : -CARD_INIT_ROTATE_DEG),
        }

    const shownVars = (it) => ({
      opacity: 1,
      y: 0,
      ...(it.kind === 'card' ? { scale: 1, rotate: 0 } : {}),
    })

    // ---------- OUT: reset setelah sheet selesai meluncur keluar ----------
    if (!isVisible) {
      const timer = setTimeout(() => {
        items.forEach((it) => gsap.set(it.el, { ...hiddenVars(it), clearProps: 'willChange' }))
      }, sheetSec * 1000 + 80)
      return () => clearTimeout(timer)
    }

    // ---------- IN ----------
    if (reduceMotion) {
      items.forEach((it) => gsap.set(it.el, shownVars(it)))
      return undefined
    }

    const cardDur = compact ? 0.55 : parseFloat(CARD_ENTRANCE_DURATION)
    const stagger = compact ? 0.06 : CARD_ENTRANCE_STAGGER_SEC
    const headerDur = compact ? 0.5 : 0.8
    const startDelay = sheetSec * ENTRANCE_START_DELAY_FRAC

    const reveal = (it, delay) => {
      gsap.fromTo(it.el, hiddenVars(it), {
        ...shownVars(it),
        duration: it.kind === 'header' ? headerDur : cardDur,
        delay,
        ease: it.kind === 'header' ? EASE.easeOut : EASE.softOut2,
        overwrite: true,
        onComplete: () => gsap.set(it.el, { clearProps: 'willChange' }),
      })
    }

    // Fallback tanpa IntersectionObserver: tampilkan berurutan
    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((it, i) => reveal(it, startDelay + i * stagger))
      return undefined
    }

    let firstBatch = true
    const order = new Map(items.map((it, i) => [it.el, i]))
    const byEl = new Map(items.map((it) => [it.el, it]))

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleNow = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => order.get(a.target) - order.get(b.target))
        visibleNow.forEach((entry, i) => {
          reveal(byEl.get(entry.target), (firstBatch ? startDelay : 0) + i * stagger)
          observer.unobserve(entry.target)
        })
        if (visibleNow.length) firstBatch = false
      },
      { root, threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    )
    items.forEach((it) => observer.observe(it.el))

    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible])

  // Panel "more-drawer": fade singkat saat dibuka (mount baru tiap kali dibuka)
  useEffect(() => {
    if (showMoreModal && moreDrawerRef.current) {
      gsap.fromTo(
        moreDrawerRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: EASE.easeOut, overwrite: true }
      )
    }
  }, [showMoreModal])

  return (
    <div
      ref={rootRef}
      className={`portfolio-page-2d ${isVisible ? 'portfolio-page-2d--visible' : ''}`}
      style={{ '--sheet-dur': SHEET_TRANSITION_DURATION }}
    >
      {/* Tombol Back ke 3D Experience (Section 3) */}
      <nav className="portfolio-top-nav">
        <button
          className="btn-back-to-3d"
          type="button"
          onClick={onBackTo3D}
          title="Kembali ke Pengalaman 3D Gunung (Section 3)"
        >
          <span className="btn-back-to-3d__arrow">{'<'}</span>
          <span>Back</span>
        </button>
      </nav>

      {/* ======================================================================
          SECTION 4: PORTFOLIO, TECH STACK & TRUSTED CLIENTS
          ====================================================================== */}
      <section className="section-four" id="section-4">
        <div className="section-four__container">
          {/* Headline & Sub-headline Section 4 */}
          <div className="section-four__header" ref={section4HeaderRef}>
            <span className="section-label">Get In</span>
            <h1 className="section-headline">Cukup!, Saatnya Melihat Hasil Karya Kami.</h1>
            <p className="section-subheadline">
              Karya terpilih dalam rekayasa grafis 3D WebGL, interaksi imersif, dan visualisasi telemetri IoT.
            </p>
          </div>

          {/* Grid Portfolio Cards: Tampilan Default HANYA GAMBAR, Hover memunculkan Detail */}
          <div className="portfolio-grid">
            {PROJECTS.map((proj, idx) => (
              <div
                key={proj.id}
                className="portfolio-card"
                ref={(el) => { cardRefs.current[idx] = el }}
                style={{
                  '--card-bg': proj.bgGradient,
                  '--card-accent': proj.accentColor,
                }}
              >
                {/* 1. Tampilan Default: HANYA GAMBAR PROYEK */}
                <div className="portfolio-card__media">
                  <img
                    src={proj.image}
                    alt={proj.title}
                    className="proj-card__art"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="portfolio-card__image-overlay">
                    <span className="portfolio-card__badge-corner">{proj.title}</span>
                  </div>
                </div>

                {/* 2. Tampilan Saat Hover: Reveal Detail Tech Stack, Deskripsi & Tombol Lihat */}
                <div className="portfolio-card__hover-content">
                  <div className="hover-header">
                    <h3 className="hover-title">{proj.title}</h3>
                    <p className="hover-subtitle">{proj.sub}</p>
                  </div>

                  <p className="hover-description">{proj.desc}</p>

                  <div className="hover-tech-stack">
                    {proj.tech.map((t) => (
                      <span key={t} className="hover-tech-tag">
                        {t}
                      </span>
                    ))}
                  </div>

                  <a
                    className="btn-visit"
                    href={proj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Lihat ${proj.title} (buka di tab baru)`}
                  >
                    <span>Lihat</span>
                    <span className="btn-visit__arrow">{'>'}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Daftar Tech Stack yang digunakan */}
          <div className="tech-stack-section">
            <div className="tech-stack-header">
              <span className="tech-badge">CORE CAPABILITIES</span>
              <h2 className="tech-title">Teknologi & Engine yang Digunakan</h2>
              <p className="tech-subtitle">
                Fondasi teknologi handal untuk menghadirkan performa yang optimal dan stabilitas jangka panjang.
              </p>
            </div>

            <div className="tech-stack-grid">
              {TECH_STACK.map((tech) => (
                <div key={tech.name} className="tech-card">
                  <div className="tech-card__top">
                    <span className="tech-card__name">{tech.name}</span>
                    <span className="tech-card__ver">{tech.badge}</span>
                  </div>
                  <span className="tech-card__desc">{tech.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trusted Board Client (Running Card dari kiri ke kanan) */}
          <div className="trusted-board-section">
            <div className="trusted-board-header">
              <span className="trusted-badge">COLLABORATION</span>
              <h3 className="trusted-title">Trusted Board Clients</h3>
              <p className="trusted-subtitle">
                Dipercaya oleh tim inovator, studio kreatif, dan pengembang teknologi terkemuka.
              </p>
            </div>

            {/* Marquee Running Cards: Bergerak Halus dari Kiri ke Kanan */}
            <div className="marquee-container" style={{ '--marquee-speed': `${TRUSTED_BOARD_SPEED_SEC}s` }}>
              <div className="marquee-track">
                {/* Looping 2x untuk ilusi pergerakan continuous tanpa putus */}
                {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((client, i) => (
                  <div key={`${client.name}-${i}`} className="trusted-card">
                    <span className="trusted-card__logo">{client.name}</span>
                    <span className="trusted-card__cat">{client.category}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================
          SECTION 5: KONTAK, SOSIAL MEDIA & FORM
          ====================================================================== */}
      <section className="section-five" id="section-5">
        <div className="section-five__container">
          <div className="section-five__header" ref={section5HeaderRef}>
            <span className="section-label">GET IN TOUCH</span>
            <h2 className="section-headline">Hubungi & Mulai Kolaborasi</h2>
            <p className="section-subheadline">
              Diskusikan ide proyek 3D Web, kebutuhan IoT, atau konsultasi teknis arsitektur website modern.
            </p>
          </div>

          <div className="contact-wrapper">
            {/* Kolom Kiri: Detail Kontak & Sosial Media */}
            <div className="contact-info-card">
              <div className="contact-status-indicator">
                <span className="status-text">{CONTACT_DATA.status}</span>
              </div>

              <h3 className="contact-name">{CONTACT_DATA.name}</h3>
              <p className="contact-role">{CONTACT_DATA.role}</p>

              <div className="contact-items">
                <div className="contact-item">
                  <span className="contact-item__label">Email:</span>
                  <a href={`mailto:${CONTACT_DATA.email}`} className="contact-item__value">
                    {CONTACT_DATA.email}
                  </a>
                </div>
                <div className="contact-item">
                  <span className="contact-item__label">Lokasi:</span>
                  <span className="contact-item__value">{CONTACT_DATA.location}</span>
                </div>
                <div className="contact-item">
                  <span className="contact-item__label">Telepon / WhatsApp:</span>
                  <span className="contact-item__value">{CONTACT_DATA.phone}</span>
                </div>
              </div>

              {/* Tautan Sosial Media */}
              <div className="social-links-container">
                <span className="social-title">Saluran Komunikasi:</span>
                <div className="social-links">
                  <a href="https://github.com/alifmakruf" target="_blank" rel="noreferrer" className="social-chip">
                    GitHub
                  </a>
                  <a href="https://www.linkedin.com/in/mohammad-firman-alif-ma-ruf-6bb587375" target="_blank" rel="noreferrer" className="social-chip">
                    LinkedIn
                  </a>
                  <a href="https://www.instagram.com/firmanalif0410/" target="_blank" rel="noreferrer" className="social-chip">
                    Instagram
                  </a>

                </div>
              </div>
            </div>

            {/* Kolom Kanan: Form Kontak Interaktif */}
            <div className="contact-form-card" ref={formRef}>
              <h3 className="form-card-title">Kirim Pesan Langsung</h3>
              <p className="form-card-desc">
                Isi formulir di bawah ini dan saya akan merespons dalam waktu 24 jam kerja.
              </p>

              {formSent ? (
                <div className="form-success-banner">
                  <div className="success-icon">✓</div>
                  <h4>Pesan Berhasil Terkirim!</h4>
                  <p>Terima kasih telah menghubungi. Saya akan segera membalas email Anda secepatnya.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="name">Nama Lengkap</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        placeholder="Masukkan nama Anda..."
                        value={formData.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        placeholder="alamat@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="subject">Subjek / Topik Proyek</label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      required
                      placeholder="Contoh: Pembuatan WebGL Showcase & IoT Dashboard"
                      value={formData.subject}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="message">Detail Pesan</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      required
                      placeholder="Jelaskan kebutuhan proyek, tenggat waktu, atau pertanyaan Anda..."
                      value={formData.message}
                      onChange={handleInputChange}
                    />
                  </div>

                  <button type="submit" className="btn-submit-contact">
                    <span>Kirim Pesan Sekarang</span>
                    <span className="btn-submit__arrow">{'>'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Tombol "more?" di bagian paling bawah sesuai instruksi target.txt */}
          <div className="bottom-more-container">
            <button
              className="btn-more-info"
              type="button"
              onClick={() => setShowMoreModal(!showMoreModal)}
              title="Informasi Tambahan, FAQ & CV"
            >
              <span>more?</span>
              <span className={`btn-more__icon ${showMoreModal ? 'btn-more__icon--open' : ''}`}>
                {showMoreModal ? '✕' : '+'}
              </span>
            </button>
          </div>

          {/* Panel Informasi Tambahan saat tombol more? diklik */}
          {showMoreModal && (
            <div className="more-drawer" ref={moreDrawerRef}>
              <div className="more-drawer__grid">
                <div className="more-drawer__col">
                  <h4>Version 2 coming soon</h4>
                  <p>
                    version 2.0 is coming soon, with more features and improvements.
                  </p>
                </div>
                <div className="more-drawer__col">
                  <h4>References</h4>
                  <p>
                    igloo.inc, lusion.co, reactbits.dev,
                  </p>
                </div>
                <div className="more-drawer__col">
                  <h4>Effect</h4>
                  <p>wireframe wafe, parallax, Glassmorphism, splash cursor, spotlight, bloom</p>
                </div>
              </div>
              <footer className="more-drawer__footer">
                <span>© 2026 Alif Makruf. Crafted with React, Three.js & WebGL.</span>
              </footer>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}