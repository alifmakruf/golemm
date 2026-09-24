import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import GolemHero from './components/GolemHero.jsx'
import SectionTwo from './components/SectionTwo.jsx'
import SectionThree from './components/SectionThree.jsx'
import SectionPortfolio from './components/SectionPortfolio.jsx'
import SidebarNav from './components/SidebarNav.jsx'
import TerrainLoader from './components/TerrainLoader.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import './App.css'

// ================== Parameter Tuning: Global App & Transisi ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Parallax terrain: intensitas gerak berlawanan arah mouse (px)
const PARALLAX_TERRAIN = 12

// 2. Durasi animasi fade out model 3D saat masuk ke Section 4 & 5 (website 2D)
const CANVAS_3D_FADEOUT_DURATION = '0.8s'

// 3. Tuning CSS Fog Overlay (kabut di lereng gunung)
const FOG_COLOR = 'rgba(169, 171, 172, 0.75)'  // Warna kabut
const FOG_BLUR = 40                            // Gaussian blur radius (px)
const FOG_WIDTH = '100%'                       // Lebar kabut
const FOG_HEIGHT = '50%'                       // Tinggi kabut
const FOG_BOTTOM = '-25%'                      // Posisi vertikal dari bawah viewport
const FOG_DRIFT_DURATION = '8s'                // Kecepatan animasi kabut

export default function App() {
  const [isLoadingComplete, setIsLoadingComplete] = useState(false)
  // Section Navigation State:
  // 1: Hero Golem
  // 2: Latar Belakang & Visi
  // 3: Tawaran Kami
  // 4: Portfolio & Clients (2D Mode)
  // 5: Kontak & Kolaborasi (2D Mode)
  const [activeSection, setActiveSection] = useState(1)

  const { active, progress } = useProgress()
  const timerRef = useRef(null)
  const [terrainParallax, setTerrainParallax] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e) => {
    const px = (e.clientX / window.innerWidth - 0.5) * 2
    const py = (e.clientY / window.innerHeight - 0.5) * 2
    setTerrainParallax({ x: px, y: py })
  }, [])

  // Sembunyikan loading screen saat aset selesai dimuat
  useEffect(() => {
    if (!active && progress === 100 && !isLoadingComplete) {
      timerRef.current = setTimeout(() => setIsLoadingComplete(true), 200)
    }
    return () => clearTimeout(timerRef.current)
  }, [active, progress, isLoadingComplete])

  // Handler pemilihan section dari Sidebar Nav burger menu
  const handleSelectSection = useCallback((secId) => {
    setActiveSection(secId)
    if (secId === 4) {
      setTimeout(() => {
        const el = document.getElementById('section-4')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    } else if (secId === 5) {
      setTimeout(() => {
        const el = document.getElementById('section-5')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    }
  }, [])

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  const is2DMode = activeSection >= 4 // Section 4 & 5 beralih ke website 2D

  return (
    <div className="app-container" onMouseMove={!isMobile ? handleMouseMove : undefined}>
      {/* Loading Screen */}
      {!isLoadingComplete && <LoadingScreen progress={progress} />}

      {/* New Sidebar Burger Navigation (Fixed di Pojok Kanan Atas 1-5) */}
      {isLoadingComplete && (
        <SidebarNav
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
        />
      )}

      {/* Terrain Canvas 3D (Gunung, Salju Dinamis, Debu Emas & Animasi Kamera) */}
      {/* Saat masuk Section 4 & 5 (2D Mode), Canvas 3D melakukan animasi Fadeout */}
      <div
        className={`app-terrain-layer ${isLoadingComplete ? 'animate-fade-in-up' : 'terrain-preload'}`}
        style={{
          opacity: is2DMode ? 0 : 1,
          pointerEvents: !is2DMode && isLoadingComplete ? 'auto' : 'none',
          transition: `opacity ${CANVAS_3D_FADEOUT_DURATION} ease`,
        }}
      >
        <Canvas
          camera={{ position: [11.68, 2.92, -0.94], fov: 45 }}
          dpr={isMobile ? [1, 1.25] : [1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            clearColor: 0x000000,
            clearAlpha: 0,
            powerPreference: 'high-performance',
          }}
          style={{
            position: 'fixed',
            inset: isMobile ? 0 : -PARALLAX_TERRAIN,
            width: isMobile ? '100vw' : `calc(100vw + ${PARALLAX_TERRAIN * 2}px)`,
            height: isMobile ? '100vh' : `calc(100vh + ${PARALLAX_TERRAIN * 2}px)`,
            zIndex: 1,
            pointerEvents: !is2DMode && isLoadingComplete ? 'auto' : 'none',
            transform: isMobile ? 'none' : `translate(${terrainParallax.x * -PARALLAX_TERRAIN}px, ${terrainParallax.y * -PARALLAX_TERRAIN}px)`,
            transition: 'transform 0.15s ease-out',
            willChange: isMobile ? 'auto' : 'transform',
          }}
        >
          <TerrainLoader activeSection={activeSection} />
        </Canvas>
      </div>

      {/* CSS Fog Overlay di lereng gunung (Fadeout di 2D Mode) */}
      {isLoadingComplete && (
        <div
          style={{
            position: 'fixed',
            bottom: FOG_BOTTOM,
            left: '50%',
            transform: 'translateX(-50%)',
            width: FOG_WIDTH,
            height: FOG_HEIGHT,
            background: FOG_COLOR,
            borderRadius: '50%',
            filter: `blur(${FOG_BLUR}px)`,
            zIndex: 3,
            pointerEvents: 'none',
            opacity: is2DMode ? 0 : 1,
            transition: `opacity ${CANVAS_3D_FADEOUT_DURATION} ease`,
            animation: `fog-drift ${activeSection === 2 ? '4.5s' : FOG_DRIFT_DURATION} ease-in-out infinite alternate`,
          }}
        />
      )}

      {/* Section 1 Layer: Hero Golem */}
      <div className={`app-content ${isLoadingComplete ? 'app-content--loaded' : ''}`}>
        <GolemHero
          onExplore={() => setActiveSection(2)}
          isExiting={activeSection >= 2}
        />
      </div>

      {/* Section 2 Layer: 3D Car-Glass Cards (Latar Belakang & Visi) */}
      {isLoadingComplete && (
        <SectionTwo
          isVisible={activeSection === 2}
          onBack={() => setActiveSection(1)}
          onNext={() => setActiveSection(3)}
        />
      )}

      {/* Section 3 Layer: 3D Car-Glass Cards (Tawaran Kami) */}
      {isLoadingComplete && (
        <SectionThree
          isVisible={activeSection === 3}
          onBack={() => setActiveSection(2)}
          onNext={() => setActiveSection(4)}
        />
      )}

      {/* Section 4 & 5 Layer: Website 2D Sheet Putih (Portfolio, Tech Stack, Clients, Kontak) */}
      {isLoadingComplete && (
        <SectionPortfolio
          isVisible={is2DMode}
          onBackTo3D={() => setActiveSection(3)}
        />
      )}
    </div>
  )
}
