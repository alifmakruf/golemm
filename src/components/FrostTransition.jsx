import { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import gsap from 'gsap'
import './style/FrostTransition.css'

// ============================================================================
// Parameter Tuning Gelombang Frost (Wave Wipe Origami Mesh)
// Sesuai target.txt:
// 1. Muncul dari pojok kiri bawah (originU: 0.0, originV: 1.0)
// 2. Berbentuk wave cerah di depan, di belakangnya menyingkap Section 3.5
// 3. Motion blur dihilangkan agar performa ultra-ringan 60-120 FPS
// ============================================================================
export const FROST_CONFIG = {
  // --- Titik Asal Gelombang (0.0, 1.0 = Pojok Kiri Bawah) ---
  originU: 0.0, // 0 = kiri layar, 1 = kanan layar
  originV: 1.0, // 1 = bawah layar, 0 = atas layar

  // Lebar pita gelombang merambat (0.15 = sempit tajam, 0.35 = lebar tebal)
  waveBandWidth: 0.2,

  // --- Kerapatan Grid Wireframe Kertas Kusut ---
  gridCols: 32,
  gridRows: 32,
  jitterAmount: 0.88,
  creaseDepth: 48,

  // --- Garis Wireframe ---
  lineWidth: 0.1,
  lineColor: 'rgba(255, 255, 255, ',          // Warna garis putih bersih
  lineBaseOpacity: 0.10,                      // Kecerahan garis di bibir depan ombak

  // --- Bayangan Faset Segitiga (Kristal Origami) ---
  facetColor: 'rgba(200, 238, 255, ',         // Nuansa kristal es cyan lembut
  facetMaxOpacity: 0.12,                      // Opacity maksimal faset

  // --- Titik Simpul Kristal (Node Dots) di Bibir Depan Ombak ---
  nodeDotSize: .2,
  nodeDotColor: 'rgba(255, 255, 255, 0.95)',

  // --- Transisi Otomatis (GSAP) untuk Arah Keluar (3.5 -> 4) & Arah Masuk ---
  animDuration: 0.75,
  animEase: 'power2.out',
  inSteps: [0.00, 1.00],
  // --- Posisi Istirahat Gelombang di Section 3.5 (Overlap di Pojok Kanan Atas) ---
  // 1.0 = tepat di sudut kanan atas layar (overlap di luar viewport)
  // Gelombang tetap berada di kanan atas saat user berada di Section 3.5,
  // dan siap menyapu kembali secara halus ke kiri bawah saat user scroll kembali ke Section 3
  restProgress: 1.0,
}

const FrostTransition = forwardRef(function FrostTransition(
  { scrollStep = 0, direction = 'in', onProgress },
  ref
) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const progressAnimRef = useRef({ value: 0 })
  const tweenRef = useRef(null)

  // Hitung target progress untuk arah keluar / idle otomatis
  let targetProgress = 0
  if (direction === 'inside') {
    targetProgress = FROST_CONFIG.restProgress
  } else if (direction === 'out') {
    const idx = Math.min(Math.max(scrollStep, 0), FROST_CONFIG.outSteps.length - 1)
    targetProgress = FROST_CONFIG.outSteps[idx]
  }

  // Generate struktur faset kertas kusut sekali saat mount
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

        const finalU = Math.max(0, Math.min(1, u + jx))
        const finalV = Math.max(0, Math.min(1, v + jy))

        // Jarak dari pojok kiri bawah (originU: 0, originV: 1), dinormalisasi ke 0..1
        const du = finalU - FROST_CONFIG.originU
        const dv = (1 - finalV) - (1 - FROST_CONFIG.originV)
        const waveDist = Math.hypot(du, dv) / Math.SQRT2

        vertices.push({
          u: finalU,
          v: finalV,
          z: jz,
          waveDist,
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

          const abx = vb.u - va.u
          const aby = vb.v - va.v
          const abz = (vb.z - va.z) * 0.01

          const adx = vd.u - va.u
          const ady = vd.v - va.v
          const adz = (vd.z - va.z) * 0.01

          let nx = aby * adz - abz * ady
          let ny = abz * adx - abx * adz
          let nz = abx * ady - aby * adx
          const nlen = Math.hypot(nx, ny, nz) || 1
          nx /= nlen
          ny /= nlen
          nz /= nlen

          const dot = Math.abs(nx * lx + ny * ly + nz * lz)
          const avgDist = (va.waveDist + vb.waveDist + vd.waveDist) / 3

          triangles.push({
            indices: [a, b, d],
            shade: dot,
            waveDist: avgDist,
          })
        })
      }
    }

    return { vertices, triangles }
  }, [])

  // Gambar mesh gelombang ke canvas secara efisien (Direct single-pass render)
  const drawMesh = (ctx, w, h, currentProg) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (currentProg <= 0.001) return

    const { vertices, triangles } = meshData
    const band = FROST_CONFIG.waveBandWidth
    // Posisi puncak gelombang merambat dari 0 hingga melampaui layar (1 + band)
    const wavePos = currentProg * (1 + band)

    // 1. Faset bayangan kristal origami
    triangles.forEach((tri) => {
      const diff = wavePos - tri.waveDist
      // Di depan bibir gelombang atau sudah di belakang pita gelombang -> abaikan
      if (diff < 0 || diff > band) return

      const norm = diff / band
      // Puncak di bibir depan ombak sangat cerah, memudar halus ke belakang
      const crestShape = Math.sin((1 - norm) * (Math.PI / 2))
      const tAlpha = Math.max(0, Math.min(1, crestShape))
      if (tAlpha <= 0.01) return

      const v0 = vertices[tri.indices[0]]
      const v1 = vertices[tri.indices[1]]
      const v2 = vertices[tri.indices[2]]

      ctx.beginPath()
      ctx.moveTo(v0.u * w, v0.v * h)
      ctx.lineTo(v1.u * w, v1.v * h)
      ctx.lineTo(v2.u * w, v2.v * h)
      ctx.closePath()

      const facetAlpha = (FROST_CONFIG.facetMaxOpacity * (0.35 + tri.shade * 0.65) * tAlpha).toFixed(3)
      ctx.fillStyle = `${FROST_CONFIG.facetColor}${facetAlpha})`
      ctx.fill()
    })

    // 2. Garis wireframe putih terang
    ctx.lineWidth = FROST_CONFIG.lineWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    triangles.forEach((tri) => {
      const diff = wavePos - tri.waveDist
      if (diff < 0 || diff > band) return

      const norm = diff / band
      const crestFactor = Math.pow(1 - norm, 0.7)
      const tAlpha = Math.max(0, Math.min(1, crestFactor))
      if (tAlpha <= 0.01) return

      const v0 = vertices[tri.indices[0]]
      const v1 = vertices[tri.indices[1]]
      const v2 = vertices[tri.indices[2]]

      ctx.beginPath()
      ctx.moveTo(v0.u * w, v0.v * h)
      ctx.lineTo(v1.u * w, v1.v * h)
      ctx.lineTo(v2.u * w, v2.v * h)
      ctx.closePath()

      const strokeAlpha = (FROST_CONFIG.lineBaseOpacity * tAlpha * (0.55 + tri.shade * 0.45)).toFixed(3)
      ctx.strokeStyle = `${FROST_CONFIG.lineColor}${strokeAlpha})`
      ctx.stroke()
    })

    // 3. Titik simpul kristal di bibir depan ombak
    if (FROST_CONFIG.nodeDotSize > 0) {
      ctx.fillStyle = FROST_CONFIG.nodeDotColor
      vertices.forEach((v) => {
        const diff = wavePos - v.waveDist
        if (diff < 0 || diff > band * 0.45) return
        const norm = diff / (band * 0.45)
        const alpha = 1 - norm
        if (alpha < 0.25) return

        ctx.beginPath()
        ctx.arc(v.u * w, v.v * h, FROST_CONFIG.nodeDotSize, 0, Math.PI * 2)
        ctx.fill()
      })
    }
  }

  // Render satu frame ke canvas
  const renderCanvas = (currentProg) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawMesh(ctx, canvas.width, canvas.height, currentProg)
  }

  // Expose setProgress imperatif untuk scroll-driven loop di App.jsx
  useImperativeHandle(ref, () => ({
    setProgress: (val) => {
      progressAnimRef.current.value = val
      renderCanvas(val)
      if (onProgress) onProgress(val)
    },
  }))

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

  // GSAP Tweening untuk arah keluar ('out') atau 'inside'
  useEffect(() => {
    if (direction === 'in') return // Arah masuk dikontrol langsung via scroll loop

    if (tweenRef.current) tweenRef.current.kill()
    const state = progressAnimRef.current

    if (Math.abs(state.value - targetProgress) < 0.0005) return

    tweenRef.current = gsap.to(state, {
      value: targetProgress,
      duration: FROST_CONFIG.animDuration,
      ease: FROST_CONFIG.animEase,
      onUpdate: () => {
        const val = state.value
        if (onProgress) onProgress(val)
        renderCanvas(val)
      },
      onComplete: () => {
        renderCanvas(state.value)
        if (onProgress) onProgress(state.value)
      },
    })

    return () => {
      if (tweenRef.current) tweenRef.current.kill()
    }
  }, [targetProgress, direction])

  return (
    <div
      ref={containerRef}
      className="frost-overlay frost-overlay--active"
    >
      <canvas
        ref={canvasRef}
        className="frost-overlay__canvas"
      />
    </div>
  )
})

export default FrostTransition