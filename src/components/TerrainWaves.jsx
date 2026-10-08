import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { golemPointerState } from './pointerState.js'

// ============================================================================
// TerrainWaves & ModelWaves — Animasi gelombang (ombak) wireframe 3D:
// Menyebar dari titik klik kursor atau secara otomatis (auto-pulse).
//
// Parameter dapat disesuaikan di options masing-masing model atau tuning di bawah.
// Sangat ringan (zero overhead saat idle): overlay mesh visible=false saat tidak ada gelombang aktif.
// ============================================================================

// ================== Parameter Tuning Default ==================
export const WAVE_CONFIG = {
  enabled: true,
  maxSection: 3.5,                 // Aktif sampai section 3.5 (mode 2D di section 4/5 nonaktif)
  defaultColor: '#6e878f',         // Warna garis wireframe default (kebiruan)
  golemColor: '#67e8f9',           // Warna garis wireframe golem & hand (cyan kristal terang)
  maxOpacity: 0.55,                // Opasitas maksimum garis pada puncak gelombang (0-1)
  speed: 1.35,                     // Kecepatan gelombang menyebar (world unit / detik)
  width: 0.22,                     // Ketebalan cincin puncak gelombang (world unit)
  life: 3.8,                       // Masa aktif gelombang (detik)
  lift: 0.10,                      // Tinggi angkatan vertex di puncak gelombang (world unit)
  depthBias: 0.025,                // Bias dorong ke kamera anti z-fighting
  maxCount: 3,                     // Maksimal gelombang simultan
  autoPulseInterval: 5.0,          // Interval gelombang berulang otomatis (detik). 0 = nonaktif
}

// Elemen UI interaktif yang tidak boleh memicu raycast gelombang saat diklik
const WAVE_IGNORE_SELECTOR =
  'button, a, input, textarea, select, label, nav, aside, [role="button"], ' +
  '.sidebar-drawer, .sidebar-backdrop, .section-why-us__headline-techtext, .section-why-us__golemhand-techtext'

