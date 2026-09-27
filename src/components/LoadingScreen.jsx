import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { EASE } from '../gsap/eases.js'
import './style/LoadingScreen.css'

gsap.registerPlugin(useGSAP)

// Progress 0-100 dari useProgress (asset loading asli Three.js)
export default function LoadingScreen({ progress = 0 }) {
  const rootRef = useRef(null)
  const textRef = useRef(null)
  const statusRef = useRef(null)
  const progressTrackRef = useRef(null)
  const spinnerRef = useRef(null)
  const ring1Ref = useRef(null)
  const ring2Ref = useRef(null)
  const ring3Ref = useRef(null)
  const dotsRef = useRef(null)

  // ============================================================
  // GSAP — semua animasi loading screen (dulunya @keyframes):
  // fadeInScale, fadeInUp x2, rotateSpinner, spinnerRotate x3, dotPulse.
  // progressShimmer TIDAK dikonversi karena di kode aslinya sudah
  // dimatikan lewat inline style `animation: 'none'` pada .progress-bar
  // (jadi memang tidak pernah kelihatan jalan) — perilaku ini dipertahankan.
  // ============================================================
  useGSAP(() => {
    // Entrance logo (fadeInScale 1.2s, tanpa delay)
    gsap.fromTo(textRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 1.2, ease: EASE.softOut }
    )
    // Entrance status text (fadeInUp 1.2s, delay 0.2s, both)
    gsap.fromTo(statusRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1.2, ease: EASE.softOut, delay: 0.2 }
    )
    // Entrance progress track (fadeInUp 1.2s, delay 0.4s, both)
    gsap.fromTo(progressTrackRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1.2, ease: EASE.softOut, delay: 0.4 }
    )

    // Spinner luar: rotateSpinner 2s linear infinite (rotate + scale "napas")
    gsap.timeline({ repeat: -1, defaults: { ease: 'none', duration: 1 } })
      .to(spinnerRef.current, { rotate: 180, scale: 1.1 })
      .to(spinnerRef.current, { rotate: 360, scale: 1 })

    // 3 ring dalam: spinnerRotate, kecepatan & arah beda-beda
    gsap.to(ring1Ref.current, { rotate: 360, duration: 1.5, ease: 'none', repeat: -1 })
    gsap.to(ring2Ref.current, { rotate: -360, duration: 1.8, ease: 'none', repeat: -1 }) // reverse
    gsap.to(ring3Ref.current, { rotate: 360, duration: 1.2, ease: 'none', repeat: -1 })

    // Titik "..." berjalan (dotPulse 1.5s ease-in-out infinite) — dikonversi
    // dari ::after + `content` (tidak bisa dianimasikan GSAP) menjadi span asli.
    const dotsEl = dotsRef.current
    if (dotsEl) {
      gsap.timeline({ repeat: -1 })
        .call(() => { dotsEl.textContent = '' }, [], 0)
        .call(() => { dotsEl.textContent = '.' }, [], 0.6)
        .call(() => { dotsEl.textContent = '..' }, [], 0.9)
        .call(() => { dotsEl.textContent = '...' }, [], 1.2)
        .to({}, { duration: 0.3 })
    }
  }, { scope: rootRef })

  return (
    <div className="loading-screen" ref={rootRef}>
      <div className="loading-content">
        <div className="loading-logo">
          <span className="loading-text" ref={textRef}>Golem.Inc</span>
        </div>

        <div className="loading-spinner" ref={spinnerRef}>
          <div className="spinner-ring" ref={ring1Ref} />
          <div className="spinner-ring" ref={ring2Ref} />
          <div className="spinner-ring" ref={ring3Ref} />
        </div>

        <p className="loading-status" ref={statusRef}>
          Just Wait &amp; See
          <span className="loading-status__dots" ref={dotsRef} aria-hidden="true" />
        </p>

        <div className="loading-progress" ref={progressTrackRef}>
          <div className="progress-bar" style={{ width: `${progress}%`, animation: 'none' }} />
        </div>
      </div>

      <div className="loading-backdrop" />
    </div>
  )
}
