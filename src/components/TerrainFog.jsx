import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ============================================================================
// TerrainFog — kabut asap tipis & halus yang MENYATU dengan terrain (menyelimuti
// lembah dan melintasi punggung gunung), lalu mengalir pelan.
//
// Cara kerja:
//  1. HEIGHTMAP: saat model terrain dimuat, permukaannya dirasterisasi ke sebuah
//     tekstur tinggi (heightmap 256x256) langsung dari mesh GLB. Sedikit
//     di-dilate (max-filter) supaya lembar kabut selalu berada DI ATAS
//     permukaan, bukan menembusnya.
//  2. LAPISAN KABUT: beberapa lembar tipis (grid padat) ditumpuk. Tiap vertex
//     lembar diangkat di vertex shader ke:  y = max(tinggiTanah + lift, level)
//       - level  : ketinggian "genangan" kabut yang datar -> mengisi lembah
//       - lift   : jarak kecil di atas tanah -> kabut mengikuti (drape) lereng
//                  & melintasi punggung gunung
//     Jadi kabut menempel dan mengikuti kontur terrain, tidak melayang jauh.
//  3. SHADER: noise 3D (fbm) + domain-warp, berputar & hanyut pelan -> asap
//     mengalir. Kabut memudar di puncak tertinggi dan di tepi footprint.
//     Depth test aktif: kalau lembar bertabrakan dengan mesh, sisi yang
//     tertutup mesh tersembunyi (tidak pernah terlihat "menembus" gunung).
//
// Dipasang DI DALAM <group> terrain (TerrainLoader.jsx), jadi ikut animasi naik.
// ============================================================================

export const FOG_CONFIG = {
  // --- AKTIVASI & PERFORMA ---
  enabled: true,
  layers: 4,                   // Jumlah lapisan kabut (tiap lapisan = 1 layar penuh shader; 3-4 sudah cukup untuk kabut tipis)
  mobileLayers: 3,
  referenceLayers: 6,          // Kepadatan disetarakan dengan 6 lapisan (jumlah lapisan dikurangi -> tiap lapisan otomatis sedikit lebih pekat, tampilan tetap sama)
  gridSegments: 90,            // Kerapatan grid tiap lembar (lebih besar = lebih presisi mengikuti kontur, lebih berat)
  mobileGridSegments: 56,
  heightmapSize: 160,          // Resolusi heightmap (dihitung sekali saat load)
  safetyRadius: 0.2,           // Radius pengaman (world unit): lembar kabut dinaikkan agar tidak menembus tepi kontur

  // --- UKURAN (otomatis dari mesh terrain). Isi kalau ingin paksa manual:
  // boundsOverride: { center:[x,z], half:[hx,hz], minY, height }
  boundsOverride: null,

  // --- KETINGGIAN KABUT ---
  // fogDepthFraction: tebal genangan kabut di lembah = fraksi x tinggi terrain (0.3 = 30%)
  fogDepthFraction: 0.05,
  baseLevel: 0.02,             // Lapisan terbawah: level datar dari dasar terrain (fraksi tinggi)
  liftMin: 0.07,               // Jarak lembar terbawah di atas permukaan (world unit). JANGAN < 0.05 agar tidak menembus
  liftMax: 0.3,               // Jarak lembar teratas di atas permukaan (mengikuti kontur)
  contourWobble: 0.03,         // Gelombang naik-turun halus lembar (world unit)

  // --- SEBARAN ---
  edgeFade: 1,              // Lebar pudar di tepi footprint (fraksi lebar terrain)
  heightFadeStart: 0.45,       // Mulai menipis di ketinggian ini (fraksi tinggi terrain)
  heightFadeEnd: 0.92,         // Habis di ketinggian ini -> puncak gunung tetap bersih
  valleyThickness: 0.9,        // Seberapa jauh dari tanah kabut mencapai kepadatan penuh (world unit)
  thinOnSlope: 0.45,           // Kepadatan relatif di lereng (kabut menempel) vs di lembah (1.0)

  // --- TAMPILAN NOISE ---
  noiseFrequency: 2.2,         // Jumlah gumpalan sepanjang setengah lebar terrain. Kecil = gumpalan lebih besar
  warpStrength: 0.9,
  verticalNoiseStretch: 1.6,   // Skala noise ke arah tinggi (besar = lapisan vertikal lebih bervariasi)
  coverLow: 0.6,              // Naikkan -> lebih banyak celah / lebih tipis
  coverHigh: 0.92,

  // --- ALIRAN ---
  swirlSpeed: .3,            // rad/detik, pola berputar mengelilingi pusat terrain (negatif = arah sebaliknya)
  driftSpeed: 0.1,
  morphSpeed: 0.1,
  driftAngle: 0.1,

  // --- WARNA & OPASITAS PER SECTION ---
  sections: {
    1: { opacity: 0.2, colorLow: '#00ccff', colorHigh: '#d5b62c' },
    2: { opacity: 0.2, colorLow: '#00aeff', colorHigh: '#3fb0d2' },
    3: { opacity: 0.28, colorLow: '#00a2ff', colorHigh: '#2f7c93' }, // malam: lebih biru & gelap
  },
  hiddenOpacity: 0,            // Section >= 4 (mode 2D): kabut disembunyikan
  transitionSpeed: 2.2,
  nearCameraFade: [0.6, 3.0],  // [mulai pudar, penuh] jarak ke kamera
}

