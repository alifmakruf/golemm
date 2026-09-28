import { useState, useCallback, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { EASE } from './gsap/eases.js'
import GolemHero from './components/GolemHero.jsx'
import SectionTwo from './components/SectionTwo.jsx'
import SectionThree from './components/SectionThree.jsx'
import SectionPortfolio from './components/SectionPortfolio.jsx'
import SidebarNav from './components/SidebarNav.jsx'
import TerrainLoader, { SKY_COLOR } from './components/TerrainLoader.jsx'
import HeadlineModel, { HEADLINE_LAYER_HEIGHT_FRACTION } from './components/HeadlineModel.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import SplashCursor from './components/SplashCursor.jsx'
import './App.css'
import './perf.css' // override ringan khusus mobile (lihat isi file)

// ================== Parameter Tuning: Global App & Transisi ==================
// Anda dapat menyesuaikan parameter di bawah ini sesuka hati:

// 1. Parallax terrain & Headline:
// PARALLAX_TERRAIN        : intensitas gerak terrain berlawanan arah mouse (px)
// PARALLAX_HEADLINE       : intensitas gerak judul GOLEM (px) — lebih kecil agar tampak lebih dalam
// PARALLAX_LERP_SPEED     : kehalusan kelembaman kursor (0.04 = sangat fluid & luxury ala igloo, 0.2 = responsif tajam)
const PARALLAX_TERRAIN = 50
const PARALLAX_HEADLINE = 4
const PARALLAX_LERP_SPEED = 0.2

// 2. Durasi animasi fade out model 3D saat masuk ke Section 4 & 5 (website 2D)
const CANVAS_3D_FADEOUT_DURATION = '0.8s'

// 3. Tuning CSS Fog Overlay (kabut di lereng gunung)
// [OPTIMASI FPS] FOG_ENABLED: kabut ini berupa elemen 200% lebar layar dengan blur(40px) yang
// dianimasikan tanpa henti. Warnanya saat ini transparan penuh (alpha 0) — jadi tidak terlihat
// sama sekali tapi tetap memakan GPU tiap frame (paling terasa di HP). Aktifkan HANYA kalau
// FOG_COLOR diberi warna yang benar-benar terlihat.
const FOG_ENABLED = false
const FOG_COLOR = 'rgba(255, 255, 255, 0)'  // Warna kabut
const FOG_BLUR = 40                            // Gaussian blur radius (px)
const FOG_WIDTH = '200%'                       // Lebar kabut
const FOG_HEIGHT = '100%'                      // Tinggi kabut
const FOG_BOTTOM = '-25%'                      // Posisi vertikal dari bawah viewport
const FOG_DRIFT_DURATION = '1s'                // Kecepatan animasi kabut

// 4. Tuning SplashCursor (efek fluid cursor trail)
const SPLASH_ENABLED = true                    // Aktifkan/nonaktifkan efek cursor trail
const SPLASH_DENSITY_DISSIPATION = 7.5         // Kecepatan warna menghilang (7.5 = cepat, bersih)
const SPLASH_VELOCITY_DISSIPATION = 7.5        // Kecepatan aliran berhenti
const SPLASH_PRESSURE = 0.35                   // Tekanan fluid (0.0–1.0)
const SPLASH_CURL = 40                         // Intensitas pusaran (semakin tinggi = lebih swirl)
const SPLASH_SPLAT_RADIUS = 0.11               // Ukuran percikan fluid
const SPLASH_COLOR = '#174a4a'                 // Warna fluid (teal gelap)
const SPLASH_RAINBOW = false                   // true = warna pelangi acak, false = pakai SPLASH_COLOR

// ================== Parameter Tuning: Headline Belakang Terrain ==================
// Headline sekarang berupa model 3D (textgolem.glb) menggantikan teks "GOLEM".
// Semua parameter model (path file, scale, posisi, rotasi, kamera, lighting)
// ada di src/components/HeadlineModel.jsx — cari komentar "Tuning" di sana.
const HEADLINE_RETURN_DELAY_MS = 600           // Jeda waktu (ms) sebelum headline muncul kembali saat kembali ke Section 1
const HEADLINE_ENTRANCE_DURATION = 0.85        // Durasi masuk headline (detik)
const HEADLINE_EXIT_DURATION = 0.65            // Durasi keluar headline (detik)

export default function App() {
  const [isLoadingComplete, setIsLoadingComplete] = useState(false)
  const [activeSection, setActiveSection] = useState(1)

  const { active, progress } = useProgress()
  const timerRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  // Refs untuk elemen DOM
  const fogRef = useRef(null)
  const headlineLayerRef = useRef(null)
  const terrainLayerRef = useRef(null)
  const terrainWrapperRef = useRef(null)

  // Nilai posisi mouse untuk Parallax via RequestAnimationFrame (Zero Re-render)
  const mouseTargetRef = useRef({ x: 0, y: 0 })
  const mouseCurrentRef = useRef({ x: 0, y: 0 })
  const rafIdRef = useRef(null)
  const headlineEntranceDoneRef = useRef(false)

  // Status perpindahan section untuk Headline
  const isHeadlineExiting = activeSection >= 2
  const prevHeadlineExiting = useRef(isHeadlineExiting)

  // Mouse move handler: hanya update target koordinat ref, TANPA pemicu re-render React!
  const handleMouseMove = useCallback((e) => {
    const px = (e.clientX / window.innerWidth - 0.5) * 2
    const py = (e.clientY / window.innerHeight - 0.5) * 2
    mouseTargetRef.current.x = px
    mouseTargetRef.current.y = py
  }, [])

  // Parallax animation loop ber-lerp (inertial damping) yang fluid 60-120 FPS
  useEffect(() => {
    if (isMobile) return

    const tick = () => {
      const targetX = mouseTargetRef.current.x
      const targetY = mouseTargetRef.current.y

      // Lerp smoothing formula
      mouseCurrentRef.current.x += (targetX - mouseCurrentRef.current.x) * PARALLAX_LERP_SPEED
      mouseCurrentRef.current.y += (targetY - mouseCurrentRef.current.y) * PARALLAX_LERP_SPEED

      const cx = mouseCurrentRef.current.x
      const cy = mouseCurrentRef.current.y

      // Terapkan langsung ke transform terrain wrapper
      if (terrainWrapperRef.current) {
        terrainWrapperRef.current.style.transform = `translate3d(${cx * -PARALLAX_TERRAIN}px, ${cy * -PARALLAX_TERRAIN}px, 0)`
      }

      // Terapkan ke headline jika entrance sudah selesai
      if (headlineLayerRef.current && headlineEntranceDoneRef.current && !isHeadlineExiting) {
        headlineLayerRef.current.style.transform = `translate3d(${cx * -PARALLAX_HEADLINE}px, ${cy * -PARALLAX_HEADLINE}px, 0)`
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [isMobile, isHeadlineExiting])

  // GSAP Headline: Kontrol entrance dan exit secara bersih tanpa bentrok CSS !important
  useEffect(() => {
    if (!isLoadingComplete || !headlineLayerRef.current) return

    if (isHeadlineExiting) {
      headlineEntranceDoneRef.current = false
      gsap.to(headlineLayerRef.current, {
        opacity: 0,
        y: -120,
        duration: HEADLINE_EXIT_DURATION,
        ease: EASE.softOut2,
        overwrite: true,
      })
    } else if (prevHeadlineExiting.current) {
      // Re-enter saat kembali ke Section 1
      headlineEntranceDoneRef.current = false
      gsap.fromTo(
        headlineLayerRef.current,
        { opacity: 0, y: -80 },
        {
          opacity: 1,
          y: 0,
          delay: HEADLINE_RETURN_DELAY_MS / 1000,
          duration: HEADLINE_ENTRANCE_DURATION,
          ease: EASE.softOut2,
          overwrite: true,
          onComplete: () => {
            headlineEntranceDoneRef.current = true
          },
        }
      )
    } else {
      // First initial entrance langsung saat aset selesai loading
      gsap.fromTo(
        headlineLayerRef.current,
        { opacity: 0, y: -80 },
        {
          opacity: 1,
          y: 0,
          delay: 0.25,
          duration: HEADLINE_ENTRANCE_DURATION,
          ease: EASE.softOut2,
          onComplete: () => {
            headlineEntranceDoneRef.current = true
          },
        }
      )
    }

    prevHeadlineExiting.current = isHeadlineExiting
  }, [isHeadlineExiting, isLoadingComplete])

  // GSAP — Kabut lereng gunung
  useEffect(() => {
    if (!FOG_ENABLED || !fogRef.current) return
    const duration = activeSection === 2 ? 4.5 : 1
    gsap.fromTo(
      fogRef.current,
      { xPercent: -53 },
      { xPercent: -47, duration, ease: EASE.easeInOut, yoyo: true, repeat: -1, overwrite: true }
    )
  }, [activeSection])

  // ============================================================
  // GSAP — Fade-in terrain 3D saat loading selesai
  // (dulunya: class "animate-fade-in-up" -> @keyframes fadeInTerrain)
  // ============================================================
  useEffect(() => {
    if (!terrainLayerRef.current) return
    if (isLoadingComplete) {
      gsap.fromTo(
        terrainLayerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1.2, ease: EASE.easeOut }
      )
    } else {
      gsap.set(terrainLayerRef.current, { opacity: 0 })
    }
  }, [isLoadingComplete])

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

  const is2DMode = activeSection >= 4 // Section 4 & 5 beralih ke website 2D

  // [OPTIMASI FPS] Saat Section 4 & 5 (sheet putih menutupi layar), canvas terrain sudah
  // transparan (fade out) tapi dulu tetap dirender penuh tiap frame di belakang sheet.
  // Sekarang render loop-nya dihentikan setelah fade-out selesai, lalu dilanjutkan
  // begitu kembali ke Section 3.
  const [terrainPaused, setTerrainPaused] = useState(false)
  useEffect(() => {
    if (!is2DMode) {
      setTerrainPaused(false)
      return undefined
    }
    const t = setTimeout(
      () => setTerrainPaused(true),
      parseFloat(CANVAS_3D_FADEOUT_DURATION) * 1000 + 150
    )
    return () => clearTimeout(t)
  }, [is2DMode])

  const headlineClass = isHeadlineExiting ? 'app-headline-layer--exiting' : ''

  return (
    <div className="app-container" onMouseMove={!isMobile ? handleMouseMove : undefined}>
      {/* Loading Screen */}
      {!isLoadingComplete && <LoadingScreen progress={progress} />}

      {/* SplashCursor: Efek fluid cursor trail (desktop only, skip di mobile) */}
      {isLoadingComplete && !isMobile && SPLASH_ENABLED && !is2DMode && (
        <SplashCursor
          DENSITY_DISSIPATION={SPLASH_DENSITY_DISSIPATION}
          VELOCITY_DISSIPATION={SPLASH_VELOCITY_DISSIPATION}
          PRESSURE={SPLASH_PRESSURE}
          CURL={SPLASH_CURL}
          SPLAT_RADIUS={SPLASH_SPLAT_RADIUS}
          COLOR={SPLASH_COLOR}
          RAINBOW_MODE={SPLASH_RAINBOW}
        />
      )}

      {/* New Sidebar Burger Navigation (Fixed di Pojok Kanan Atas 1-5) */}
      {isLoadingComplete && (
        <SidebarNav
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
        />
      )}

      {/* Sky Layer (BARU): warna langit statis, paling belakang dari semua layer visual.
          Sebelumnya warna ini di-set sebagai scene.background di dalam Canvas
          (TerrainLoader), sehingga Canvas jadi opaque dan menutupi apapun di
          belakangnya. Sekarang dipindah ke sini sebagai div biasa, dan Canvas
          dibiarkan transparan supaya headline di bawah bisa terlihat menembus
          area kosong di sekitar gunung. */}
      <div className="app-sky-layer" style={{ backgroundColor: SKY_COLOR }} />

      {/* Headline Layer (BARU): Judul besar "GOLEM.inc" — berada DI BELAKANG
          Canvas terrain (gunung/salju/kunang-kunang) tapi DI ATAS layer langit,
          sehingga judul tampak seolah muncul/tertutup sebagian oleh gunung.
          Hanya tampil di Section 1 (Hero), fade out saat pindah section lain. */}
      {isLoadingComplete && (
        <div
          ref={headlineLayerRef}
          className={`app-headline-layer ${headlineClass}`}
          style={{ height: `${HEADLINE_LAYER_HEIGHT_FRACTION * 100}vh` }}
        >
          <HeadlineModel isMobile={isMobile} active={activeSection === 1} mouseRef={mouseCurrentRef} />
        </div>
      )}

      {/* CSS Fog Overlay di lereng gunung (Fadeout di 2D Mode).
          FIX: zIndex sebelumnya 3 (setara/di atas .app-content), sehingga
          fog malah menutupi konten Hero, bukan berada di antara headline
          dan terrain. Karena semua layer di sini position:fixed dengan
          z-index eksplisit, urutan JSX/DOM TIDAK berpengaruh ke tumpukan
          visual — hanya angka z-index yang menentukan. Urutan lengkapnya
          sekarang: sky(0) < headline(1) < fog(2) < terrain(3) < content(4).
          Lihat juga App.css untuk z-index terrain & content yang ikut
          disesuaikan. */}
      {FOG_ENABLED && isLoadingComplete && (
        <div
          ref={fogRef}
          style={{
            position: 'fixed',
            bottom: FOG_BOTTOM,
            left: '50%',
            width: FOG_WIDTH,
            height: FOG_HEIGHT,
            background: FOG_COLOR,
            borderRadius: '50%',
            filter: `blur(${FOG_BLUR}px)`,
            zIndex: 2,
            pointerEvents: 'none',
            opacity: is2DMode ? 0 : 1,
            transition: `opacity ${CANVAS_3D_FADEOUT_DURATION} ease`,
            transform: 'translateX(-53%)',
            // fog-drift (infinite alternate) sekarang dijalankan lewat GSAP (lihat useEffect di atas)
          }}
        />
      )}


      {/* Terrain Canvas 3D (Gunung, Salju Dinamis, Debu Emas & Animasi Kamera) */}
      {/* Saat masuk Section 4 & 5 (2D Mode), Canvas 3D melakukan animasi Fadeout */}
      <div ref={terrainLayerRef} className={isLoadingComplete ? '' : 'terrain-preload'}>
        <div
          ref={terrainWrapperRef}
          className="app-terrain-layer"
          style={{
            opacity: is2DMode ? 0 : 1,
            pointerEvents: !is2DMode && isLoadingComplete ? 'auto' : 'none',
            transition: `opacity ${CANVAS_3D_FADEOUT_DURATION} ease`,
            willChange: isMobile ? 'auto' : 'transform',
          }}
        >
          <Canvas
            frameloop={terrainPaused ? 'never' : 'always'}
            camera={{ position: [11.68, 2.92, -0.94], fov: 45 }}
            dpr={isMobile ? [1, 1.25] : [1, 1.5]}
            gl={{
              // antialias:false -> tidak ada perubahan visual (scene dirender lewat EffectComposer
              // multisampling 0, jadi MSAA bawaan canvas memang tidak terpakai), tapi hemat memori & bandwidth GPU.
              antialias: false,
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
            }}
          >
            <TerrainLoader activeSection={activeSection} />
          </Canvas>
        </div>
      </div>


      {/* Section 1 Layer: Hero Golem */}
      <div className={`app-content ${isLoadingComplete ? 'app-content--loaded' : ''} ${activeSection >= 2 ? 'app-content--inactive' : ''}`}>
        <GolemHero
          onExplore={() => setActiveSection(2)}
          isExiting={activeSection >= 2}
          isActive={activeSection === 1}
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