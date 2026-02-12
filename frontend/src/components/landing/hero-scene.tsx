"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import * as THREE from "three";

/* ── lat/lng to 3D position on sphere ────────────── */
function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/* ── financial hubs ──────────────────────────────── */
const GLOBE_RADIUS = 2.5;

const hubs: { name: string; lat: number; lng: number }[] = [
  { name: "New York", lat: 40.7, lng: -74.0 },
  { name: "London", lat: 51.5, lng: -0.1 },
  { name: "Tokyo", lat: 35.7, lng: 139.7 },
  { name: "Singapore", lat: 1.3, lng: 103.8 },
  { name: "Hong Kong", lat: 22.3, lng: 114.2 },
  { name: "Frankfurt", lat: 50.1, lng: 8.7 },
  { name: "Sydney", lat: -33.9, lng: 151.2 },
  { name: "Dubai", lat: 25.2, lng: 55.3 },
  { name: "Shanghai", lat: 31.2, lng: 121.5 },
  { name: "Sao Paulo", lat: -23.5, lng: -46.6 },
];

const tradeRoutes: [number, number][] = [
  [0, 1], // NY - London
  [1, 2], // London - Tokyo
  [2, 3], // Tokyo - Singapore
  [3, 6], // Singapore - Sydney
  [4, 5], // Hong Kong - Frankfurt
  [0, 5], // NY - Frankfurt
  [1, 7], // London - Dubai
  [7, 8], // Dubai - Shanghai
  [0, 9], // NY - Sao Paulo
  [8, 2], // Shanghai - Tokyo
];

/* ── wireframe globe ─────────────────────────────── */
function Globe() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const { size } = useThree();

  const handlePointerMove = useCallback(
    (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / size.width) * 2 - 1;
      mouseRef.current.y = -(e.clientY / size.height) * 2 + 1;
    },
    [size]
  );

  useEffect(() => {
    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("mousemove", handlePointerMove);
  }, [handlePointerMove]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Slow auto-rotation
    groupRef.current.rotation.y = t * 0.05;
    // Mouse parallax tilt
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      mouseRef.current.y * 0.15,
      0.02
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      -mouseRef.current.x * 0.08,
      0.02
    );
  });

  return (
    <group ref={groupRef} position={[1.2, 0, 0]}>
      {/* Wireframe sphere */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <meshBasicMaterial
          color="#10b981"
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Latitude rings for depth */}
      <LatitudeRings />

      {/* Atmosphere glow */}
      <AtmosphereGlow />

      {/* Hub dots */}
      {hubs.map((hub) => (
        <HubDot key={hub.name} lat={hub.lat} lng={hub.lng} />
      ))}

      {/* Trade arcs */}
      {tradeRoutes.map(([from, to], i) => (
        <TradeArc
          key={`${from}-${to}`}
          from={hubs[from]}
          to={hubs[to]}
          index={i}
        />
      ))}
    </group>
  );
}

/* ── extra latitude rings for visual depth ───────── */
function LatitudeRings() {
  const ringsRef = useRef<THREE.Group>(null);

  return (
    <group ref={ringsRef}>
      {[-60, -30, 0, 30, 60].map((lat) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const ringRadius = GLOBE_RADIUS * Math.sin(phi);
        const y = GLOBE_RADIUS * Math.cos(phi);
        return (
          <mesh key={lat} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[ringRadius - 0.003, ringRadius + 0.003, 80]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.06}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Fresnel atmosphere glow ─────────────────────── */
function AtmosphereGlow() {
  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vec3 viewDir = normalize(-vPosition);
            float fresnel = 1.0 - dot(viewDir, vNormal);
            fresnel = pow(fresnel, 3.0);
            vec3 emerald = vec3(0.063, 0.725, 0.506);
            vec3 cyan = vec3(0.024, 0.714, 0.831);
            vec3 color = mix(emerald, cyan, fresnel);
            gl_FragColor = vec4(color, fresnel * 0.35);
          }
        `,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  return (
    <mesh material={shaderMaterial}>
      <sphereGeometry args={[GLOBE_RADIUS * 1.02, 48, 48]} />
    </mesh>
  );
}

/* ── glowing hub dot ─────────────────────────────── */
function HubDot({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVec3(lat, lng, GLOBE_RADIUS), [lat, lng]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.getElapsedTime() * 2 + lat) * 0.3;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[0.04, 12, 12]} />
      <meshBasicMaterial
        color="#34d399"
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/* ── animated trade arc ──────────────────────────── */
function TradeArc({
  from,
  to,
  index,
}: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  index: number;
}) {
  const lineRef = useRef<THREE.Mesh & { material?: THREE.LineDashedMaterial }>(null);

  const startVec = useMemo(
    () => latLngToVec3(from.lat, from.lng, GLOBE_RADIUS),
    [from.lat, from.lng]
  );
  const endVec = useMemo(
    () => latLngToVec3(to.lat, to.lng, GLOBE_RADIUS),
    [to.lat, to.lng]
  );

  // Mid-point elevated above the globe surface
  const midVec = useMemo(() => {
    const mid = new THREE.Vector3()
      .addVectors(startVec, endVec)
      .multiplyScalar(0.5);
    const dist = startVec.distanceTo(endVec);
    const elevation = GLOBE_RADIUS + dist * 0.35;
    mid.normalize().multiplyScalar(elevation);
    return mid;
  }, [startVec, endVec]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const mat = lineRef.current.material as THREE.Material & { dashOffset?: number; opacity?: number };
    if (mat && "dashOffset" in mat) {
      mat.dashOffset = -(clock.getElapsedTime() * 0.5 + index * 0.7);
    }
  });

  return (
    <QuadraticBezierLine
      ref={lineRef as never}
      start={startVec}
      end={endVec}
      mid={midVec}
      color="#10b981"
      opacity={0.4}
      transparent
      lineWidth={1.5}
      dashed
      dashScale={8}
      dashSize={0.4}
      gapSize={0.3}
    />
  );
}

/* ── scene ────────────────────────────────────────── */
function Scene() {
  return (
    <>
      <ambientLight intensity={0.1} />
      <Globe />
    </>
  );
}

export function HeroScene() {
  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", position: "absolute", inset: 0 }}
      >
        <Scene />
      </Canvas>
      {/* Overlays for text readability */}
      <div className="pointer-events-none absolute inset-0 bg-zinc-950/40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-transparent to-zinc-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_65%_50%,transparent_30%,rgba(5,5,7,0.7)_70%)]" />
      {/* Extra left-side darkening so text on the left is crisp */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-zinc-950/20 to-transparent" />
    </div>
  );
}
