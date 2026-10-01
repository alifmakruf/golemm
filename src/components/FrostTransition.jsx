import { useRef, useEffect, useMemo } from 'react'
import gsap from 'gsap'
import './style/FrostTransition.css'

// ================== Parameter Tuning: Crumpled Paper Wireframe Frost ==================
export const FROST_CONFIG = {
  // --- Kehalusan Animasi GSAP ---
  animDuration: 0.85,
  animEase: 'power2.out',

  // --- Step Persentase Transisi ---
  // Arah masuk (Section 3 → 3.5): 2 scroll
  // Step 1 = 10%, Step 2 = 100%
  inSteps: [0, 0.10, 1.00],

  restProgress: -0.30,

  // Arah keluar (Section 3.5 → 4):
  outSteps: [0.00, 0.30, 0.65, 1.00],

  // --- Parameter Visual Wireframe Kertas Kusut ---
  gridCols: 50,
  gridRows: 30,
  jitterAmount: 0.92,
  creaseDepth: 50,

  feather: 0.35,                 // Kelembutan tepi rambatan saat diam

  lineWidth: 0.2,
  lineColor: 'rgba(103, 232, 249, ',
  lineBaseOpacity: 0.25,

  facetColor: 'rgba(186, 230, 253, ',
  facetMaxOpacity: 0.10,

  nodeDotSize: 1,
  nodeDotColor: 'rgba(255, 255, 255, 0.85)',

  edgeGlowColor: 'rgba(255, 255, 255, 0.55)',

  // --- Motion Blur: HANYA aktif saat transisi menuju 100% ---
  motionBlur: {
    enabled: true,
    featherBoost: 0.9,           // Tambahan kelembutan tepi saat paling cepat
    zoomTrail: 0.10,             // Panjang jejak zoom-blur maksimum (selisih skala, 0.10 = 10%)
    samples: 5,                  // Jumlah lapisan blur (makin banyak makin halus, makin berat)
    distRef: 0.6,                // Jarak progress yang dianggap "lompatan penuh" (kecil = lebih sensitif)
  },
}

