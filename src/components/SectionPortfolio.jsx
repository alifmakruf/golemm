import { useState, useRef, useEffect, useCallback } from 'react'
import './style/SectionPortfolio.css'

// ================== Parameter Tuning: Section 4 (Portfolio) & Section 5 (Kontak) ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Kecepatan Animasi Marquee Trusted Board (detik untuk 1 putaran penuh)
const TRUSTED_BOARD_SPEED_SEC = 28       // Semakin kecil angka = lari semakin cepat

// 2. Animasi Masuk (In) Card Section 4 saat Halaman Dimuat (Perbaikan 1.1)
// Muncul dengan scale kecil & rotasi saat halaman dimuat / dilewati
const CARD_ENTRANCE_DURATION = '0.85s'   // Durasi animasi masuk card Section 4
const CARD_ENTRANCE_STAGGER_SEC = 0.12   // Jeda waktu masuk antar card (detik)
const CARD_INIT_SCALE = 0.88             // Skala awal card (scaling kecil)
const CARD_INIT_ROTATE_DEG = 3           // Derajat rotasi awal saat card muncul

// 3. Durasi Transisi Sheet Putih dari bawah (detik)
const SHEET_TRANSITION_DURATION = '0.85s'

// 4. Data Kontak Pribadi (Bisa langsung diubah di sini)
const CONTACT_DATA = {
  name: 'Alif Makruf',
  role: 'Creative WebGL & 3D Web Engineer',
  email: 'alifmakruf.dev@gmail.com',
  phone: '+62 812-3456-7890',
  location: 'Yogyakarta, Indonesia',
  status: 'Tersedia untuk Proyek Freelance & Full-time',
}

