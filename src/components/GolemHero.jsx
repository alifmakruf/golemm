import { Suspense, useCallback, useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import GolemModel from './GolemModel.jsx'
import { EASE } from '../gsap/eases.js'
import './style/GolemHero.css'

gsap.registerPlugin(useGSAP)

// ---- Tuning: Bloom pada golem ----
const GOLEM_BLOOM_INTENSITY = 0.5   // glow mata golem
const GOLEM_BLOOM_THRESHOLD = 0.1   // hanya area terang yang bloom
const GOLEM_BLOOM_SMOOTHING = 0.1
const GOLEM_BLOOM_RADIUS = 0.1

// ================== Kontrol transform & kamera ==================
// Panel "Location / Rotation / Scale" ala Blender, tapi untuk React.
// Ubah angka-angka ini untuk mengatur ukuran, posisi, dan orientasi
// golem di dalam scene, tanpa perlu menyentuh logika animasi.
const MODEL_SCALE = 1.5           // ukuran keseluruhan model (Desktop) — diperkecil dari 1.7
const MODEL_POSITION = [-0.6, -0.5, 0]     // digeser ke pojok kiri-bawah (Desktop)
const MODEL_BASE_ROTATION = [-0.2, 0.3, 0] // menoleh ke teks hero di kanan (Desktop)

// CATATAN PENTING soal "kepotong": ukuran KOTAK canvas di CSS TIDAK menentukan
// apakah model kepotong atau tidak — yang menentukan adalah CAMERA_POSITION
// (jarak kamera) & CAMERA_FOV (sudut pandang). Karena golem sekarang digeser
// ke pojok (-0.6, -0.5), kamera dimundurkan sedikit (z: 3.4 -> 3.9) dan FOV
// dilebarkan sedikit (35 -> 38) supaya area yang terlihat lebih luas dan
// bagian pojok model tidak terpotong oleh tepi frustum kamera.
const CAMERA_POSITION = [0, 0, 3.9] // [x, y, z] posisi kamera — dimundurkan agar ada ruang ekstra
const CAMERA_FOV = 38 // field of view kamera (derajat) — sedikit dilebarkan

// ---- Tuning: Responsif Tablet & HP ----
const MOBILE_MODEL_SCALE = 1.35        // golem diperkecil di tablet/hp
const MOBILE_MODEL_POSITION = [0, 0, 0] // golem pas di tengah di tablet/hp
const MOBILE_BASE_ROTATION = [0.05, 0, 0] // menghadap depan di tablet/hp

// ================== Parallax sensitivity ==================
// Hanya untuk canvas golem — satuan px
const PARALLAX_CANVAS = 6 // canvas golem bergerak saat mouse move

// ================== Parameter Pencahayaan (Lighting) ==================
// Atur warna, posisi [x, y, z], dan intensitas masing-masing lampu di sini.
const LIGHTS = {
  ambient: {
    color: '#ffffff',
    intensity: 1.2,
  },
  // Lampu utama (key light): menerangi bentuk & tekstur batu
  key: {
    color: '#fffef5',
    position: [4, 4, 3],
    intensity: 2.8,
  },
  // Lampu pengisi (fill light): aksen biru langit lembut
  fill: {
    color: '#bae6fd',
    position: [-3, 1, 2],
    intensity: 1.6,
  },
  // Lampu siluet / rim: aksen hangat kuning lembut
  rim: {
    color: '#fef08a',
    position: [0, 4, -2],
    intensity: 1.8,
  },
}

// ---- Tuning: Transisi Kamera & Animasi Masuk Section 1 ----
const HERO_CAMERA_RETURN_DELAY_MS = 650 // Delay (ms) menunggu kamera 3D sampai di Section 1 baru mainkan animasi in (fadeInUp)

// ---- Tuning: Animasi GSAP (In/Out & Micro-animations) ----
const ENTRANCE_INITIAL_DELAY_CANVAS = 2.4   // detik — delay entrance pertama kali web dibuka (canvas)
const ENTRANCE_INITIAL_DELAY_CONTENT = 2.5  // detik — delay entrance pertama kali web dibuka (content kanan)
const ENTRANCE_INITIAL_DURATION = 0.85      // detik
const ENTRANCE_REENTER_DURATION = 0.85      // detik — saat kembali dari Section 2
const EXIT_HERO_DURATION = 0.75             // detik — saat meluncur keluar ke Section 2
const HERO_PARALLAX_LERP_SPEED = 0.08       // Kelembutan kelembaman mouse parallax (0.04 = sangat fluid ala igloo)

const MODERN_FLOAT_Y = -25                  // px — jarak melayang modern-glow
const MODERN_FLOAT_SCALE = 1.06
const MODERN_FLOAT_DURATION_BLUE = 16       // detik per arah (modern-glow--blue)
const MODERN_FLOAT_DURATION_YELLOW = 20     // detik per arah (modern-glow--yellow)
const SHAKE_DURATION = 0.6                  // detik total (shake-active)

export default function GolemHero({ onExplore, isExiting, isActive = true }) {
  const mouse = useRef({ x: 0, y: 0, active: false })
  const canvasContainerRef = useRef(null)
  const contentRightRef = useRef(null)
  const glowBlueRef = useRef(null)
  const glowYellowRef = useRef(null)
  const sectionRef = useRef(null)
  const entranceDoneRef = useRef(false)
  const [debris, setDebris] = useState([])
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 960)

  // Nilai posisi mouse untuk Parallax via RAF (Zero Re-render)
  const mouseTargetRef = useRef({ x: 0, y: 0 })
  const mouseSmoothRef = useRef({ x: 0, y: 0 })
  const rafIdRef = useRef(null)

  const prevExiting = useRef(isExiting)
  const timerRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 960)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Parallax animation loop ber-lerp (inertial damping) yang fluid 60-120 FPS
  useEffect(() => {
    if (isMobile) return

    const tick = () => {
      const targetX = mouseTargetRef.current.x
      const targetY = mouseTargetRef.current.y

      mouseSmoothRef.current.x += (targetX - mouseSmoothRef.current.x) * HERO_PARALLAX_LERP_SPEED
      mouseSmoothRef.current.y += (targetY - mouseSmoothRef.current.y) * HERO_PARALLAX_LERP_SPEED

      const cx = mouseSmoothRef.current.x
      const cy = mouseSmoothRef.current.y

      if (canvasContainerRef.current && entranceDoneRef.current && !isExiting) {
        canvasContainerRef.current.style.transform = `translate3d(${cx * -PARALLAX_CANVAS}px, ${cy * -PARALLAX_CANVAS}px, 0)`
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [isMobile, isExiting])

  // GSAP: Kontrol Entrance & Exit Golem Hero secara menyeluruh & mulus
  useEffect(() => {
    if (isExiting) {
      entranceDoneRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)

      // Exit keluar layar: Golem ke kiri, konten teks ke kanan
      gsap.to(canvasContainerRef.current, {
        x: -window.innerWidth * 0.9,
        scale: 0.75,
        rotate: -10,
        opacity: 0,
        duration: EXIT_HERO_DURATION,
        ease: EASE.softOut2,
        overwrite: true,
      })
      gsap.to(contentRightRef.current, {
        x: window.innerWidth * 0.9,
        opacity: 0,
        duration: EXIT_HERO_DURATION,
        ease: EASE.softOut2,
        overwrite: true,
      })
    } else if (prevExiting.current) {
      // Re-enter saat user kembali dari Section 2 ke Section 1
      entranceDoneRef.current = false
      gsap.set(canvasContainerRef.current, { x: 0, y: 100, scale: 1, rotate: 0, opacity: 0 })
      gsap.set(contentRightRef.current, { x: 0, y: 100, opacity: 0 })

      timerRef.current = setTimeout(() => {
        gsap.to(canvasContainerRef.current, {
          y: 0,
          opacity: 1,
          duration: ENTRANCE_REENTER_DURATION,
          ease: EASE.softOut2,
          overwrite: true,
          onComplete: () => {
            entranceDoneRef.current = true
            window.dispatchEvent(new Event('resize'))
          },
        })
        gsap.to(contentRightRef.current, {
          y: 0,
          opacity: 1,
          duration: ENTRANCE_REENTER_DURATION,
          ease: EASE.softOut2,
          overwrite: true,
        })
      }, HERO_CAMERA_RETURN_DELAY_MS)
    } else {
      // Entrance pertama kali saat web dimuat
      gsap.fromTo(
        canvasContainerRef.current,
        { opacity: 0, y: 100 },
        {
          opacity: 1,
          y: 0,
          duration: ENTRANCE_INITIAL_DURATION,
          ease: EASE.softOut2,
          delay: ENTRANCE_INITIAL_DELAY_CANVAS,
          onComplete: () => {
            entranceDoneRef.current = true
            window.dispatchEvent(new Event('resize'))
          },
        }
      )
      gsap.fromTo(
        contentRightRef.current,
        { opacity: 0, y: 100 },
        {
          opacity: 1,
          y: 0,
          duration: ENTRANCE_INITIAL_DURATION,
          ease: EASE.softOut2,
          delay: ENTRANCE_INITIAL_DELAY_CONTENT,
        }
      )
    }

    prevExiting.current = isExiting
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isExiting])

  // GSAP — Modern glow "napas" melayang tanpa henti
  useGSAP(() => {
    gsap.to(glowBlueRef.current, {
      y: MODERN_FLOAT_Y,
      scale: MODERN_FLOAT_SCALE,
      duration: MODERN_FLOAT_DURATION_BLUE,
      ease: EASE.easeInOut,
      yoyo: true,
      repeat: -1,
    })
    gsap.fromTo(
      glowYellowRef.current,
      { y: MODERN_FLOAT_Y, scale: MODERN_FLOAT_SCALE },
      { y: 0, scale: 1, duration: MODERN_FLOAT_DURATION_YELLOW, ease: EASE.easeInOut, yoyo: true, repeat: -1 }
    )
  }, { scope: sectionRef })

  const handlePointerMove = useCallback((event) => {
    // Mouse relative ke canvas → untuk raycasting golem 3D
    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect()
      mouse.current.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
      mouse.current.y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
    }
    // Mouse relatif ke window → untuk parallax halus (tanpa setState)
    const px = (event.clientX / window.innerWidth - 0.5) * 2
    const py = (event.clientY / window.innerHeight - 0.5) * 2
    mouseTargetRef.current.x = px
    mouseTargetRef.current.y = py
  }, [])

  // Event listener khusus untuk canvas - cek apakah kursor di area model
  const handleCanvasPointerEnter = useCallback(() => {
    mouse.current.active = true
  }, [])

  const handleCanvasPointerLeave = useCallback(() => {
    mouse.current.active = false
  }, [])

  // GSAP — Efek guncang (shake) saat golem diklik.
  // Menggantikan: @keyframes shake (10 titik translate/rotate, ease-in-out per segmen)
  const playShakeAnimation = useCallback((el) => {
    if (!el) return
    const segDuration = SHAKE_DURATION / 10
    const steps = [
      { x: -6, y: -6, rotate: -0.8 },
      { x: 7, y: 5, rotate: 0.8 },
      { x: -5, y: 6, rotate: -0.6 },
      { x: 6, y: -5, rotate: 0.6 },
      { x: -4, y: 4, rotate: -0.4 },
      { x: 4, y: -4, rotate: 0.4 },
      { x: -2, y: 2, rotate: -0.2 },
      { x: 2, y: -2, rotate: 0.2 },
      { x: -1, y: 1, rotate: -0.1 },
      { x: 0, y: 0, rotate: 0 },
    ]
    const tl = gsap.timeline({ defaults: { duration: segDuration, ease: EASE.easeInOut } })
    steps.forEach((s) => tl.to(el, s))
    return tl
  }, [])

  // GSAP — Debris/krikil jatuh per-partikel saat mount.
  // Menggantikan: @keyframes fall-debris (ease-in, forwards, duration & delay per partikel)
  const animateDebrisParticle = useCallback((el, particle) => {
    if (!el || el.dataset.gsapAnimated) return
    el.dataset.gsapAnimated = '1'
    gsap.fromTo(
      el,
      { opacity: 1, y: -80, x: 0, rotate: particle.angle },
      {
        opacity: 0,
        y: '100vh',
        x: 20,
        rotate: particle.angle + 720,
        duration: particle.duration,
        delay: particle.delay,
        ease: EASE.easeIn,
      }
    )
  }, [])

  const handleModelClick = useCallback(() => {
    if (!sectionRef.current) return

    // Guncangkan section (dulunya: classList.add('shake-active'))
    playShakeAnimation(sectionRef.current)

    // Spawn debris particles
    const newDebris = Array.from({ length: 12 }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      left: Math.random() * 100, // posisi horizontal random 0-100%
      delay: Math.random() * 0.1, // delay 0-100ms
      duration: 1.2 + Math.random() * 0.4, // duration 1.2-1.6s
      size: 4 + Math.random() * 8, // ukuran krikil 4-12px
      angle: Math.random() * 360, // rotasi random
    }))

    setDebris(prev => [...prev, ...newDebris])

    // Hapus debris setelah animasi selesai
    setTimeout(() => {
      setDebris(prev =>
        prev.filter(d => !newDebris.some(nd => nd.id === d.id))
      )
    }, 2000)
  }, [playShakeAnimation])

  return (
    <section className="golem-hero" ref={sectionRef} onPointerMove={handlePointerMove}>
      {/* Falling debris/krikil */}
      <div className="debris-container">
        {debris.map(d => (
          <div
            key={d.id}
            className="debris-particle"
            ref={(el) => animateDebrisParticle(el, d)}
            style={{
              left: `${d.left}%`,
              width: `${d.size}px`,
              height: `${d.size}px`,
            }}
          />
        ))}
      </div>

      <div className="golem-hero__backdrop" aria-hidden="true">
        <div className="modern-glow modern-glow--blue" ref={glowBlueRef} />
        <div className="modern-glow modern-glow--yellow" ref={glowYellowRef} />
        <div className="modern-grid-pattern" />
      </div>

      <div className="golem-hero__content">
        <div
          className="golem-hero__canvas-container"
          ref={canvasContainerRef}
          onPointerEnter={handleCanvasPointerEnter}
          onPointerLeave={handleCanvasPointerLeave}
        >
          <Canvas
            frameloop={isActive ? 'always' : 'never'}
            camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
            dpr={isMobile ? [1, 1.25] : [1, 1.5]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          >

            <ambientLight color={LIGHTS.ambient.color} intensity={LIGHTS.ambient.intensity} />
            <directionalLight
              position={LIGHTS.key.position}
              color={LIGHTS.key.color}
              intensity={LIGHTS.key.intensity}
            />
            <directionalLight
              position={LIGHTS.fill.position}
              color={LIGHTS.fill.color}
              intensity={LIGHTS.fill.intensity}
            />
            <directionalLight
              position={LIGHTS.rim.position}
              color={LIGHTS.rim.color}
              intensity={LIGHTS.rim.intensity}
            />

            <Suspense fallback={null}>
              <GolemModel
                mouse={mouse}
                modelScale={isMobile ? MOBILE_MODEL_SCALE : MODEL_SCALE}
                modelPosition={isMobile ? MOBILE_MODEL_POSITION : MODEL_POSITION}
                baseRotation={isMobile ? MOBILE_BASE_ROTATION : MODEL_BASE_ROTATION}
                onModelClick={handleModelClick}
              />
            </Suspense>

            <EffectComposer multisampling={0}>
              <Bloom
                intensity={GOLEM_BLOOM_INTENSITY}
                luminanceThreshold={GOLEM_BLOOM_THRESHOLD}
                luminanceSmoothing={GOLEM_BLOOM_SMOOTHING}
                radius={GOLEM_BLOOM_RADIUS}
              />
            </EffectComposer>
          </Canvas>
        </div>

        <div className="golem-hero__content-right" ref={contentRightRef}>
          {/* <div className="hero-badge">
            <span className="hero-badge__dot" />
            <span>follow cursor interactive</span>
          </div> */}

          {/* Judul "GOLEM.inc" dipindah ke layer headline terpisah di App.jsx
              (app-headline-layer), supaya bisa berada DI BELAKANG Canvas terrain
              gunung tapi tetap DI ATAS layer langit. Lihat App.jsx & App.css. */}

          {/* <p className="hero-subtitle">
            cursor interaktif dengan keyframe animasi kedip sederhana menggunakan shape keys di blender agar objek tampak lebih hidup
          </p> */}

          <div className="hero-actions">
            <button className="btn-primary" type="button" onClick={onExplore}>
              Jelajahi Sekarang →
            </button>
            {/* <button className="btn-secondary" type="button">
              Lihat Demo
            </button> */}
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-card__val">WebGL</span>
              <span className="stat-card__lbl">Enchant Your Website</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__val">Parallax</span>
              <span className="stat-card__lbl">Interactive cursor moving</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__val">Post-Processing</span>
              <span className="stat-card__lbl">Visual Encahant</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