export default function FrostTransition({ scrollStep = 0, direction = 'in' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const offRef = useRef(null)            // canvas offscreen untuk zoom-blur (dibuat hanya saat dibutuhkan)
  const progressAnimRef = useRef({ value: 0 })
  const tweenRef = useRef(null)
  const blurRef = useRef(0)              // intensitas motion blur 0-1 (selalu 0 kecuali menuju 100%)

  // Hitung target progress saat ini
  let targetProgress = 0
  if (direction === 'in') {
    const idx = Math.min(Math.max(scrollStep, 0), FROST_CONFIG.inSteps.length - 1)
    targetProgress = FROST_CONFIG.inSteps[idx]
  } else if (direction === 'inside') {
    targetProgress = FROST_CONFIG.restProgress
  } else if (direction === 'out') {
    const idx = Math.min(Math.max(scrollStep, 0), FROST_CONFIG.outSteps.length - 1)
    targetProgress = FROST_CONFIG.outSteps[idx]
  }

  // Generate struktur faset kertas kusut sekali
  const meshData = useMemo(() => {
    const cols = FROST_CONFIG.gridCols
    const rows = FROST_CONFIG.gridRows
    const vertices = []

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const u = c / cols
        const v = r / rows

        const isBorder = c === 0 || c === cols || r === 0 || r === rows
        const jitter = isBorder ? 0 : FROST_CONFIG.jitterAmount

        const jx = (Math.random() - 0.5) * (1 / cols) * jitter
        const jy = (Math.random() - 0.5) * (1 / rows) * jitter
        const jz = (Math.random() - 0.5) * FROST_CONFIG.creaseDepth

        vertices.push({
          u: Math.max(0, Math.min(1, u + jx)),
          v: Math.max(0, Math.min(1, v + jy)),
          z: jz,
          centerDist: Math.hypot((u - 0.5) * 2, (v - 0.5) * 2),
        })
      }
    }

    const triangles = []
    const lightDir = { x: -0.4, y: -0.6, z: 0.7 }
    const lightLen = Math.hypot(lightDir.x, lightDir.y, lightDir.z)
    const lx = lightDir.x / lightLen
    const ly = lightDir.y / lightLen
    const lz = lightDir.z / lightLen

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i0 = r * (cols + 1) + c
        const i1 = i0 + 1
        const i2 = (r + 1) * (cols + 1) + c
        const i3 = i2 + 1

        const flip = (r + c) % 2 === 0
        const triPairs = flip
          ? [[i0, i1, i3], [i0, i3, i2]]
          : [[i0, i1, i2], [i1, i3, i2]]

        triPairs.forEach(([a, b, d]) => {
          const va = vertices[a]
          const vb = vertices[b]
          const vd = vertices[d]

          const abx = (vb.u - va.u)
          const aby = (vb.v - va.v)
          const abz = (vb.z - va.z) * 0.01

          const adx = (vd.u - va.u)
          const ady = (vd.v - va.v)
          const adz = (vd.z - va.z) * 0.01

          let nx = aby * adz - abz * ady
          let ny = abz * adx - abx * adz
          let nz = abx * ady - aby * adx
          const nlen = Math.hypot(nx, ny, nz) || 1
          nx /= nlen
          ny /= nlen
          nz /= nlen

          const dot = Math.abs(nx * lx + ny * ly + nz * lz)
          const avgDist = (va.centerDist + vb.centerDist + vd.centerDist) / 3

          triangles.push({
            indices: [a, b, d],
            shade: dot,
            centerDist: avgDist,
          })
        })
      }
    }

    return { vertices, triangles }
  }, [])

  // Gambar mesh ke ctx tertentu (sama persis dengan kode awal; feather bisa melebar saat motion blur)
  const drawMesh = (ctx, w, h, currentProg, feather) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)

    if (currentProg <= 0.001) return

    const revealThreshold = (1 - currentProg) * 1.35
    const { vertices, triangles } = meshData

    // 1. Faset bayangan
    triangles.forEach((tri) => {
      const diff = tri.centerDist - revealThreshold
      if (diff < -feather) return

      const tAlpha = Math.min(1, Math.max(0, (diff + feather) / feather))
      if (tAlpha <= 0) return

      const v0 = vertices[tri.indices[0]]
      const v1 = vertices[tri.indices[1]]
      const v2 = vertices[tri.indices[2]]

      ctx.beginPath()
      ctx.moveTo(v0.u * w, v0.v * h)
      ctx.lineTo(v1.u * w, v1.v * h)
      ctx.lineTo(v2.u * w, v2.v * h)
      ctx.closePath()

      const facetAlpha = (FROST_CONFIG.facetMaxOpacity * (0.4 + tri.shade * 0.6) * tAlpha).toFixed(3)
      ctx.fillStyle = `${FROST_CONFIG.facetColor}${facetAlpha})`
      ctx.fill()
    })

    // 2. Garis wireframe
    ctx.lineWidth = FROST_CONFIG.lineWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    triangles.forEach((tri) => {
      const diff = tri.centerDist - revealThreshold
      if (diff < -feather) return

      const tAlpha = Math.min(1, Math.max(0, (diff + feather) / feather))
      if (tAlpha <= 0) return

      const v0 = vertices[tri.indices[0]]
      const v1 = vertices[tri.indices[1]]
      const v2 = vertices[tri.indices[2]]

      ctx.beginPath()
      ctx.moveTo(v0.u * w, v0.v * h)
      ctx.lineTo(v1.u * w, v1.v * h)
      ctx.lineTo(v2.u * w, v2.v * h)
      ctx.closePath()

      const strokeAlpha = (FROST_CONFIG.lineBaseOpacity * tAlpha * (0.6 + tri.shade * 0.4)).toFixed(3)
      ctx.strokeStyle = `${FROST_CONFIG.lineColor}${strokeAlpha})`
      ctx.stroke()
    })

    // 3. Titik simpul kristal
    if (FROST_CONFIG.nodeDotSize > 0) {
      ctx.fillStyle = FROST_CONFIG.nodeDotColor
      vertices.forEach((v) => {
        const diff = v.centerDist - revealThreshold
        if (diff < -feather * 0.5) return
        const tAlpha = Math.min(1, Math.max(0, (diff + feather * 0.5) / feather))
        if (tAlpha < 0.2) return

        ctx.beginPath()
        ctx.arc(v.u * w, v.v * h, FROST_CONFIG.nodeDotSize, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }

  // Render satu frame ke canvas utama.
  // b = 0 → render biasa (persis kode awal). b > 0 → motion blur (hanya saat menuju 100%).
  const renderCanvas = (currentProg) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const mb = FROST_CONFIG.motionBlur
    const b = mb.enabled ? blurRef.current : 0

    if (b < 0.02) {
      drawMesh(ctx, w, h, currentProg, FROST_CONFIG.feather)
      return
    }

    // Gambar mesh sekali ke offscreen, lalu tumpuk beberapa lapisan berskala (zoom blur radial)
    let off = offRef.current
    if (!off) off = offRef.current = document.createElement('canvas')
    if (off.width !== w || off.height !== h) {
      off.width = w
      off.height = h
    }
    drawMesh(off.getContext('2d'), w, h, currentProg, FROST_CONFIG.feather + b * mb.featherBoost)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)

    const n = mb.samples
    const trail = mb.zoomTrail * b
    // Rata-rata berjalan: lapisan ke-i beralpha 1/(i+1) → semua lapisan berbobot sama.
    // Skala hanya membesar (≥ 1) agar pinggir layar tetap tertutup.
    for (let i = 0; i < n; i++) {
      const s = 1 + trail * (i / (n - 1))
      ctx.globalAlpha = 1 / (i + 1)
      ctx.setTransform(s, 0, 0, s, (w / 2) * (1 - s), (h / 2) * (1 - s))
      ctx.drawImage(off, 0, 0)
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
  }

  // Handle Resize Canvas untuk Retina / High-DPI Display
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      renderCanvas(progressAnimRef.current.value)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [meshData])

  // GSAP Ultra-Smooth Tweening
  useEffect(() => {
    if (tweenRef.current) tweenRef.current.kill()

    const state = progressAnimRef.current
    const mb = FROST_CONFIG.motionBlur
    blurRef.current = 0

    // Tidak perlu tween kalau sudah di target
    if (Math.abs(state.value - targetProgress) < 0.0005) {
      return
    }

    // Motion blur hanya untuk transisi yang berakhir di 100%
    const rushing = mb.enabled && targetProgress >= 0.999
    const span = Math.min(1, Math.abs(targetProgress - state.value) / mb.distRef)

    tweenRef.current = gsap.to(state, {
      value: targetProgress,
      duration: FROST_CONFIG.animDuration,
      ease: FROST_CONFIG.animEase,
      onUpdate: () => {
        const val = state.value
        // Pada ease "out" kecepatan tertinggi di awal, menurun ke 0 di akhir ≈ (1 - progress waktu)
        const tw = tweenRef.current
        blurRef.current = rushing && tw ? (1 - tw.progress()) * span : 0

        // Update CSS variable untuk efek frosted blur kaca
        if (containerRef.current) {
          containerRef.current.style.setProperty('--frost-progress', val.toFixed(4))
        }
        renderCanvas(val)
      },
      onComplete: () => {
        // Selesai → blur hilang, gambar kembali tajam
        blurRef.current = 0
        renderCanvas(state.value)
      },
    })

    return () => {
      if (tweenRef.current) tweenRef.current.kill()
    }
  }, [targetProgress])

  const isVisible = targetProgress > 0 || progressAnimRef.current.value > 0.001

  return (
    <div
      ref={containerRef}
      className={`frost-overlay ${isVisible ? 'frost-overlay--active' : ''}`}
      style={{ '--frost-progress': progressAnimRef.current.value }}
    >
      {/* Layer 1: Frosted glass blur halus pada background */}
      <div className="frost-overlay__blur" />

      {/* Layer 2: Glow biru es halus di pinggiran */}
      <div className="frost-overlay__glow" />

      {/* Layer 3: Canvas Utama Kertas Kusut Wireframe (Organic Crumpled Origami) */}
      <canvas
        ref={canvasRef}
        className="frost-overlay__canvas"
      />
    </div>
  )
}