export default function SectionPortfolio({ isVisible, onBackTo3D }) {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [formSent, setFormSent] = useState(false)
  const [showMoreModal, setShowMoreModal] = useState(false)
  const formRef = useRef(null)

  // Reset status form jika berganti section
  useEffect(() => {
    if (!isVisible) {
      setFormSent(false)
      setShowMoreModal(false)
    }
  }, [isVisible])

  // Handler klik tombol "I'm Interested" pada card portfolio
  const handleInterested = useCallback((projectName) => {
    setFormData((prev) => ({
      ...prev,
      subject: `Tertarik dengan proyek ${projectName}`,
    }))
    // Scroll mulus langsung ke form di Section 5
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

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

  // Data 4 Project Portfolio sesuai target.txt
  const projects = [
    {
      id: 'proj-1',
      title: 'Stone Golem 3D Showcase',
      sub: 'Eksplorasi WebGL & Shaders Interaktif',
      desc: 'Pengembangan landing page 3D interaktif real-time dengan karakter golem batu bertekstur realistis, pencahayaan dinamis, partikel cuaca salju, dan post-processing bloom.',
      tech: ['React Three Fiber', 'Three.js', 'WebGL', 'GLSL Shaders'],
      // Visual background artistik SVG representasi gambar project
      bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      accentColor: '#38bdf8',
      previewSvg: (
        <svg viewBox="0 0 320 200" fill="none" className="proj-card__art">
          <circle cx="160" cy="100" r="70" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 6" />
          <polygon points="160,50 215,80 215,140 160,170 105,140 105,80" stroke="#ffffff" strokeWidth="2.5" fill="rgba(56, 189, 248, 0.15)" />
          <polygon points="160,75 195,95 195,135 160,155 125,135 125,95" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(15, 23, 42, 0.6)" />
          <circle cx="145" cy="105" r="4" fill="#38bdf8" />
          <circle cx="175" cy="105" r="4" fill="#38bdf8" />
          <text x="160" y="190" textAnchor="middle" fill="#94a3b8" fontSize="11" letterSpacing="2">STONE GOLEM 3D</text>
        </svg>
      ),
    },
    {
      id: 'proj-2',
      title: 'IoT Factory Digital Twin',
      sub: 'Visualisasi Telemetri Mesin Real-Time',
      desc: 'Platform dashboard monitoring hardware industri pabrik berbasis kembaran digital 3D. Terhubung dengan live sensor MQTT dan WebSocket untuk deteksi anomali suhu & getaran.',
      tech: ['Three.js', 'WebSockets', 'Node.js', 'MQTT', 'Chart.js'],
      bgGradient: 'linear-gradient(135deg, #172554 0%, #090d16 100%)',
      accentColor: '#60a5fa',
      previewSvg: (
        <svg viewBox="0 0 320 200" fill="none" className="proj-card__art">
          <rect x="70" y="60" width="180" height="90" rx="8" stroke="#60a5fa" strokeWidth="2" fill="rgba(96, 165, 250, 0.12)" />
          <path d="M70 105h180M130 60v90M190 60v90" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <circle cx="100" cy="85" r="6" fill="#34d399" />
          <circle cx="160" cy="85" r="6" fill="#60a5fa" />
          <circle cx="220" cy="85" r="6" fill="#fde047" />
          <path d="M85 135 L110 120 L135 130 L160 115 L185 125 L210 110 L235 120" stroke="#38bdf8" strokeWidth="2" fill="none" />
          <text x="160" y="185" textAnchor="middle" fill="#94a3b8" fontSize="11" letterSpacing="2">DIGITAL TWIN IOT</text>
        </svg>
      ),
    },
    {
      id: 'proj-3',
      title: 'Alpine Drone Pathfinding',
      sub: 'Simulasi Terowongan Pegunungan 3D',
      desc: 'Simulasi penerbangan drone otonom melintasi lereng tebing pegunungan salju. Menampilkan optimasi komputasi fisika benturan (collision) dan jalur navigasi waypoint dinamis.',
      tech: ['WebGL', 'Three.js', 'Octree Collision', 'Vite'],
      bgGradient: 'linear-gradient(135deg, #064e3b 0%, #061c14 100%)',
      accentColor: '#34d399',
      previewSvg: (
        <svg viewBox="0 0 320 200" fill="none" className="proj-card__art">
          <path d="M40 160 L110 80 L160 120 L220 60 L280 160 Z" stroke="#34d399" strokeWidth="2" fill="rgba(52, 211, 153, 0.1)" />
          <circle cx="220" cy="60" r="14" stroke="#ffffff" strokeWidth="2" fill="rgba(52, 211, 153, 0.3)" />
          <path d="M210 60h20M220 50v20" stroke="#ffffff" strokeWidth="2" />
          <line x1="110" y1="80" x2="220" y2="60" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="160" y="185" textAnchor="middle" fill="#94a3b8" fontSize="11" letterSpacing="2">AUTONOMOUS DRONE</text>
        </svg>
      ),
    },
    {
      id: 'proj-4',
      title: 'Cyberpunk HUD Visualizer',
      sub: 'Audio-Reactive Shader Dashboard',
      desc: 'Eksperimen visual interaktif yang merespons frekuensi audio musik real-time dengan efek gelombang shader partikel neon, distorsi kromatik, dan audio analyzer Web Audio API.',
      tech: ['Web Audio API', 'Custom Shaders', 'Three.js', 'PostProcessing'],
      bgGradient: 'linear-gradient(135deg, #581c87 0%, #150928 100%)',
      accentColor: '#c084fc',
      previewSvg: (
        <svg viewBox="0 0 320 200" fill="none" className="proj-card__art">
          <circle cx="160" cy="95" r="55" stroke="#c084fc" strokeWidth="2" />
          <circle cx="160" cy="95" r="40" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="8 6" />
          <circle cx="160" cy="95" r="22" stroke="#c084fc" strokeWidth="2" fill="rgba(192, 132, 252, 0.2)" />
          <line x1="80" y1="95" x2="240" y2="95" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="160" y1="25" x2="160" y2="165" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 3" />
          <text x="160" y="185" textAnchor="middle" fill="#94a3b8" fontSize="11" letterSpacing="2">CYBER HUD SHADER</text>
        </svg>
      ),
    },
  ]

  // Daftar Teknologi & Tools yang digunakan sesuai target.txt
  const techStack = [
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
  const clientLogos = [
    { name: 'VERTEX LABS', category: 'Creative Tech' },
    { name: 'NOVA DYNAMICS', category: 'Robotics & AI' },
    { name: 'AETHER DIGITAL', category: 'Spatial Computing' },
    { name: 'NEXUS IOT', category: 'Smart Devices' },
    { name: 'SOLARIS MEDIA', category: 'Interactive Web' },
    { name: 'TITAN HEAVYWORKS', category: 'Industrial IoT' },
  ]

  return (
    <div
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
          <span className="btn-back-to-3d__arrow">←</span>
          <span>Kembali ke 3D Experience</span>
        </button>
        <span className="portfolio-mode-badge">2D Clean Portfolio View</span>
      </nav>

      {/* ======================================================================
          SECTION 4: PORTFOLIO, TECH STACK & TRUSTED CLIENTS
          ====================================================================== */}
      <section className="section-four" id="section-4">
        <div className="section-four__container">
          {/* Headline & Sub-headline Section 4 */}
          <div className="section-four__header animate-fade-in-up">
            <span className="section-label">SELECTED WORKS</span>
            <h1 className="section-headline">Enaugh!, lets check my portfolio!</h1>
            <p className="section-subheadline">
              Karya terpilih dalam rekayasa grafis 3D WebGL, interaksi imersif, dan visualisasi telemetri IoT.
            </p>
          </div>

          {/* Grid Portfolio Cards: Tampilan Default HANYA GAMBAR, Hover memunculkan Detail */}
          <div className="portfolio-grid">
            {projects.map((proj, idx) => (
              <div
                key={proj.id}
                className="portfolio-card"
                style={{
                  '--card-bg': proj.bgGradient,
                  '--card-accent': proj.accentColor,
                  '--card-entrance-delay': `${idx * CARD_ENTRANCE_STAGGER_SEC}s`,
                  '--card-entrance-dur': CARD_ENTRANCE_DURATION,
                  '--card-init-scale': CARD_INIT_SCALE,
                  '--card-init-rot': `${idx % 2 === 0 ? CARD_INIT_ROTATE_DEG : -CARD_INIT_ROTATE_DEG}deg`,
                }}
              >
                {/* 1. Tampilan Default: HANYA GAMBAR PROYEK */}
                <div className="portfolio-card__media">
                  {proj.previewSvg}
                  <div className="portfolio-card__image-overlay">
                    <span className="portfolio-card__badge-corner">{proj.title}</span>
                  </div>
                </div>

                {/* 2. Tampilan Saat Hover: Reveal Detail Tech Stack, Deskripsi & Tombol I'm Interested */}
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

                  <button
                    className="btn-interested"
                    type="button"
                    onClick={() => handleInterested(proj.title)}
                  >
                    <span>I'm Interested</span>
                    <span className="btn-interested__arrow">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Daftar Tech Stack yang digunakan */}
          <div className="tech-stack-section animate-fade-in">
            <div className="tech-stack-header">
              <span className="tech-badge">CORE CAPABILITIES</span>
              <h2 className="tech-title">Teknologi & Engine yang Digunakan</h2>
              <p className="tech-subtitle">
                Fondasi teknologi handal untuk menghadirkan performa 60 FPS dan stabilitas jangka panjang.
              </p>
            </div>

            <div className="tech-stack-grid">
              {techStack.map((tech) => (
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
                {[...clientLogos, ...clientLogos].map((client, i) => (
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
          <div className="section-five__header animate-fade-in-up">
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
                <span className="status-ping" />
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
                  <a href="https://github.com" target="_blank" rel="noreferrer" className="social-chip">
                    GitHub
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="social-chip">
                    LinkedIn
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-chip">
                    Instagram
                  </a>
                  <a href="https://x.com" target="_blank" rel="noreferrer" className="social-chip">
                    Twitter / X
                  </a>
                  <a href="https://discord.com" target="_blank" rel="noreferrer" className="social-chip">
                    Discord
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
                    <span className="btn-submit__arrow">→</span>
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
            <div className="more-drawer animate-fade-in-up">
              <div className="more-drawer__grid">
                <div className="more-drawer__col">
                  <h4>Workflow & Standar Mutu</h4>
                  <p>
                    Setiap pengerjaan dimulai dari riset interaksi, prototipe 3D, pemodelan asset ringan,
                    hingga integrasi WebGL 60 FPS dan audit performa Lighthouse.
                  </p>
                </div>
                <div className="more-drawer__col">
                  <h4>Optimasi Hardware & Mobile</h4>
                  <p>
                    Penggunaan Level-of-Detail (LOD), adaptive pixel ratio, dan dynamic shader quality
                    menjamin website tetap mulus di smartphone kelas menengah sekalipun.
                  </p>
                </div>
                <div className="more-drawer__col">
                  <h4>Curriculum Vitae</h4>
                  <p>Unduh berkas CV lengkap untuk rekapitulasi riwayat pengalaman profesional dan sertifikasi.</p>
                  <a href="#cv-download" className="btn-cv-download">
                    Download Resume (PDF)
                  </a>
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
