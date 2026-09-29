import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ============================================================================
// PARAMETER TUNING: AWAN VOLUMETRIK 3D BERPUTAR DI TEMPAT (360° CANOPY)
// ============================================================================
// Awan berputar perlahan mengitari puncak gunung sehingga seluruh sisi (depan,
// belakang, kiri, kanan) selalu terisi awan secara merata tanpa ada area kosong.
// ============================================================================

export const CLOUD_CONFIG = {
  // --- AKTIVASI & PERFORMA ---
  enabled: true,                         // true = tampilkan awan, false = matikan
  enableOnMobile: true,                  // Apakah awan tetap aktif di layar HP
  mobilePuffReduction: 0.6,              // Di HP, partikel dikurangi agar tetap ringan & 60 FPS

  // --- KELEMBUTAN & GAUSSIAN BLUR TEXTURE ---
  textureResolution: 512,                // Resolusi tekstur canvas (512x512 sangat halus)
  gaussianSoftness: 10.2,                // Eksponen kelembutan Gaussian blur (sesuai settingan Anda)
  puffSubLobes: 4,                       // Jumlah gumpalan mikro organik per partikel

  // --- 1 MODE VISUAL (PERMANEN KONSISTEN) ---
  color: '#282d36',                      // 1 Mode warna awan
  opacity: 0.52,                         // Opasitas awan (0.0 transparan - 1.0 tebal padat)

  // --- ANIMASI BERPUTAR DI TEMPAT (ORBIT DI ATAS GUNUNG) ---
  orbitSpeed: 0.022,                     // Kecepatan putar di tempat (makin kecil makin pelan & anggun)
  orbitDirection: 1.0,                   // 1.0 = searah jarum jam, -1.0 = berlawanan arah
  orbitCenter: [0.0, 0.0],               // [X, Z] Titik pusat putaran (tepat di atas puncak gunung [0, 0])
  bobAmplitude: 0.18,                    // Amplitudo napas naik-turun perlahan awan
  bobSpeed: 0.5,                         // Kecepatan napas awan
  puffRotationSpeed: 0.03,               // Kecepatan putar perlahan tiap puff pada porosnya

  // --- GUMPALAN AWAN 360 DERAJAT DI ATAS GUNUNG ---
  // Tersebar merata di 4 kuadran (Depan, Kiri, Belakang, Kanan) + Tengah Zenith
  // sehingga dari viewport mana pun (Section 1, 2, atau 3), awan selalu terlihat penuh.
  clusters: [
    {
      name: 'Pusat Kanopi Zenith (Tepat di Atas Puncak)',
      center: [0.0, 8.2, 0.0],           // [X, Y, Z] Tepat di atas gunung
      spread: [12.0, 3.5, 12.0],         // [tebal X, tinggi Y, lebar Z]
      puffs: 34,
      puffSizeMin: 3.8,
      puffSizeMax: 6.2,
    },
    {
      name: 'Sisi Kiri (Arah Section 2)',
      center: [-1.0, 8.0, 16.0],
      spread: [12.0, 3.8, 16.0],
      puffs: 28,
      puffSizeMin: 3.6,
      puffSizeMax: 5.8,
    },
    {
      name: 'Sisi Kanan (Arah Section 3)',
      center: [-1.0, 8.0, -16.0],
      spread: [12.0, 3.8, 16.0],
      puffs: 28,
      puffSizeMin: 3.6,
      puffSizeMax: 5.8,
    },
    {
      name: 'Sisi Belakang (Latar Belakang Punggung Gunung)',
      center: [-14.0, 7.5, 0.0],
      spread: [10.0, 3.2, 26.0],
      puffs: 28,
      puffSizeMin: 4.0,
      puffSizeMax: 6.5,
    },
    {
      name: 'Sisi Depan (Di Atas Kepala Kamera)',
      center: [7.0, 8.6, 0.0],
      spread: [10.0, 3.5, 24.0],
      puffs: 24,
      puffSizeMin: 3.8,
      puffSizeMax: 6.0,
    },
    {
      name: 'Kubah Langit Atas Tinggi (Zenith Tinggi)',
      center: [0.0, 12.0, 0.0],
      spread: [22.0, 2.8, 22.0],
      puffs: 26,
      puffSizeMin: 4.5,
      puffSizeMax: 7.2,
    },
  ],
}

// ----------------------------------------------------------------------------
// Generator Tekstur Gaussian Blur Procedural (Ringan, Tanpa Request Jaringan)
// ----------------------------------------------------------------------------
function generateGaussianPuffTexture(resolution = 512, softness = 10.2, subLobes = 4) {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution
  const ctx = canvas.getContext('2d')

  const center = resolution / 2
  const mainRadius = resolution * 0.44

  ctx.clearRect(0, 0, resolution, resolution)

  const lobes = [
    { x: center, y: center, r: mainRadius, weight: 1.0 },
  ]

  const seedAngles = [0.4, 1.8, 3.5, 5.0]
  for (let i = 0; i < subLobes; i++) {
    const angle = seedAngles[i % seedAngles.length] + (i * 0.2)
    const dist = mainRadius * (0.28 + (i % 2) * 0.12)
    const subR = mainRadius * (0.55 + (i % 2) * 0.15)
    lobes.push({
      x: center + Math.cos(angle) * dist,
      y: center + Math.sin(angle) * dist,
      r: subR,
      weight: 0.65,
    })
  }

  lobes.forEach((lobe) => {
    const grad = ctx.createRadialGradient(lobe.x, lobe.y, 0, lobe.x, lobe.y, lobe.r)
    const steps = 14
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(1, Math.max(0, s / steps))
      const alpha = Math.exp(-softness * (t * t)) * lobe.weight
      const easedAlpha = Math.max(0, Math.min(1, alpha))
      grad.addColorStop(t, `rgba(255, 255, 255, ${easedAlpha.toFixed(4)})`)
    }
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2)
    ctx.fill()
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  return texture
}

