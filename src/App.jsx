import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import GolemHero from './components/GolemHero.jsx'
import TerrainLoader from './components/TerrainLoader.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import './App.css'

// Parallax terrain: bergerak berlawanan arah mouse (depth illusion)
const PARALLAX_TERRAIN = 12 // px max geser terrain saat mouse di ujung

// ---- Tuning: CSS Fog Overlay ----
const FOG_COLOR = 'rgba(169, 171, 172, 0.75)'  // warna kabut
const FOG_BLUR = 40            // gaussian blur radius (px)
const FOG_WIDTH = '100%'        // lebar elips kabut
const FOG_HEIGHT = '50%'     // tinggi elips kabut
const FOG_BOTTOM = '-25%'       // posisi dari bawah viewport
const FOG_DRIFT_DURATION = '8s' // durasi animasi drift kiri↔kanan

export default function App() {
  const [isLoadingComplete, setIsLoadingComplete] = useState(false)
  const { active, progress } = useProgress()
  const timerRef = useRef(null)
  const [terrainParallax, setTerrainParallax] = useState({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e) => {
    // Posisi relatif viewport: -1..1
    const px = (e.clientX / window.innerWidth - 0.5) * 2
    const py = (e.clientY / window.innerHeight - 0.5) * 2
    setTerrainParallax({ x: px, y: py })
  }, [])

  // Sembunyikan loading saat asset benar-benar selesai (progress 100% & tidak active)
  // lalu tunggu 0.2s sebelum show terrain
  useEffect(() => {
    if (!active && progress === 100 && !isLoadingComplete) {
      timerRef.current = setTimeout(() => setIsLoadingComplete(true), 200)
    }
    return () => clearTimeout(timerRef.current)
  }, [active, progress, isLoadingComplete])

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  return (
    <div className="app-container" onMouseMove={!isMobile ? handleMouseMove : undefined}>
      {/* Loading Screen - tampil sampai asset benar-benar selesai dimuat */}
      {!isLoadingComplete && <LoadingScreen progress={progress} />}

      {/* Mouse Trail - efek melukis di air (hanya desktop) */}

      {/* Terrain Canvas 3D */}
      <div className={`app-terrain-layer ${isLoadingComplete ? 'animate-fade-in-up' : 'terrain-preload'}`}>
        <Canvas
          camera={{ position: [11.68, 2.92, -0.94], fov: 45 }}
          dpr={isMobile ? [1, 1.25] : [1, 1.5]}
          gl={{ antialias: true, alpha: true, clearColor: 0x000000, clearAlpha: 0, powerPreference: 'high-performance' }}
          style={{
            position: 'fixed',
            inset: isMobile ? 0 : -PARALLAX_TERRAIN,          // oversized di desktop untuk parallax
            width: isMobile ? '100vw' : `calc(100vw + ${PARALLAX_TERRAIN * 2}px)`,
            height: isMobile ? '100vh' : `calc(100vh + ${PARALLAX_TERRAIN * 2}px)`,
            zIndex: 1,
            pointerEvents: isLoadingComplete ? 'auto' : 'none',
            transform: isMobile ? 'none' : `translate(${terrainParallax.x * -PARALLAX_TERRAIN}px, ${terrainParallax.y * -PARALLAX_TERRAIN}px)`,
            transition: 'transform 0.15s ease-out',
            willChange: isMobile ? 'auto' : 'transform',
          }}
        >
          <TerrainLoader />
        </Canvas>
      </div>

      {/* CSS Fog overlay: elips gaussian blur di depan gunung */}
      {isLoadingComplete && (
        <div style={{
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
          animation: `fog-drift ${FOG_DRIFT_DURATION} ease-in-out infinite alternate`,
        }} />
      )}

      {/* Main Content Layer */}
      <div className={`app-content ${isLoadingComplete ? 'app-content--loaded' : ''}`}>
        <GolemHero />
      </div>
    </div>
  )
}
