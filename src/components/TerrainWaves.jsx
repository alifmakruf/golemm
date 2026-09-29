import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { golemPointerState } from './pointerState.js'

// ============================================================================
// TerrainWaves — klik terrain => gelombang (ombak) wireframe menyebar dari
// titik klik. Gaya wireframe-nya meniru overlay pemindai milik Golem
// (GolemModel.jsx): MeshBasicMaterial wireframe, warna terang kebiruan,
// transparan, depthWrite off, toneMapped off (supaya ikut kena Bloom).
//
// Cara kerja:
//  1. Tiap mesh terrain dibuatkan mesh overlay (geometry SAMA, dipasang sebagai
//     child-nya, jadi ikut semua animasi/transform terrain) dengan material
//     wireframe + custom shader gelombang.
//  2. Klik di window -> raycast manual ke terrain (tidak lewat event R3F, karena
//     layer HTML di atas canvas menangkap klik). Titik kena = pusat gelombang.
//  3. Shader menampilkan wireframe HANYA di sekitar cincin yang membesar
//     (jarak dari pusat ~ umur * kecepatan), makin lama makin pudar.
//     Vertex di area cincin juga terangkat sedikit -> terasa seperti ombak.
//  Overlay disembunyikan (visible=false) saat tidak ada gelombang aktif,
//  jadi tidak ada beban render saat idle.
// ============================================================================

// ================== Parameter Tuning: Wave Wireframe ==================
const WAVE_ENABLED = true
const WAVE_MAX_SECTION = 3            // Gelombang aktif di Section 1..N (Section 4 & 5 = mode 2D, nonaktif)
const WAVE_COLOR = '#6e878f'          // Warna garis wireframe (sama dengan wireframe Golem)
const WAVE_MAX_OPACITY = 0.5          // Opasitas maksimum garis pada puncak gelombang (0-1)
const WAVE_SPEED = 1.2                // Kecepatan gelombang menyebar (world unit / detik)
const WAVE_WIDTH = 0.2                // Ketebalan cincin gelombang (world unit)
const WAVE_LIFE = 4.4                 // Berapa lama gelombang hidup sebelum hilang (detik)
const WAVE_LIFT = 0.12                // Tinggi angkatan vertex di puncak gelombang (world unit). 0 = tanpa angkatan
const WAVE_DEPTH_BIAS = 0.03          // Dorongan kecil ke arah kamera supaya garis tidak "z-fighting" dengan permukaan
const WAVE_MAX_COUNT = 4              // Maks. gelombang bersamaan (klik beruntun akan menimpa yang paling lama)

// Klik pada elemen-elemen ini TIDAK memicu gelombang (UI interaktif)
const WAVE_IGNORE_SELECTOR =
  'button, a, input, textarea, select, label, nav, aside, [role="button"], ' +
  '.sidebar-drawer, .sidebar-backdrop'

