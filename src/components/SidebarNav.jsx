import { useState, useEffect } from 'react'
import './style/SidebarNav.css'

// ================== Parameter Tuning: Sidebar Navigation (Burger Menu) ==================
// Anda dapat menyesuaikan tampilan & posisi navigasi di sini:
const SIDEBAR_WIDTH = '320px'             // Lebar panel sidebar saat terbuka
const BURGER_TOP = '1.8rem'               // Jarak tombol burger dari atas viewport
const BURGER_RIGHT = '2.2rem'             // Jarak tombol burger dari kanan viewport
const SIDEBAR_ANIM_DURATION = '0.35s'     // Kecepatan slide-in drawer

// Sesuai Perbaikan 1.1 di target.txt:
// 1. Background burger 90% transparan (0.1 opacity) dengan efek inner blur 10px
const BURGER_BG_OPACITY = 0.10            // 90% transparan
const BURGER_BLUR_PX = 10                 // Efek blur 10px
// 2. Background sidebar juga 90% transparan (0.1 opacity) dengan efek inner blur 10px
const SIDEBAR_BG_OPACITY = 0.10           // 90% transparan
const SIDEBAR_BLUR_PX = 10                // Efek blur 10px

export default function SidebarNav({ activeSection, onSelectSection }) {
  const [isOpen, setIsOpen] = useState(false)

  // Tutup sidebar saat tombol Escape ditekan
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const navItems = [
    { id: 1, num: '01', title: 'Hero Golem', desc: 'Eksplorasi Karakter 3D' },
    { id: 2, num: '02', title: 'Latar Belakang & Visi', desc: 'Tentang GOLEM.inc' },
    { id: 3, num: '03', title: 'Tawaran Kami', desc: 'Penawaran Eksklusif' },
    { id: 4, num: '04', title: 'Portfolio & Client', desc: 'Selected Works & Tech Stack' },
    { id: 5, num: '05', title: 'Kontak & Kolaborasi', desc: 'Mulai Diskusi Proyek' },
  ]

  const handleNavClick = (sectionId) => {
    setIsOpen(false)
    if (onSelectSection) {
      onSelectSection(sectionId)
    }
  }

  return (
    <>
      {/* Tombol Burger Fixed di Pojok Kanan Atas */}
      <button
        className={`burger-btn ${isOpen ? 'burger-btn--open' : ''}`}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Tutup navigasi' : 'Buka navigasi'}
        style={{
          top: BURGER_TOP,
          right: BURGER_RIGHT,
          '--burger-bg': `rgba(15, 23, 42, ${BURGER_BG_OPACITY})`,
          '--burger-blur': `${BURGER_BLUR_PX}px`,
        }}
      >
        <span className="burger-line burger-line--1" />
        <span className="burger-line burger-line--2" />
        <span className="burger-line burger-line--3" />
      </button>

      {/* Backdrop semi-transparan saat sidebar terbuka */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer Sidebar Glassmorphism */}
      <aside
        className={`sidebar-drawer ${isOpen ? 'sidebar-drawer--open' : ''}`}
        style={{
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-dur': SIDEBAR_ANIM_DURATION,
          '--sidebar-bg': `rgba(10, 15, 29, ${SIDEBAR_BG_OPACITY})`,
          '--sidebar-blur': `${SIDEBAR_BLUR_PX}px`,
        }}
      >
        <div className="sidebar-header">
          <span className="sidebar-badge">GOLEM.Inc</span>
          <h3 className="sidebar-title">Menu</h3>
        </div>

        <nav className="sidebar-nav-list">
          {navItems.map((item) => {
            const isActive = activeSection === item.id

            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
                type="button"
                onClick={() => handleNavClick(item.id)}
              >
                <div className="sidebar-nav-item__left">
                  <span className="sidebar-nav-num">{item.num}</span>
                  <div className="sidebar-nav-text">
                    <span className="sidebar-nav-heading">{item.title}</span>
                    <span className="sidebar-nav-desc">{item.desc}</span>
                  </div>
                </div>
                {isActive && <span className="sidebar-active-dot" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-footer-text">GOLEM.inc 3D Experience</span>
          <span className="sidebar-version">Version 2.0</span>
        </div>
      </aside>
    </>
  )
}
