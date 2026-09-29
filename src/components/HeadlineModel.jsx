import { Suspense, useRef, useLayoutEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// ============================================================================
// Komponen ini menggantikan headline teks "GOLEM" (dulu <h1 className=
// "app-headline-text">) dengan model 3D (textgolem.glb). Dirender PERSIS di
// tempat yang sama di App.jsx — di dalam .app-headline-layer — sehingga
// seluruh animasi entrance/exit GSAP, parallax, dan z-index TETAP JALAN APA
// ADANYA, karena GSAP & RAF parallax menganimasikan elemen WRAPPER
// (.app-headline-layer), bukan konten 3D di dalamnya.
//
// Taruh file "textgolem.glb" Anda di folder /public.
// ============================================================================

const HEADLINE_MODEL_PATH = '/textgolem.glb'

// ----------------------------------------------------------------------------
// ROTASI — SUDAH DIVERIFIKASI, JANGAN DIUBAH kecuali Anda re-export model
// dengan orientasi Blender yang berbeda. File textgolem.glb Anda ternyata
// diekspor dengan lebar teks "GOLEM" menghadap ke sumbu kedalaman (Z), bukan
// ke kamera. Rotasi -90° di sumbu Y ini sudah dicek langsung dari geometri
// aslinya (proyeksi vertex model, bukan tebakan visual) dan menghasilkan
// teks yang terbaca tegak & benar: G-O-L-E-M dari kiri ke kanan.
// ----------------------------------------------------------------------------
const HEADLINE_MODEL_ROTATION = [0, -Math.PI / 2, 0]

// ----------------------------------------------------------------------------
// AUTO-FIT — menggantikan cara lama (atur scale & posisi manual dalam world
// unit, gampang bikin bingung & gampang salah per ukuran layar). Di sini
// Anda cukup atur "berapa persen dari layar" yang ingin diisi model, sisanya
// dihitung otomatis dari bounding box asli model + ukuran viewport saat ini
// (responsif, ikut berubah saat resize).
//
// Scale final = MIN(scale berbasis lebar, scale berbasis tinggi) — supaya
// model TIDAK PERNAH overflow/kepotong di salah satu sisi.
// ----------------------------------------------------------------------------
const HEADLINE_FIT_WIDTH_FRACTION = 0.70    // Desktop: maksimal 70% lebar viewport
const HEADLINE_FIT_HEIGHT_FRACTION = 0.32   // Desktop: maksimal 32% tinggi viewport

const HEADLINE_FIT_WIDTH_FRACTION_MOBILE = 0.82
const HEADLINE_FIT_HEIGHT_FRACTION_MOBILE = 0.16

// Pengali TAMBAHAN di atas hasil auto-fit di atas — ini "tombol scale manual"
// yang Anda cari. 1 = ukuran hasil auto-fit apa adanya. 1.1 = 10% lebih besar,
// 0.9 = 10% lebih kecil, dst. Auto-fit tetap menjaga model tidak overflow;
// angka ini cuma memperbesar/memperkecil dari hasil itu.
const HEADLINE_MODEL_SCALE = 0.7        // Desktop
const HEADLINE_MODEL_SCALE_MOBILE = 1 // Mobile

// Geser posisi akhir dari titik tengah layar, dalam FRAKSI viewport
// (0 = tengah layar, +Y = naik ke atas, -Y = turun ke bawah). Nilai di bawah
// meniru posisi teks lama yang berada di dekat atas layar (dulu: top: 6vh).
const HEADLINE_OFFSET_FRACTION = [0, 0.25, 0]         // [x, y, z] Desktop
const HEADLINE_OFFSET_FRACTION_MOBILE = [0, 0.37, 0]  // [x, y, z] Mobile

// ----------------------------------------------------------------------------
// [OPTIMASI FPS] TINGGI LAYER CANVAS HEADLINE
// Dulu canvas headline (+ Bloom composer) selebar & setinggi SELURUH layar padahal
// teks "GOLEM" hanya menempati bagian atas. Itu berarti seluruh layar di-render,
// di-bloom, dan di-composite tiap frame — sangat berat di HP. Sekarang canvas hanya
// setinggi fraksi ini (dari atas layar), dan HeadlineModel meng-KONVERSI otomatis
// semua nilai FIT_HEIGHT_FRACTION & OFFSET_FRACTION di bawah supaya posisi/ukuran teks
// di layar TETAP SAMA seperti sebelumnya (nilai-nilai itu tetap dibaca sebagai
// "fraksi dari tinggi layar penuh", jadi tuning lamamu tidak perlu diubah).
// Naikkan kalau glow/teks terpotong di bawah; turunkan untuk lebih hemat.
// Dipakai juga oleh App.jsx (import) untuk mengatur tinggi layer-nya.
// ----------------------------------------------------------------------------
export const HEADLINE_LAYER_HEIGHT_FRACTION = 0.55

// Kamera canvas headline ini (terpisah dari kamera terrain & golem)
const HEADLINE_CAMERA_POSITION = [0, 0, 5]
const HEADLINE_CAMERA_FOV = 40

// Auto-rotate halus di sumbu Y tambahan (radian/detik) — isi 0 untuk mematikan
const HEADLINE_AUTOROTATE_SPEED = 0

// ----------------------------------------------------------------------------
// PARALLAX TILT — model sedikit "menoleh" mengikuti posisi mouse (desktop only,
// otomatis mati di mobile) supaya tidak terasa kaku/statis. Ini terpisah dari
// parallax translate (PARALLAX_HEADLINE di App.jsx) yang menggeser posisi
// wrapper-nya; ini menambah rotasi 3D sungguhan di dalam scene-nya sendiri,
// jadi terasa lebih ada "kedalaman" (depth).
// ----------------------------------------------------------------------------
const HEADLINE_PARALLAX_ENABLED = false
const HEADLINE_PARALLAX_TILT_X = 0.1        // radian, tilt naik/turun mengikuti mouse Y (atas-bawah)
const HEADLINE_PARALLAX_TILT_Y = 0.16       // radian, tilt kiri/kanan mengikuti mouse X
const HEADLINE_PARALLAX_LERP = 0.05         // kehalusan easing (kecil = lambat & fluid, besar = responsif tapi kaku)

// ----------------------------------------------------------------------------
// GLOW MATERIAL "bluerift" — model Anda punya 2 material bawaan dari Blender:
// "stonetext" (tekstur batu, dibiarkan apa adanya) dan "bluerift" (aksen biru
// solid, warna asli RGB ≈ 0, 0.48, 1). Blok ini membuat material "bluerift"
// SAJA jadi bercahaya (emissive + Bloom), "stonetext" tidak disentuh.
// ----------------------------------------------------------------------------
const HEADLINE_BLUERIFT_GLOW_ENABLED = true

// Warna cahaya yang dipancarkan (emissive). Default dekat dengan warna asli
// material-nya supaya menyala, bukan berubah warna total.
const HEADLINE_BLUERIFT_EMISSIVE_COLOR = '#1e9bff'

// Kekuatan cahaya. Boleh > 1 (memang disengaja "overbright") supaya efek
// Bloom di bawah bisa menangkap & menyebarkannya jadi glow. Naikkan untuk
// glow lebih terang/menyebar, turunkan untuk lebih redup.
const HEADLINE_BLUERIFT_EMISSIVE_INTENSITY = 1

// Opsional: ganti juga warna dasar (base color) "bluerift". Isi null untuk
// tetap pakai warna asli dari Blender, atau isi hex (mis. '#38bdf8') untuk
// mengganti warna dasarnya sekalian.
const HEADLINE_BLUERIFT_BASE_COLOR_OVERRIDE = null

// ----------------------------------------------------------------------------
// FLOW ANIMATION — "sapuan cahaya" berjalan dari kiri ke kanan di atas material
// bluerift secara berulang (loop), sementara bagian yang SEDANG TIDAK dilewati
// sapuan diredupkan sedikit. Diimplementasikan lewat onBeforeCompile (custom
// shader injection), bukan animasi warna material biasa, karena butuh variasi
// per-posisi-x di sepanjang model, bukan cuma satu warna solid untuk semua.
// ----------------------------------------------------------------------------
const HEADLINE_BLUERIFT_FLOW_ENABLED = true
const HEADLINE_BLUERIFT_FLOW_SPEED = 0.6        // kecepatan sapuan (siklus/detik) — makin besar makin cepat
const HEADLINE_BLUERIFT_FLOW_PAUSE = 7.0        // jeda (detik) setelah pita keluar di kanan, sebelum mulai lagi dari kiri (0 = tanpa jeda)
const HEADLINE_BLUERIFT_FLOW_WIDTH = 0.12        // lebar pita cahaya (0..1, relatif terhadap lebar model)
const HEADLINE_BLUERIFT_FLOW_COLOR = '#bdf3ff'   // warna puncak sapuan (biasanya lebih terang/putih-kebiruan)
const HEADLINE_BLUERIFT_FLOW_INTENSITY = 1.4     // seberapa terang saat pita sedang lewat (jangan terlalu tinggi, nanti "bleeding" ke seluruh model lewat Bloom)
const HEADLINE_BLUERIFT_DIM_INTENSITY = 0.35     // seberapa redup bagian yg TIDAK dilewati pita (1 = tak berubah, 0 = gelap total)

// Bloom — WAJIB aktif (true) agar HEADLINE_BLUERIFT_EMISSIVE_INTENSITY di
// atas benar-benar terlihat "menyala menyebar", bukan cuma warna terang datar.
const HEADLINE_BLOOM_ENABLED = true
const HEADLINE_BLOOM_INTENSITY = 1.2      // kekuatan sebaran glow
const HEADLINE_BLOOM_THRESHOLD = 0.65     // ambang kecerahan yang mulai "bersinar" (lebih rendah = makin banyak bagian yang glow, termasuk stonetext jika terlalu rendah)
const HEADLINE_BLOOM_SMOOTHING = 0.25     // transisi halus di sekitar ambang
const HEADLINE_BLOOM_RADIUS = 0.55        // radius blur/sebaran cahaya

// Pencahayaan (Lighting) untuk model headline
const HEADLINE_LIGHTS = {
  ambient: { color: '#ffffff', intensity: .4 },
  key: { color: '#fffef5', position: [4, 4, 3], intensity: 1 },
  fill: { color: '#bae6fd', position: [-3, 1, 2], intensity: 1 },
  rim: { color: '#fef08a', position: [0, 4, -2], intensity: .4 },
}

function TextGolemModel({ isMobile, mouseRef }) {
  const { scene } = useGLTF(HEADLINE_MODEL_PATH)
  const groupRef = useRef()
  const tiltGroupRef = useRef()
  const bluoShadersRef = useRef([]) // kumpulan shader ter-compile dari material bluerift, untuk update uTime tiap frame
  const { viewport } = useThree()

  // Terapkan glow + animasi flow ke material "bluerift" saja (stonetext tidak disentuh).
  // Cukup dijalankan sekali per model load, tidak tergantung viewport.
  useLayoutEffect(() => {
    if (!HEADLINE_BLUERIFT_GLOW_ENABLED) return
    bluoShadersRef.current = []

    // ---- BAKE posisi horizontal (0..1) tiap vertex, SEKALI saja ----
    // Dihitung di frame netral (saat mount: belum di-scale-fit, belum ada tilt),
    // mencakup SELURUH model (semua huruf) supaya 0 = ujung kiri huruf pertama dan
    // 1 = ujung kanan huruf terakhir. Disimpan sebagai attribute 'aFlowX' di
    // geometry, jadi urutan kiri->kanan tetap benar walau nanti model di-scale,
    // digeser, atau di-tilt (semua itu transformasi rigid: urutan relatif tak berubah).
    if (HEADLINE_BLUERIFT_FLOW_ENABLED) {
      scene.updateWorldMatrix(true, true)
      const fullBox = new THREE.Box3().setFromObject(scene)
      const minX = fullBox.min.x
      const rangeX = Math.max(fullBox.max.x - fullBox.min.x, 0.0001)
      const tmp = new THREE.Vector3()
      scene.traverse((obj) => {
        if (!obj.isMesh || !obj.geometry) return
        const geo = obj.geometry
        if (geo.attributes.aFlowX) return // geometry di-cache useGLTF, jangan hitung ulang
        const pos = geo.attributes.position
        const arr = new Float32Array(pos.count)
        for (let i = 0; i < pos.count; i++) {
          tmp.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld)
          arr[i] = (tmp.x - minX) / rangeX
        }
        geo.setAttribute('aFlowX', new THREE.BufferAttribute(arr, 1))
      })
    }

    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach((mat) => {
        if (mat.name !== 'bluerift') return
        mat.emissive = new THREE.Color(HEADLINE_BLUERIFT_EMISSIVE_COLOR)
        mat.emissiveIntensity = HEADLINE_BLUERIFT_EMISSIVE_INTENSITY
        // toneMapped=false: warna emissive tidak "dipotong" oleh tone mapping,
        // sehingga tetap overbright dan bisa ditangkap efek Bloom.
        mat.toneMapped = false
        if (HEADLINE_BLUERIFT_BASE_COLOR_OVERRIDE) {
          mat.color = new THREE.Color(HEADLINE_BLUERIFT_BASE_COLOR_OVERRIDE)
        }
        mat.needsUpdate = true

        // ---- Sapuan cahaya berjalan kiri -> kanan (custom shader) ----
        if (HEADLINE_BLUERIFT_FLOW_ENABLED) {
          mat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 }
            shader.uniforms.uSpeed = { value: HEADLINE_BLUERIFT_FLOW_SPEED }
            shader.uniforms.uWidth = { value: HEADLINE_BLUERIFT_FLOW_WIDTH }
            shader.uniforms.uPause = { value: HEADLINE_BLUERIFT_FLOW_PAUSE }
            shader.uniforms.uGlowColor = { value: new THREE.Color(HEADLINE_BLUERIFT_FLOW_COLOR) }
            shader.uniforms.uGlowIntensity = { value: HEADLINE_BLUERIFT_FLOW_INTENSITY }
            shader.uniforms.uDimIntensity = { value: HEADLINE_BLUERIFT_DIM_INTENSITY }
            shader.vertexShader = shader.vertexShader
              .replace(
                '#include <common>',
                `#include <common>\nattribute float aFlowX;\nvarying float vFlowX;`
              )
              .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\nvFlowX = aFlowX;`
              )

            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <common>',
                `#include <common>
                varying float vFlowX;
                uniform float uTime;
                uniform float uSpeed;
                uniform float uWidth;
                uniform float uPause;
                uniform vec3 uGlowColor;
                uniform float uGlowIntensity;
                uniform float uDimIntensity;`
              )
              .replace(
                '#include <dithering_fragment>',
                `
                {
                  // Pita bergerak dari luar kiri (-uWidth) sampai luar kanan (1+uWidth),
                  // tanpa wrap-around: benar-benar "pojok ke pojok", lalu ulang dari kiri.
                  // Satu siklus = durasi sapuan (1/uSpeed) + jeda (uPause).
                  // Saat jeda, t tertahan di 1.0 sehingga pita berada di luar model (semua redup).
                  float sweepDur = 1.0 / uSpeed;
                  float tt = mod(uTime, sweepDur + uPause);
                  float t = clamp(tt / sweepDur, 0.0, 1.0);
                  float bandCenter = mix(-uWidth, 1.0 + uWidth, t);
                  float dist = abs(vFlowX - bandCenter);
                  float band = 1.0 - smoothstep(0.0, uWidth, dist);
                  gl_FragColor.rgb *= mix(uDimIntensity, 1.0, band);
                  gl_FragColor.rgb += uGlowColor * band * uGlowIntensity;
                }
                #include <dithering_fragment>`
              )

            bluoShadersRef.current.push(shader)
          }
        }
      })
    })
  }, [scene])

  // Hitung ulang scale & posisi setiap kali ukuran viewport berubah (resize,
  // rotate device, dsb) atau saat isMobile berpindah — supaya model SELALU
  // pas mengisi persentase layar yang diminta, di ukuran layar berapa pun.
  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return

    // Reset dulu supaya bounding box diukur dari kondisi "netral"
    // (rotasi tetap terpasang dari JSX, scale 1, posisi 0).
    g.scale.set(1, 1, 1)
    g.position.set(0, 0, 0)
    g.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(g)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const widthFraction = isMobile ? HEADLINE_FIT_WIDTH_FRACTION_MOBILE : HEADLINE_FIT_WIDTH_FRACTION
    // Konversi dari "fraksi layar penuh" ke "fraksi canvas" (canvas hanya setinggi
    // HEADLINE_LAYER_HEIGHT_FRACTION dan menempel di atas layar) -> hasil visual identik.
    const lf = HEADLINE_LAYER_HEIGHT_FRACTION
    const heightFraction =
      (isMobile ? HEADLINE_FIT_HEIGHT_FRACTION_MOBILE : HEADLINE_FIT_HEIGHT_FRACTION) / lf
    const rawOffset = isMobile ? HEADLINE_OFFSET_FRACTION_MOBILE : HEADLINE_OFFSET_FRACTION
    const offsetFraction = [rawOffset[0], (rawOffset[1] - 0.5 + lf / 2) / lf, rawOffset[2]]
    const manualScale = isMobile ? HEADLINE_MODEL_SCALE_MOBILE : HEADLINE_MODEL_SCALE

    const scaleByWidth = (viewport.width * widthFraction) / size.x
    const scaleByHeight = (viewport.height * heightFraction) / size.y
    const scale = Math.min(scaleByWidth, scaleByHeight) * manualScale

    g.scale.setScalar(scale)
    g.position.set(
      -center.x * scale + viewport.width * offsetFraction[0],
      -center.y * scale + viewport.height * offsetFraction[1],
      -center.z * scale + viewport.width * offsetFraction[2]
    )
  }, [scene, viewport.width, viewport.height, isMobile])

  useFrame((_, delta) => {
    if (HEADLINE_AUTOROTATE_SPEED !== 0 && groupRef.current) {
      groupRef.current.rotation.y += HEADLINE_AUTOROTATE_SPEED * delta
    }

    // Parallax tilt: lerp menuju target rotasi berdasarkan posisi mouse
    // (mouseRef di-update & di-lerp sendiri di App.jsx, di sini tinggal dibaca).
    if (HEADLINE_PARALLAX_ENABLED && tiltGroupRef.current && !isMobile) {
      const mx = mouseRef?.current?.x ?? 0
      const my = mouseRef?.current?.y ?? 0
      const targetX = -my * HEADLINE_PARALLAX_TILT_X
      const targetY = mx * HEADLINE_PARALLAX_TILT_Y
      tiltGroupRef.current.rotation.x += (targetX - tiltGroupRef.current.rotation.x) * HEADLINE_PARALLAX_LERP
      tiltGroupRef.current.rotation.y += (targetY - tiltGroupRef.current.rotation.y) * HEADLINE_PARALLAX_LERP
    }

    // Update waktu buat animasi sapuan cahaya bluerift
    if (HEADLINE_BLUERIFT_FLOW_ENABLED && bluoShadersRef.current.length) {
      bluoShadersRef.current.forEach((shader) => {
        shader.uniforms.uTime.value += delta
      })
    }
  })

  return (
    <group ref={tiltGroupRef}>
      <group ref={groupRef} rotation={HEADLINE_MODEL_ROTATION}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

export default function HeadlineModel({ isMobile = false, active = true, mouseRef = null }) {
  return (
    <Canvas
      className="app-headline-canvas"
      camera={{ position: HEADLINE_CAMERA_POSITION, fov: HEADLINE_CAMERA_FOV }}
      dpr={isMobile ? [1, 1.25] : [1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <ambientLight color={HEADLINE_LIGHTS.ambient.color} intensity={HEADLINE_LIGHTS.ambient.intensity} />
      <directionalLight
        position={HEADLINE_LIGHTS.key.position}
        color={HEADLINE_LIGHTS.key.color}
        intensity={HEADLINE_LIGHTS.key.intensity}
      />
      <directionalLight
        position={HEADLINE_LIGHTS.fill.position}
        color={HEADLINE_LIGHTS.fill.color}
        intensity={HEADLINE_LIGHTS.fill.intensity}
      />
      <directionalLight
        position={HEADLINE_LIGHTS.rim.position}
        color={HEADLINE_LIGHTS.rim.color}
        intensity={HEADLINE_LIGHTS.rim.intensity}
      />

      <Suspense fallback={null}>
        <TextGolemModel isMobile={isMobile} mouseRef={mouseRef} />
      </Suspense>

      {HEADLINE_BLOOM_ENABLED && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={HEADLINE_BLOOM_INTENSITY}
            luminanceThreshold={HEADLINE_BLOOM_THRESHOLD}
            luminanceSmoothing={HEADLINE_BLOOM_SMOOTHING}
            radius={HEADLINE_BLOOM_RADIUS}
          />
        </EffectComposer>
      )}
    </Canvas>
  )
}

useGLTF.preload(HEADLINE_MODEL_PATH)