export default function VolumetricClouds() {
  const meshRef = useRef()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960

  // 1. Tekstur gaussian blur di-cache satu kali
  const cloudTexture = useMemo(() => {
    return generateGaussianPuffTexture(
      CLOUD_CONFIG.textureResolution,
      CLOUD_CONFIG.gaussianSoftness,
      CLOUD_CONFIG.puffSubLobes
    )
  }, [])

  // 2. Kalkulasi sebaran 3D partikel puff melingkari 360 derajat atas gunung
  const { puffsData, totalPuffs } = useMemo(() => {
    const list = []
    const reduction = isMobile ? CLOUD_CONFIG.mobilePuffReduction : 1.0

    CLOUD_CONFIG.clusters.forEach((cluster, clusterIdx) => {
      const count = Math.max(4, Math.round(cluster.puffs * reduction))
      const [cx, cy, cz] = cluster.center
      const [sx, sy, sz] = cluster.spread

      for (let i = 0; i < count; i++) {
        const u = Math.random()
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const rad = Math.cbrt(u)

        const lx = rad * Math.sin(phi) * Math.cos(theta) * (sx * 0.5)
        const ly = rad * Math.sin(phi) * Math.sin(theta) * (sy * 0.5)
        const lz = rad * Math.cos(phi) * (sz * 0.5)

        const distFromCenter = Math.sqrt((lx / sx) ** 2 + (ly / sy) ** 2 + (lz / sz) ** 2)
        const sizeWeight = THREE.MathUtils.lerp(1.2, 0.7, Math.min(1, distFromCenter * 2))
        const baseSize = THREE.MathUtils.lerp(cluster.puffSizeMin, cluster.puffSizeMax, Math.random()) * sizeWeight

        list.push({
          clusterIdx,
          basePos: [cx + lx, cy + ly, cz + lz],
          size: baseSize,
          aspect: 0.9 + Math.random() * 0.2,
          rotZ: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * CLOUD_CONFIG.puffRotationSpeed,
          bobPhase: Math.random() * Math.PI * 2,
          speedMult: 0.9 + Math.random() * 0.2, // variasi halus kecepatan orbit per puff
        })
      }
    })

    return { puffsData: list, totalPuffs: list.length }
  }, [isMobile])

  // Objek pembantu instancing (zero allocation di render loop)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempEuler = useMemo(() => new THREE.Euler(), [])
  const tempQuat = useMemo(() => new THREE.Quaternion(), [])
  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  // Material statis 1 mode warna
  const cloudMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: CLOUD_CONFIG.opacity,
      color: new THREE.Color(CLOUD_CONFIG.color),
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    })
  }, [cloudTexture])

  // 3. Render loop: rotasi berputar di tempat (orbiting 360°) + billboarding menghadap kamera
  useFrame((state) => {
    if (!meshRef.current || !CLOUD_CONFIG.enabled) return

    const time = state.clock.elapsedTime
    const cameraQuat = state.camera.quaternion
    const [rcX, rcZ] = CLOUD_CONFIG.orbitCenter

    // Sudut rotasi orbital global
    const baseAngle = time * CLOUD_CONFIG.orbitSpeed * CLOUD_CONFIG.orbitDirection
    const cosBase = Math.cos(baseAngle)
    const sinBase = Math.sin(baseAngle)

    for (let i = 0; i < totalPuffs; i++) {
      const puff = puffsData[i]
      const [bx, by, bz] = puff.basePos

      // Koordinat relatif terhadap pusat pusaran di atas gunung
      const relX = bx - rcX
      const relZ = bz - rcZ

      // Putar di tempat mengelilingi pusat gunung (X dan Z)
      const dynamicX = rcX + (relX * cosBase - relZ * sinBase)
      const dynamicZ = rcZ + (relX * sinBase + relZ * cosBase)

      // Floating bernapas naik-turun perlahan di sumbu Y
      const dynamicY = by + Math.sin(time * CLOUD_CONFIG.bobSpeed + puff.bobPhase) * CLOUD_CONFIG.bobAmplitude

      dummy.position.set(dynamicX, dynamicY, dynamicZ)
      dummy.quaternion.copy(cameraQuat)

      // Putar perlahan tiap puff pada porosnya
      const currentRotZ = puff.rotZ + time * puff.rotSpeed
      tempEuler.set(0, 0, currentRotZ)
      tempQuat.setFromEuler(tempEuler)
      dummy.quaternion.multiply(tempQuat)

      dummy.scale.set(puff.size, puff.size * puff.aspect, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  if (!CLOUD_CONFIG.enabled) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[planeGeo, cloudMaterial, totalPuffs]}
      frustumCulled={false}
    />
  )
}
