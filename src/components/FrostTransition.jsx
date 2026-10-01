import { useRef, useEffect, useState, useMemo } from 'react'
import gsap from 'gsap'
import './style/FrostTransition.css'

// ================== Parameter Tuning: Crumpled Paper Wireframe Frost ==================
// Efek transisi wireframe kertas kusut (crumpled paper origami mesh).
// Dikontrol oleh scrollStep (0-3) dan dianimasikan secara ultra-smooth via GSAP.

export const FROST_CONFIG = {
  // --- Kehalusan Animasi GSAP ---
  animDuration: 0.85,            // Durasi transisi per step scroll (detik)
  animEase: 'power2.out',        // Kurva easing GSAP (smooth & natural)

  // --- Step Persentase Transisi ---
  // Arah masuk (Section 3 → 3.5):
  // Step 1 = 20% (kertas kusut mulai merambat halus dari tepi layar)
  // Step 2 = 40% (lipatan kusut merambat lebih dalam ke tengah)
  // Step 3 = 100% (seluruh layar terselimuti wireframe kertas kusut halus)
  inSteps: [0, 0.10, 0.30, 1.00],

  // Kondisi saat di dalam Section 3.5:
  // 0.00 = wireframe hilang total sehingga konten Section 3.5 terlihat jelas
  restProgress: -0.30,

  // Arah keluar (Section 3.5 → 4):
  outSteps: [0.00, 0.30, 0.65, 1.00],

  // --- Parameter Visual Wireframe Kertas Kusut ---
  gridCols: 30,                  // Jumlah kolom grid lipatan (makin banyak = lipatan makin detail)
  gridRows: 20,                  // Jumlah baris grid lipatan
  jitterAmount: 0.72,            // Tingkat kekusutan posisi lipatan kertas (0-1)
  creaseDepth: 90,               // Kedalaman 3D lipatan kertas (mempengaruhi bayangan faset)

  lineWidth: 0.2,                // Ketebalan garis wireframe (px) — sangat halus
  lineColor: 'rgba(103, 232, 249, ', // Warna dasar garis wireframe cyan es (RGB)
  lineBaseOpacity: 0.25,         // Opasitas maksimal garis wireframe

  facetColor: 'rgba(186, 230, 253, ', // Warna bayangan faset kertas (RGB)
  facetMaxOpacity: 0.10,         // Opasitas bayangan faset kertas (sangat halus semi-transparan)

  nodeDotSize: 1,              // Ukuran titik kristal di setiap simpul lipatan (px)
  nodeDotColor: 'rgba(255, 255, 255, 0.85)', // Warna titik simpul es

  edgeGlowColor: 'rgba(255, 255, 255, 0.55)', // Warna glow di batas depan rambatan kertas
}

/**
 * FrostTransition — Wireframe objek kertas kusut ultra-smooth berbasis HTML5 Canvas + GSAP.
 */