// ----------------------------------------------------------------------------
// Shader
// ----------------------------------------------------------------------------
const VERT = /* glsl */ `
  uniform sampler2D uHeight;
  uniform vec4  uMap;        // minX, minZ, 1/sizeX, 1/sizeZ
  uniform vec2  uH;          // hMin, hRange
  uniform float uLevel;      // level datar genangan kabut (lapisan ini)
  uniform float uLift;       // jarak di atas permukaan (lapisan ini)
  uniform float uWobble;
  uniform float uTime;
  uniform float uSeed;

  varying vec2  vXZ;
  varying vec2  vUv;
  varying float vH;
  varying float vY;
  varying vec3  vWorld;

  void main() {
    vec2 uv = (position.xz - uMap.xy) * uMap.zw;
    float h = uH.x + texture2D(uHeight, uv).r * uH.y;

    float y = max(h + uLift, uLevel);
    y += sin(position.x * 0.9 + uTime * 0.35 + uSeed) * cos(position.z * 0.8 - uTime * 0.28 + uSeed * 1.7) * uWobble;

    vXZ = position.xz;
    vUv = uv;
    vH = h;
    vY = y;

    vec4 wp = modelMatrix * vec4(position.x, y, position.z, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  varying vec2  vXZ;
  varying vec2  vUv;
  varying float vH;
  varying float vY;
  varying vec3  vWorld;

  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uColorLow;
  uniform vec3  uColorHigh;
  uniform vec2  uNearFade;
  uniform vec2  uH;
  uniform vec2  uCenter;

  uniform float uLayerT;
  uniform float uLayerOpacity;
  uniform float uSeed;
  uniform float uScale;
  uniform float uSwirl;
  uniform vec2  uDrift;
  uniform float uMorph;
  uniform float uYSquash;
  uniform float uWarp;
  uniform vec2  uCover;

  uniform float uEdge;
  uniform vec2  uHeightFade;
  uniform float uValley;
  uniform float uThinSlope;

  uniform sampler2D uNoise;   // tekstur noise acak 256x256 (R, dan G = R yang digeser (37,17))

  // Value-noise 3D dengan SATU pembacaan tekstur (teknik iq) -> jauh lebih murah dari hash 8x
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    vec2 uv = i.xy + vec2(37.0, 17.0) * i.z + f.xy;
    vec2 rg = texture2D(uNoise, (uv + 0.5) / 256.0).rg;
    return mix(rg.x, rg.y, f.z);
  }

  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 3; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec3(17.1, 3.7, 9.2);
      a *= 0.5;
    }
    return s / 0.875;
  }

  void main() {
    // --- Masker sebaran (murah, dihitung dulu) ---
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edgeMask = smoothstep(0.0, uEdge, edge);

    float hn = (vH - uH.x) / uH.y;                       // 0..1 tinggi tanah
    float heightMask = 1.0 - smoothstep(uHeightFade.x, uHeightFade.y, hn);

    float above = vY - vH;                               // tebal kabut di atas tanah
    float depthMask = mix(uThinSlope, 1.0, smoothstep(0.0, uValley, above));

    float prof = edgeMask * heightMask * depthMask;
    if (prof < 0.004) discard;

    // --- Aliran: berputar mengelilingi pusat terrain ---
    vec2 w = vXZ - uCenter;
    float ang = uTime * uSwirl;
    float cs = cos(ang);
    float sn = sin(ang);
    vec2 p = vec2(cs * w.x - sn * w.y, sn * w.x + cs * w.y);

    // Noise 3D memakai tinggi (vY) juga -> pola tidak "merenggang" di lereng curam
    vec3 q = vec3(p.x, vY * uYSquash, p.y) * uScale
           + vec3(uDrift.x * uTime, uTime * uMorph, uDrift.y * uTime)
           + vec3(uSeed * 1.7, uSeed, uSeed * 2.3);

    vec2 wv = vec2(vnoise(q * 0.7 + vec3(5.2, 1.3, 0.0)),
                   vnoise(q * 0.7 + vec3(1.7, 9.2, 3.3))) - 0.5;
    q.xz += wv * uWarp;

    float n = fbm(q);
    float dens = smoothstep(uCover.x, uCover.y, n);

    float a = dens * prof * uLayerOpacity * uOpacity;
    a *= smoothstep(uNearFade.x, uNearFade.y, distance(cameraPosition, vWorld));
    if (a < 0.003) discard;

    vec3 col = mix(uColorLow, uColorHigh, uLayerT);
    gl_FragColor = vec4(col, a);
  }
`