function createWaveMaterial(uniforms) {
  const mat = new THREE.MeshBasicMaterial({
    color: WAVE_COLOR,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    const decl = `
      #define WAVE_N ${WAVE_MAX_COUNT}
      uniform vec3 uWaveHit[WAVE_N];
      uniform float uWaveAge[WAVE_N];
      uniform float uWaveSpeed;
      uniform float uWaveWidth;
      uniform float uWaveLife;
      uniform float uWaveLift;
      uniform float uWaveBias;
      uniform float uWaveOpacity;
      varying vec3 vWaveWorldPos;`

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${decl}`)
      .replace(
        '#include <project_vertex>',
        `
        vec4 waveWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          waveWp = instanceMatrix * waveWp;
        #endif
        waveWp = modelMatrix * waveWp;
        vWaveWorldPos = waveWp.xyz;

        float waveLift = 0.0;
        for (int i = 0; i < WAVE_N; i++) {
          float age = uWaveAge[i];
          if (age >= 0.0) {
            float d = distance(waveWp.xyz, uWaveHit[i]);
            float x = d - age * uWaveSpeed;
            float env = 1.0 - smoothstep(0.0, uWaveLife, age);
            float hump = 1.0 - smoothstep(0.0, uWaveWidth * 2.5, abs(x));
            waveLift = max(waveLift, hump * env);
          }
        }
        waveWp.y += waveLift * uWaveLift;

        vec4 mvPosition = viewMatrix * waveWp;
        // dorong sedikit ke arah kamera (sepanjang sinar pandang) -> anti z-fighting
        mvPosition.xyz -= normalize(mvPosition.xyz) * uWaveBias;
        gl_Position = projectionMatrix * mvPosition;
        `
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${decl}`)
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float waveAmt = 0.0;
        for (int i = 0; i < WAVE_N; i++) {
          float age = uWaveAge[i];
          if (age >= 0.0) {
            float d = distance(vWaveWorldPos, uWaveHit[i]);
            float x = d - age * uWaveSpeed;           // x > 0: di depan puncak, x < 0: di belakang
            // puncak: tepi depan tajam, ekor di belakang melebar
            float crest = x > 0.0
              ? 1.0 - smoothstep(0.0, uWaveWidth * 0.35, x)
              : 1.0 - smoothstep(0.0, uWaveWidth, -x);
            // gelombang kedua yang lebih redup mengikuti di belakang
            float crest2 = 0.45 * (1.0 - smoothstep(0.0, uWaveWidth * 0.6, abs(x + uWaveWidth * 2.2)));
            float env = 1.0 - smoothstep(0.0, uWaveLife, age);
            waveAmt = max(waveAmt, max(crest, crest2) * env);
          }
        }
        gl_FragColor.a *= waveAmt * uWaveOpacity;
        if (gl_FragColor.a < 0.005) discard;`
      )
  }

  return mat
}

// Pasang di dalam komponen yang berada di dalam <Canvas>. groupRef = group
// yang membungkus model terrain.
export function useTerrainWaves(groupRef, activeSection = 1) {
  const { camera, gl } = useThree()

  const activeSectionRef = useRef(activeSection)
  activeSectionRef.current = activeSection

  const uniforms = useMemo(
    () => ({
      uWaveHit: {
        value: Array.from({ length: WAVE_MAX_COUNT }, () => new THREE.Vector3(9999, 9999, 9999)),
      },
      uWaveAge: { value: new Array(WAVE_MAX_COUNT).fill(-1) },
      uWaveSpeed: { value: WAVE_SPEED },
      uWaveWidth: { value: WAVE_WIDTH },
      uWaveLife: { value: WAVE_LIFE },
      uWaveLift: { value: WAVE_LIFT },
      uWaveBias: { value: WAVE_DEPTH_BIAS },
      uWaveOpacity: { value: WAVE_MAX_OPACITY },
    }),
    []
  )

  const material = useMemo(() => createWaveMaterial(uniforms), [uniforms])

  const stateRef = useRef({
    next: 0,
    starts: new Array(WAVE_MAX_COUNT).fill(-Infinity),
    overlays: [],
    anyActive: false,
  })

  // 1) Buat overlay wireframe untuk tiap mesh terrain
  useEffect(() => {
    if (!WAVE_ENABLED || !groupRef.current) return
    const meshes = []
    groupRef.current.traverse((o) => {
      if (o.isMesh && !o.userData.isWaveOverlay) meshes.push(o)
    })

    const overlays = meshes.map((m) => {
      let ov
      if (m.isSkinnedMesh) {
        ov = new THREE.SkinnedMesh(m.geometry, material)
        ov.bind(m.skeleton, m.bindMatrix)
      } else if (m.isInstancedMesh) {
        ov = new THREE.InstancedMesh(m.geometry, material, m.count)
        ov.instanceMatrix = m.instanceMatrix
      } else {
        ov = new THREE.Mesh(m.geometry, material)
      }
      if (m.morphTargetInfluences) {
        ov.morphTargetInfluences = m.morphTargetInfluences
        ov.morphTargetDictionary = m.morphTargetDictionary
      }
      ov.frustumCulled = false        // vertex bisa terangkat oleh gelombang
      ov.renderOrder = 1
      ov.visible = false
      ov.raycast = () => { }           // overlay tidak ikut kena raycast
      ov.userData.isWaveOverlay = true
      m.add(ov)
      return ov
    })

    stateRef.current.overlays = overlays
    stateRef.current.anyActive = false

    return () => {
      overlays.forEach((ov) => ov.parent && ov.parent.remove(ov))
      stateRef.current.overlays = []
    }
  }, [groupRef, material])

  // 2) Klik di mana saja di window -> raycast manual ke terrain
  useEffect(() => {
    if (!WAVE_ENABLED) return
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()

    const onClick = (e) => {
      if (activeSectionRef.current > WAVE_MAX_SECTION) return
      const t = e.target
      if (t instanceof Element && t.closest(WAVE_IGNORE_SELECTOR)) return
      // Klik tepat di atas model Golem (Hero) -> biarkan Golem yang menanganinya
      if (activeSectionRef.current === 1 && golemPointerState.overModel) return

      const g = groupRef.current
      const rect = gl.domElement.getBoundingClientRect()
      if (!g || !rect.width || !rect.height) return

      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      if (ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) return

      camera.updateMatrixWorld()
      g.updateMatrixWorld(true)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(g, true)[0]
      if (!hit) return // klik di langit / di luar terrain

      const s = stateRef.current
      const i = s.next % WAVE_MAX_COUNT
      s.next += 1
      uniforms.uWaveHit.value[i].copy(hit.point)
      s.starts[i] = performance.now() / 1000
    }

    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [camera, gl, groupRef, uniforms])

  // 3) Update umur tiap gelombang; tampilkan overlay hanya saat ada yang aktif
  useFrame(() => {
    if (!WAVE_ENABLED) return
    const s = stateRef.current
    const now = performance.now() / 1000
    let any = false
    for (let i = 0; i < WAVE_MAX_COUNT; i++) {
      const age = now - s.starts[i]
      const active = age >= 0 && age < WAVE_LIFE
      uniforms.uWaveAge.value[i] = active ? age : -1
      if (active) any = true
    }
    if (any !== s.anyActive) {
      s.anyActive = any
      s.overlays.forEach((ov) => { ov.visible = any })
    }
  })
}