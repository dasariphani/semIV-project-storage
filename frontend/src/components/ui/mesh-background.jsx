import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

const vertexShader = `
  uniform float time;
  uniform float intensity;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(pos.x * 10.0 + time) * 0.1 * intensity;
    pos.x += cos(pos.y * 8.0 + time * 1.5) * 0.05 * intensity;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  uniform float time;
  uniform float intensity;
  uniform vec3 color1;
  uniform vec3 color2;
  varying vec2 vUv;
  
  void main() {
    vec2 uv = vUv;
    float noise = sin(uv.x * 20.0 + time) * cos(uv.y * 15.0 + time * 0.8);
    noise += sin(uv.x * 35.0 - time * 2.0) * cos(uv.y * 25.0 + time * 1.2) * 0.5;
    vec3 color = mix(color1, color2, noise * 0.5 + 0.5);
    color = mix(color, vec3(1.0), pow(abs(noise), 2.0) * intensity * 0.3);
    float glow = 1.0 - length(uv - 0.5) * 1.5;
    glow = pow(max(glow, 0.0), 2.0);
    gl_FragColor = vec4(color * glow, glow * 0.9);
  }
`

function ShaderPlane({ color1 = "#1a0533", color2 = "#0a0a2e" }) {
  const mesh = useRef(null)

  const uniforms = useMemo(() => ({
    time:      { value: 0 },
    intensity: { value: 1.0 },
    color1:    { value: new THREE.Color(color1) },
    color2:    { value: new THREE.Color(color2) },
  }), [color1, color2])

  useFrame((state) => {
    if (mesh.current) {
      uniforms.time.value      = state.clock.elapsedTime
      uniforms.intensity.value = 1.0 + Math.sin(state.clock.elapsedTime * 2) * 0.3
    }
  })

  return (
    <mesh ref={mesh}>
      <planeGeometry args={[4, 4, 32, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function EnergyRing({ radius = 1.2 }) {
  const mesh = useRef(null)

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.z  = state.clock.elapsedTime * 0.5
      mesh.current.material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.15
    }
  })

  return (
    <mesh ref={mesh}>
      <ringGeometry args={[radius * 0.8, radius, 64]} />
      <meshBasicMaterial color="#6366f1" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function MeshBackground({ color1, color2 }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100%', height: '100%', zIndex: -1,
      background: '#0a0a0f'
    }}>
      <Canvas camera={{ position: [0, 0, 2] }}>
        <ShaderPlane color1={color1} color2={color2} />
        <EnergyRing radius={1.2} />
        <EnergyRing radius={1.8} />
      </Canvas>
    </div>
  )
}