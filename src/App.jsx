import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import GolemHero from './components/GolemHero.jsx'
import GolemDetail from './components/GolemDetail.jsx'
import TerrainLoader from './components/TerrainLoader.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import './App.css'

export default function App() {
  const [currentSection, setCurrentSection] = useState('hero')
  const [isLoadingComplete, setIsLoadingComplete] = useState(false)
  const { active, progress } = useProgress()
  const timerRef = useRef(null)

  // Sembunyikan loading saat asset benar-benar selesai (progress 100% & tidak active)
  // lalu tunggu 0.2s sebelum show terrain
  useEffect(() => {
    if (!active && progress === 100 && !isLoadingComplete) {
      timerRef.current = setTimeout(() => setIsLoadingComplete(true), 200)
    }
    return () => clearTimeout(timerRef.current)
  }, [active, progress, isLoadingComplete])

  const handleNavigateToDetail = () => {
    setCurrentSection('detail')
    window.scrollTo(0, 0)
  }

  const handleBackToHero = () => {
    setCurrentSection('hero')
    window.scrollTo(0, 0)
  }

  return (
    <div className="app-container">
      {/* Loading Screen - tampil sampai asset benar-benar selesai dimuat */}
      {!isLoadingComplete && <LoadingScreen progress={progress} />}

      {/* Terrain Canvas selalu di-render sejak awal (di balik loading screen) */}
      {currentSection === 'hero' && (
        <div className={`app-terrain-layer ${isLoadingComplete ? 'animate-fade-in-up' : 'terrain-preload'}`}>
          <Canvas
            camera={{ position: [11.68, 2.92, -0.94], fov: 45 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, clearColor: 0x000000, clearAlpha: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1,
              pointerEvents: isLoadingComplete ? 'auto' : 'none',
            }}
          >
            <TerrainLoader />
          </Canvas>
        </div>
      )}

      {/* Main Content Layer - di-render sejak awal agar golem ikut di-preload */}
      <div className={`app-content ${isLoadingComplete ? 'app-content--loaded' : ''}`}>
        {currentSection === 'hero' && (
          <GolemHero onExplore={handleNavigateToDetail} />
        )}
        {currentSection === 'detail' && <GolemDetail onBack={handleBackToHero} />}
      </div>
    </div>
  )
}
