import { useRef, useMemo } from 'react'
import { useGLTF, OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ---- Tuning: Camera & Orbit ----
const TERRAIN_CAMERA_POSITION = [11.68, 2.92, -0.94]
const TERRAIN_ORBIT_TARGET = [-0.09, 1.18, -0.69]
const TERRAIN_CAMERA_FOV = 45

// ---- Tuning: Sky ----
const SKY_COLOR = '#23272b'  // warna langit abu di belakang gunung

// ---- Tuning: Fog ----
const FOG_COLOR = '#c8d4dc'  // warna kabut
const FOG_Y_CENTER = 0.3        // tinggi pusat kabut (world unit)
const FOG_DRIFT_SPEED = 0.012      // kecepatan geser kiri→kanan
const FOG_OPACITY = 0.55       // opasitas kabut (0-1)

// ---- Tuning: Snow ----
const SNOW_COUNT = 1800   // jumlah partikel
const SNOW_AREA_X = 30     // lebar area (world unit)
const SNOW_AREA_Y = 14     // tinggi area
const SNOW_AREA_Z = 16     // kedalaman area
const SNOW_FALL_SPEED = 2.4    // kecepatan jatuh (unit/detik)
const SNOW_DRIFT_X = 0.4    // goyang horizontal max
const SNOW_SIZE_MIN = 0.015  // ukuran partikel min
const SNOW_SIZE_MAX = 0.045  // ukuran partikel max
const SNOW_COLOR = '#e8f4f8'
const SNOW_OPACITY = 0.82

// Fog: shader plane animasi UV drift kiri→kanan
function FogLayer() {
  const meshRef = useRef()

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(FOG_COLOR) },
        uOffset: { value: 0 },
        uOpacity: { value: FOG_OPACITY },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3  uColor;
        uniform float uOffset;
        uniform float uOpacity;
        varying vec2  vUv;
        void main() {
          float alpha = smoothstep(1.0, 0.0, vUv.y) * uOpacity;
          float drift = sin((vUv.x + uOffset) * 3.14159 * 2.0) * 0.15 + 0.85;
          gl_FragColor = vec4(uColor, alpha * drift);
        }
      `,
    })
    return mat
  }, [])

  useFrame((_, delta) => {
    material.uniforms.uOffset.value += FOG_DRIFT_SPEED * delta
  })

  return (
    <mesh
      ref={meshRef}
      material={material}
      position={[0, FOG_Y_CENTER, 2]}
      rotation={[-Math.PI / 2 + 0.3, 0, 0]}
    >
      <planeGeometry args={[60, 8, 1, 1]} />
    </mesh>
  )
}

// Snow: Points geometry, partikel jatuh dan wrap
function SnowEffect() {
  const tRef = useRef(0)

  const { positions, speeds, drifts } = useMemo(() => {
    const positions = new Float32Array(SNOW_COUNT * 3)
    const speeds = new Float32Array(SNOW_COUNT)
    const drifts = new Float32Array(SNOW_COUNT)
    for (let i = 0; i < SNOW_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SNOW_AREA_X
      positions[i * 3 + 1] = (Math.random() - 0.5) * SNOW_AREA_Y + SNOW_AREA_Y / 2
      positions[i * 3 + 2] = (Math.random() - 0.5) * SNOW_AREA_Z
      speeds[i] = 0.6 + Math.random() * 0.8
      drifts[i] = (Math.random() - 0.5) * 2
    }
    return { positions, speeds, drifts }
  }, [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  const mat = useMemo(() => new THREE.PointsMaterial({
    color: SNOW_COLOR,
    size: (SNOW_SIZE_MIN + SNOW_SIZE_MAX) / 2,
    transparent: true,
    opacity: SNOW_OPACITY,
    sizeAttenuation: true,
    depthWrite: false,
  }), [])

  useFrame((_, delta) => {
    tRef.current += delta
    const pos = geo.attributes.position.array
    const yTop = SNOW_AREA_Y
    const yBottom = 0
    for (let i = 0; i < SNOW_COUNT; i++) {
      const idx = i * 3
      pos[idx + 1] -= SNOW_FALL_SPEED * speeds[i] * delta
      pos[idx] += Math.sin(tRef.current * 0.8 + drifts[i]) * SNOW_DRIFT_X * delta
      if (pos[idx + 1] < yBottom) {
        pos[idx] = (Math.random() - 0.5) * SNOW_AREA_X
        pos[idx + 1] = yTop
        pos[idx + 2] = (Math.random() - 0.5) * SNOW_AREA_Z
      }
    }
    geo.attributes.position.needsUpdate = true
  })

  return <points geometry={geo} material={mat} />
}

export default function TerrainLoader() {
  const { scene } = useGLTF('/terrainmountain.glb')

  return (
    <>
      {/* Langit abu */}
      <color attach="background" args={[SKY_COLOR]} />

      <PerspectiveCamera makeDefault position={TERRAIN_CAMERA_POSITION} fov={TERRAIN_CAMERA_FOV} near={0.1} far={1000} />

      <OrbitControls
        target={TERRAIN_ORBIT_TARGET}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.5}
        maxDistance={40.0}
        minPolarAngle={THREE.MathUtils.degToRad(0)}
        maxPolarAngle={THREE.MathUtils.degToRad(180)}
        enablePan={true}
      />

      <ambientLight intensity={3.00} color="#5f5f5f" />
      <directionalLight intensity={0.00} color="#fff4e0" position={[5.00, 6.00, 4.00]} castShadow />
      <spotLight intensity={30.00} color="#ffffff" position={[0.00, 4.00, -6.00]} angle={THREE.MathUtils.degToRad(89)} penumbra={0.15} />

      <Environment preset="studio" background={false} blur={0.00} />

      <group position={[0, 0, 0]} rotation={[0, 0, 0]} scale={1}>
        <primitive object={scene} />
      </group>

      {/* Fog di depan bawah gunung */}
      <FogLayer />

      {/* Hujan salju */}
      <SnowEffect />
    </>
  )
}