function createWaveMaterial(uniforms, color = WAVE_CONFIG.defaultColor) {
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    const decl = `
      #define WAVE_N ${WAVE_CONFIG.maxCount}
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
        
        // Dorong vertex ke arah luar normal permukaan + sedikit ke atas Y
        vec3 worldNorm = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        waveWp.xyz += (worldNorm * 0.7 + vec3(0.0, 0.3, 0.0)) * (waveLift * uWaveLift);

        vec4 mvPosition = viewMatrix * waveWp;
        // Dorongan kecil ke arah kamera (anti z-fighting)
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
            float x = d - age * uWaveSpeed;           // x > 0: depan puncak, x < 0: belakang
            // Puncak gelombang tajam
            float crest = x > 0.0
              ? 1.0 - smoothstep(0.0, uWaveWidth * 0.35, x)
              : 1.0 - smoothstep(0.0, uWaveWidth, -x);
            // Riak kedua yang lebih redup menyusul
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

// ============================================================================
// Hook Umum: useModelWaves
// Pasang pada sembarang model 3D (groupRef). Menghasilkan efek ombak
// wireframe yang menyebar saat diklik maupun secara ritmis otomatis (auto-pulse).
// ============================================================================
export function useModelWaves(groupRef, options = {}) {
  const { camera, gl } = useThree()

  const {
    color = WAVE_CONFIG.golemColor,
    speed = WAVE_CONFIG.speed,
    width = WAVE_CONFIG.width,
    life = WAVE_CONFIG.life,
    lift = WAVE_CONFIG.lift,
    opacity = WAVE_CONFIG.maxOpacity,
    autoPulse = true,
    pulseInterval = WAVE_CONFIG.autoPulseInterval,
    activeSection = null,
  } = options

  const uniforms = useMemo(
    () => ({
      uWaveHit: {
        value: Array.from({ length: WAVE_CONFIG.maxCount }, () => new THREE.Vector3(9999, 9999, 9999)),
      },
      uWaveAge: { value: new Array(WAVE_CONFIG.maxCount).fill(-1) },
      uWaveSpeed: { value: speed },
      uWaveWidth: { value: width },
      uWaveLife: { value: life },
      uWaveLift: { value: lift },
      uWaveBias: { value: WAVE_CONFIG.depthBias },
      uWaveOpacity: { value: opacity },
    }),
    [speed, width, life, lift, opacity]
  )

  const material = useMemo(() => createWaveMaterial(uniforms, color), [uniforms, color])

  const stateRef = useRef({
    next: 0,
    starts: new Array(WAVE_CONFIG.maxCount).fill(-Infinity),
    overlays: [],
    anyActive: false,
    lastPulse: performance.now() / 1000,
  })

  // 1) Pasang overlay wireframe untuk setiap mesh di dalam grup model
  useEffect(() => {
    if (!WAVE_CONFIG.enabled || !groupRef.current) return
    const meshes = []
    groupRef.current.traverse((o) => {
      if (o.isMesh && !o.userData.isWaveOverlay && !o.userData.isScanOverlay) {
        meshes.push(o)
      }
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
      ov.frustumCulled = false
      ov.renderOrder = 3
      ov.visible = false
      ov.raycast = () => {}
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

  // Helper fungsi memicu gelombang pada titik dunia tertentu
  const triggerWave = (hitPoint) => {
    const s = stateRef.current
    const i = s.next % WAVE_CONFIG.maxCount
    s.next += 1
    uniforms.uWaveHit.value[i].copy(hitPoint)
    s.starts[i] = performance.now() / 1000
  }

  // 2) Raycast manual saat klik di window
  useEffect(() => {
    if (!WAVE_CONFIG.enabled) return
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()

    const onClick = (e) => {
      const t = e.target
      if (t instanceof Element && t.closest(WAVE_IGNORE_SELECTOR)) return

      const g = groupRef.current
      if (!g) return
      const rect = gl.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      if (ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) return

      camera.updateMatrixWorld()
      g.updateMatrixWorld(true)
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObject(g, true)
      // Filter out overlay meshes
      const validHit = hits.find((h) => !h.object.userData.isWaveOverlay && !h.object.userData.isScanOverlay)
      if (validHit) {
        triggerWave(validHit.point)
      }
    }

    window.addEventListener('click', onClick, true)
    return () => window.removeEventListener('click', onClick, true)
  }, [camera, gl, groupRef, uniforms])

  // 3) Frame update: hitung umur gelombang + auto-pulse interval
  useFrame(() => {
    if (!WAVE_CONFIG.enabled) return
    const s = stateRef.current
    const now = performance.now() / 1000

    // Auto pulse jika diaktifkan (membuat model tampak bernapas / hidup secara dinamis)
    if (autoPulse && pulseInterval > 0 && now - s.lastPulse > pulseInterval) {
      s.lastPulse = now
      const g = groupRef.current
      if (g) {
        const wp = new THREE.Vector3()
        g.getWorldPosition(wp)
        // Beri sedikit offset random agar pusat riak bergeser organik
        wp.x += (Math.random() - 0.5) * 0.4
        wp.y += (Math.random() - 0.5) * 0.4
        triggerWave(wp)
      }
    }

    let any = false
    for (let i = 0; i < WAVE_CONFIG.maxCount; i++) {
      const age = now - s.starts[i]
      const active = age >= 0 && age < life
      uniforms.uWaveAge.value[i] = active ? age : -1
      if (active) any = true
    }
    if (any !== s.anyActive) {
      s.anyActive = any
      s.overlays.forEach((ov) => { ov.visible = any })
    }
  })

  return { triggerWave }
}

// Kompatibilitas untuk model Terrain
export function useTerrainWaves(groupRef, activeSection = 1) {
  return useModelWaves(groupRef, {
    color: WAVE_CONFIG.defaultColor,
    speed: WAVE_CONFIG.speed,
    width: WAVE_CONFIG.width,
    life: WAVE_CONFIG.life,
    lift: WAVE_CONFIG.lift,
    opacity: WAVE_CONFIG.maxOpacity,
    autoPulse: false, // terrain hanya saat diklik
    activeSection,
  })
}