const noRaycast = () => { }

// Tekstur noise acak 256x256 (deterministik). G = R yang digeser (37,17) untuk noise 3D 1-fetch.
let _noiseTex = null
function getNoiseTexture() {
  if (_noiseTex) return _noiseTex
  const N = 256
  const base = new Uint8Array(N * N)
  let seed = 1337
  for (let i = 0; i < base.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    base[i] = seed >>> 24
  }
  const data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = (y * N + x) * 4
      data[k] = base[y * N + x]
      data[k + 1] = base[((y + 17) & 255) * N + ((x + 37) & 255)]
      data[k + 2] = 0
      data[k + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  _noiseTex = tex
  return tex
}

// ----------------------------------------------------------------------------
// Ukur terrain + buat heightmap dari mesh GLB (ruang lokal group terrain)
// ----------------------------------------------------------------------------
function isSolidTerrainMesh(o) {
  if (!o.isMesh || !o.geometry || o.userData.isWaveOverlay) return false
  const m = Array.isArray(o.material) ? o.material[0] : o.material
  // Lewati objek daun/alpha-cutout & transparan (bukan permukaan tanah)
  if (m && (m.transparent || m.alphaTest > 0)) return false
  return true
}

function buildTerrainData(scene) {
  const cfg = FOG_CONFIG
  scene.updateWorldMatrix(true, true)
  const parentInv = new THREE.Matrix4()
  if (scene.parent) {
    scene.parent.updateWorldMatrix(true, false)
    parentInv.copy(scene.parent.matrixWorld).invert()
  }

  const meshes = []
  scene.traverse((o) => { if (isSolidTerrainMesh(o)) meshes.push(o) })

  // 1) bounds
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  const mats = meshes.map((m) => new THREE.Matrix4().multiplyMatrices(parentInv, m.matrixWorld))
  meshes.forEach((m, mi) => {
    const pos = m.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mats[mi])
      box.expandByPoint(v)
    }
  })

  let cx, cz, hx, hz, minY, height
  if (cfg.boundsOverride) {
    const b = cfg.boundsOverride
      ;[cx, cz] = b.center;[hx, hz] = b.half; minY = b.minY; height = b.height
  } else if (box.isEmpty()) {
    cx = 0; cz = 0; hx = 6; hz = 6; minY = 0; height = 4
  } else {
    cx = (box.min.x + box.max.x) / 2
    cz = (box.min.z + box.max.z) / 2
    hx = (box.max.x - box.min.x) / 2
    hz = (box.max.z - box.min.z) / 2
    minY = box.min.y
    height = Math.max(box.max.y - box.min.y, 0.5)
  }

  // 2) heightmap (rasterisasi segitiga -> tinggi maksimum per sel)
  const G = cfg.heightmapSize
  const minX = cx - hx
  const minZ = cz - hz
  const sizeX = hx * 2
  const sizeZ = hz * 2
  const dx = sizeX / G
  const dz = sizeZ / G
  const grid = new Float32Array(G * G).fill(-Infinity)

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  meshes.forEach((m, mi) => {
    const geo = m.geometry
    const pos = geo.attributes.position
    const idx = geo.index
    const triCount = (idx ? idx.count : pos.count) / 3

    // transform semua vertex SEKALI (bukan 3x per segitiga)
    const wp = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mats[mi])
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z
    }
    const idxArr = idx ? idx.array : null

    for (let t = 0; t < triCount; t++) {
      const i0 = idxArr ? idxArr[t * 3] : t * 3
      const i1 = idxArr ? idxArr[t * 3 + 1] : t * 3 + 1
      const i2 = idxArr ? idxArr[t * 3 + 2] : t * 3 + 2
      a.set(wp[i0 * 3], wp[i0 * 3 + 1], wp[i0 * 3 + 2])
      b.set(wp[i1 * 3], wp[i1 * 3 + 1], wp[i1 * 3 + 2])
      c.set(wp[i2 * 3], wp[i2 * 3 + 1], wp[i2 * 3 + 2])

      const x0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - minX) / dx))
      const x1 = Math.min(G - 1, Math.floor((Math.max(a.x, b.x, c.x) - minX) / dx))
      const z0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - minZ) / dz))
      const z1 = Math.min(G - 1, Math.floor((Math.max(a.z, b.z, c.z) - minZ) / dz))
      const den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
      if (Math.abs(den) < 1e-12) {
        // segitiga tegak lurus (sisi vertikal): tandai sel di sekitar titiknya
        for (const p of [a, b, c]) {
          const gx = Math.floor((p.x - minX) / dx), gz = Math.floor((p.z - minZ) / dz)
          if (gx >= 0 && gx < G && gz >= 0 && gz < G) grid[gz * G + gx] = Math.max(grid[gz * G + gx], p.y)
        }
        continue
      }
      for (let gz = z0; gz <= z1; gz++) {
        const pz = minZ + (gz + 0.5) * dz
        for (let gx = x0; gx <= x1; gx++) {
          const px = minX + (gx + 0.5) * dx
          const l1 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / den
          const l2 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / den
          const l3 = 1 - l1 - l2
          if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue
          const y = l1 * a.y + l2 * b.y + l3 * c.y
          const k = gz * G + gx
          if (y > grid[k]) grid[k] = y
        }
      }
    }
  })

  // sel kosong -> tinggi minimum
  for (let i = 0; i < grid.length; i++) if (grid[i] === -Infinity) grid[i] = minY

  // 3) dilate (max-filter) supaya lembar kabut selalu di ATAS permukaan
  const dilate = (src, r) => {
    const tmp = new Float32Array(src.length)
    const out = new Float32Array(src.length)
    for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
      let m = -Infinity
      for (let k = -r; k <= r; k++) { const xx = Math.min(G - 1, Math.max(0, x + k)); m = Math.max(m, src[z * G + xx]) }
      tmp[z * G + x] = m
    }
    for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
      let m = -Infinity
      for (let k = -r; k <= r; k++) { const zz = Math.min(G - 1, Math.max(0, z + k)); m = Math.max(m, tmp[zz * G + x]) }
      out[z * G + x] = m
    }
    return out
  }
  const smoothBox = (src) => {
    const out = new Float32Array(src.length)
    for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
      let s = 0, n = 0
      for (let dz2 = -1; dz2 <= 1; dz2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
        const xx = Math.min(G - 1, Math.max(0, x + dx2)), zz = Math.min(G - 1, Math.max(0, z + dz2))
        s += src[zz * G + xx]; n++
      }
      out[z * G + x] = s / n
    }
    return out
  }
  // dilate dulu (3 sel) lalu haluskan: hasil halus tetap >= permukaan di sekitar kontur
  const dilateCells = Math.min(4, Math.max(1, Math.ceil(cfg.safetyRadius / Math.max(dx, dz))))
  let hm = dilate(grid, dilateCells)
  hm = smoothBox(hm)

  // 4) ke tekstur 8-bit (R) — dibulatkan KE ATAS agar tidak lebih rendah dari tanah
  const range = Math.max(height, 1e-3)
  const bytes = new Uint8Array(G * G)
  for (let i = 0; i < hm.length; i++) {
    bytes[i] = Math.min(255, Math.max(0, Math.ceil(((hm[i] - minY) / range) * 255)))
  }
  const tex = new THREE.DataTexture(bytes, G, G, THREE.RedFormat, THREE.UnsignedByteType)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true

  return { cx, cz, hx, hz, minY, height, heightTex: tex }
}