export default function FrostTransition({ scrollStep = 0, direction = 'in' }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const progressAnimRef = useRef({ value: 0 })
  const tweenRef = useRef(null)

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

  // Generate struktur faset kertas kusut sekali (resolusi independen)
  const meshData = useMemo(() => {
    const cols = FROST_CONFIG.gridCols
    const rows = FROST_CONFIG.gridRows
    const vertices = []

    // 1. Generate jittered vertices (simpul lipatan kertas)
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const u = c / cols
        const v = r / rows

        // Kunci simpul di pinggiran layar agar menempel rapi di tepi
        const isBorder = c === 0 || c === cols || r === 0 || r === rows
        const jitter = isBorder ? 0 : FROST_CONFIG.jitterAmount

        const jx = (Math.random() - 0.5) * (1 / cols) * jitter
        const jy = (Math.random() - 0.5) * (1 / rows) * jitter
        const jz = (Math.random() - 0.5) * FROST_CONFIG.creaseDepth

        vertices.push({
          u: Math.max(0, Math.min(1, u + jx)),
          v: Math.max(0, Math.min(1, v + jy)),
          z: jz,
          // Jarak normalisasi dari pusat layar (0 = pusat, ~1 = sudut)
          centerDist: Math.hypot((u - 0.5) * 2, (v - 0.5) * 2),
        })
      }
    }

    // 2. Generate segitiga faset kertas (triangulasi lipatan)
    const triangles = []
    const lightDir = { x: -0.4, y: -0.6, z: 0.7 } // Arah datang cahaya untuk shading lipatan
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

        // Pola diagonal bergantian agar lipatan kusut tampak asimetris alami
        const flip = (r + c) % 2 === 0
        const triPairs = flip
          ? [[i0, i1, i3], [i0, i3, i2]]
          : [[i0, i1, i2], [i1, i3, i2]]

        triPairs.forEach(([a, b, d]) => {
          const va = vertices[a]
          const vb = vertices[b]
          const vd = vertices[d]

          // Hitung normal vektor bidang segitiga faset
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

          // Intensitas bayangan lipatan berdasarkan dot product
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

  // Fungsi Render Canvas
  const renderCanvas = (currentProg) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (currentProg <= 0.001) return

    // Batas radius rambatan: saat prog 0 = radius 1.4 (di luar layar), saat prog 1 = radius 0
    // Rambatan merambat dari tepi (centerDist besar) ke tengah (centerDist kecil)
    const revealThreshold = (1 - currentProg) * 1.35
    const feather = 0.35 // Kelembutan transisi gradasi di ujung tepi kertas

    const { vertices, triangles } = meshData

    // 1. Gambar faset bayangan kertas kusut
    triangles.forEach((tri) => {
      // Hitung opasitas faset berdasarkan posisi terhadap gelombang rambatan
      const diff = tri.centerDist - revealThreshold
      if (diff < -feather) return // Belum tersentuh rambatan es

      const tAlpha = Math.min(1, Math.max(0, (diff + feather) / feather))
      if (tAlpha <= 0) return

      const v0 = vertices[tri.indices[0]]
      const v1 = vertices[tri.indices[1]]
      const v2 = vertices[tri.indices[2]]

      const x0 = v0.u * w, y0 = v0.v * h
      const x1 = v1.u * w, y1 = v1.v * h
      const x2 = v2.u * w, y2 = v2.v * h

      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.closePath()

      // Warna faset dengan variasi intensitas pencahayaan lipatan
      const facetAlpha = (FROST_CONFIG.facetMaxOpacity * (0.4 + tri.shade * 0.6) * tAlpha).toFixed(3)
      ctx.fillStyle = `${FROST_CONFIG.facetColor}${facetAlpha})`
      ctx.fill()
    })

    // 2. Gambar garis wireframe lipatan kertas kusut (delicate wireframe edges)
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

      const x0 = v0.u * w, y0 = v0.v * h
      const x1 = v1.u * w, y1 = v1.v * h
      const x2 = v2.u * w, y2 = v2.v * h

      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.closePath()

      const strokeAlpha = (FROST_CONFIG.lineBaseOpacity * tAlpha * (0.6 + tri.shade * 0.4)).toFixed(3)
      ctx.strokeStyle = `${FROST_CONFIG.lineColor}${strokeAlpha})`
      ctx.stroke()
    })

    // 3. Gambar titik-titik simpul kristal berkilau
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

    tweenRef.current = gsap.to(progressAnimRef.current, {
      value: targetProgress,
      duration: FROST_CONFIG.animDuration,
      ease: FROST_CONFIG.animEase,
      onUpdate: () => {
        const val = progressAnimRef.current.value
        // Update CSS variable untuk efek frosted blur kaca
        if (containerRef.current) {
          containerRef.current.style.setProperty('--frost-progress', val.toFixed(4))
        }
        renderCanvas(val)
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