export default function TerrainFog({ scene, activeSection = 1 }) {
  const cfg = FOG_CONFIG
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 960
  const layerCount = isMobile ? cfg.mobileLayers : cfg.layers
  const segs = isMobile ? cfg.mobileGridSegments : cfg.gridSegments

  const info = useMemo(() => {
    const t0 = performance.now()
    const d = buildTerrainData(scene)
    if (import.meta.env?.DEV) {
      console.info('[TerrainFog] terrain:', {
        center: [d.cx, d.cz], half: [d.hx, d.hz], minY: d.minY, height: d.height,
      }, `heightmap dibuat dalam ${(performance.now() - t0).toFixed(0)} ms`)
    }
    return d
  }, [scene])

  const shared = useMemo(() => ({
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uColorLow: { value: new THREE.Color(cfg.sections[1].colorLow) },
    uColorHigh: { value: new THREE.Color(cfg.sections[1].colorHigh) },
    uNearFade: { value: new THREE.Vector2(...cfg.nearCameraFade) },
    uHeight: { value: info.heightTex },
    uNoise: { value: getNoiseTexture() },
    uMap: { value: new THREE.Vector4(info.cx - info.hx, info.cz - info.hz, 1 / (info.hx * 2), 1 / (info.hz * 2)) },
    uH: { value: new THREE.Vector2(info.minY, info.height) },
    uCenter: { value: new THREE.Vector2(info.cx, info.cz) },
    uWobble: { value: cfg.contourWobble },
    uEdge: { value: cfg.edgeFade },
    uHeightFade: { value: new THREE.Vector2(cfg.heightFadeStart, cfg.heightFadeEnd) },
    uValley: { value: cfg.valleyThickness },
    uThinSlope: { value: cfg.thinOnSlope },
    uWarp: { value: cfg.warpStrength },
    uYSquash: { value: cfg.verticalNoiseStretch },
    uCover: { value: new THREE.Vector2(cfg.coverLow, cfg.coverHigh) },
  }), [info]) // eslint-disable-line react-hooks/exhaustive-deps

  // Satu grid padat (XZ absolut, ruang lokal group terrain) dipakai semua lapisan
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(info.hx * 2, info.hz * 2, segs, segs)
    g.rotateX(-Math.PI / 2)
    g.translate(info.cx, 0, info.cz)
    return g
  }, [info, segs])

  const layers = useMemo(() => {
    const meanHalf = (info.hx + info.hz) / 2
    const fogH = info.height * cfg.fogDepthFraction
    const list = []
    for (let i = 0; i < layerCount; i++) {
      const t = layerCount === 1 ? 0 : i / (layerCount - 1)
      const v1 = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
      const v2 = Math.abs((Math.sin(i * 78.233) * 12345.6789) % 1)
      const driftAng = cfg.driftAngle + (v1 - 0.5) * 1.2
      const speedMul = 0.7 + v2 * 0.6

      const uniforms = {
        ...shared,
        uLevel: { value: info.minY + info.height * cfg.baseLevel + t * fogH },
        uLift: { value: THREE.MathUtils.lerp(cfg.liftMin, cfg.liftMax, t) },
        uLayerT: { value: t },
        uLayerOpacity: { value: (1.0 - 0.55 * t) * (cfg.referenceLayers / layerCount) },
        uSeed: { value: i * 13.7 + 3.1 },
        uScale: { value: (cfg.noiseFrequency * (0.85 + 0.3 * v1)) / meanHalf },
        uSwirl: { value: cfg.swirlSpeed * speedMul },
        uDrift: { value: new THREE.Vector2(Math.cos(driftAng), Math.sin(driftAng)).multiplyScalar(cfg.driftSpeed * speedMul) },
        uMorph: { value: cfg.morphSpeed * (0.8 + 0.4 * v2) },
      }
      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,        // mesh terrain menutupi kabut yang ada di baliknya -> tidak terlihat menembus
        side: THREE.DoubleSide,
        toneMapped: false,
      })
      list.push({ key: i, material })
    }
    return list
  }, [info, layerCount, shared]) // eslint-disable-line react-hooks/exhaustive-deps

  const groupRef = useRef()
  const targetColLow = useMemo(() => new THREE.Color(), [])
  const targetColHigh = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return

    shared.uTime.value = state.clock.elapsedTime

    const sec = activeSection >= 4 ? null : (cfg.sections[activeSection] || cfg.sections[1])
    const targetOpacity = sec ? sec.opacity : cfg.hiddenOpacity
    const k = 1 - Math.exp(-cfg.transitionSpeed * delta)

    shared.uOpacity.value = THREE.MathUtils.lerp(shared.uOpacity.value, targetOpacity, k)
    if (sec) {
      targetColLow.set(sec.colorLow)
      targetColHigh.set(sec.colorHigh)
      shared.uColorLow.value.lerp(targetColLow, k)
      shared.uColorHigh.value.lerp(targetColHigh, k)
    }

    g.visible = shared.uOpacity.value > 0.004
  })

  if (!cfg.enabled) return null

  return (
    <group ref={groupRef} userData={{ isWaveOverlay: true }}>
      {layers.map((l, i) => (
        <mesh
          key={l.key}
          geometry={geometry}
          material={l.material}
          renderOrder={i}
          frustumCulled={false}
          raycast={noRaycast}                 // tidak ikut kena klik gelombang terrain
          userData={{ isWaveOverlay: true }}  // tidak dibuatkan overlay wireframe oleh TerrainWaves
        />
      ))}
    </group>
  )
}
