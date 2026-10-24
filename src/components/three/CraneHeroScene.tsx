'use client';

import { ContactShadows } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useIsSmallScreen } from '@/lib/use-env';
import {
  PALETTE,
  createPaperMaterial,
  useDisposable,
  useSharedPaperTexture,
} from './paper-material';
import { createCraneGeometry, disposeCraneGeometry } from './crane';
import { CraneModel, type CraneHandles } from './CraneModel';

/**
 * Floating studio light. Warm, high and slightly to the front, so the folded
 * facets each pick up a different value instead of blowing out.
 */
function StudioLights({ shadows }: { shadows: boolean }) {
  return (
    <>
      {/* A hard key against a soft fill. Paper on paper only reads as folded
          when the facets fall into visibly different values, so the ambient
          is kept deliberately low. */}
      <ambientLight intensity={0.28} />
      <hemisphereLight args={[PALETTE.paperLight, PALETTE.kraft, 0.4]} />
      <directionalLight
        position={[2.6, 3.4, 2.4]}
        intensity={2.6}
        color={PALETTE.paperLight}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={12}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-3, 0.6, -2.4]} intensity={0.34} color={PALETTE.paper} />
      <directionalLight
        position={[0, -2.4, 1.2]}
        intensity={0.22}
        color={PALETTE.kraft}
      />
    </>
  );
}

interface RigProps {
  handles: React.MutableRefObject<CraneHandles>;
  reduced: boolean;
}

/** The yaw the bird is presented at: three-quarter, neck toward the reader. */
const HERO_YAW = -0.62;

function CraneRig({ handles, reduced }: RigProps) {
  const { pointer } = useThree();
  const scroll = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scroll.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced]);

  useFrame((state, delta) => {
    const { root, leftWing, rightWing } = handles.current;
    if (!root) return;

    const t = state.clock.elapsedTime;

    // slow idle float
    const floatY = Math.sin(t * 0.62) * 0.055;
    const sway = Math.sin(t * 0.41) * 0.05;

    if (!reduced) {
      // Mouse parallax, eased so the bird never snaps to the cursor. The yaw
      // sways around one held pose rather than spinning: a hero that rotates
      // all the way round spends half its time showing its paper-thin edge.
      const targetX = -pointer.y * 0.24;
      const targetZ = pointer.x * 0.13;
      const targetY = HERO_YAW + pointer.x * 0.3 + Math.sin(t * 0.19) * 0.34;
      root.rotation.x += (targetX - root.rotation.x) * Math.min(1, delta * 2.6);
      root.rotation.z += (targetZ - root.rotation.z) * Math.min(1, delta * 2.6);
      root.rotation.y += (targetY - root.rotation.y) * Math.min(1, delta * 1.8);
    }

    root.position.y = floatY;
    root.position.x = sway;

    // Wings open further as the page scrolls. Negative X rotation lifts the
    // span, which is what a crane actually does in the air.
    const p = scroll.current;
    const base = -0.07 - p * 0.5;
    const flap = reduced ? 0 : Math.sin(t * 0.75) * 0.05;
    if (leftWing) {
      leftWing.rotation.x += (base - flap - leftWing.rotation.x) * Math.min(1, delta * 3);
    }
    if (rightWing) {
      rightWing.rotation.x += (base + flap - rightWing.rotation.x) * Math.min(1, delta * 3);
    }
  });

  return null;
}

/**
 * The hero canvas contents. Loaded only once the environment check has decided
 * WebGL is safe to use, so the server always ships the static fallback.
 */
export default function CraneHeroScene() {
  const small = useIsSmallScreen();
  const bump = useSharedPaperTexture(true);
  const handles = useRef<CraneHandles>({ root: null, leftWing: null, rightWing: null });

  const geometry = useDisposable(createCraneGeometry, disposeCraneGeometry, []);

  const paperMaterial = useDisposable(
    () =>
      createPaperMaterial(bump, {
        // brighter than the page so lit facets lift off the background
        color: '#fffdf7',
        roughness: 0.92,
        bumpScale: small ? 0.008 : 0.016,
      }),
    (m) => m.dispose(),
    [bump, small],
  );

  const accentMaterial = useDisposable(
    () =>
      createPaperMaterial(bump, {
        color: PALETTE.vermilion,
        roughness: 0.88,
        bumpScale: small ? 0.008 : 0.014,
      }),
    (m) => m.dispose(),
    [bump, small],
  );

  // transparent canvas so the paper background shows through the bird
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.95, 3.1], fov: 32 }}
      gl={{
        alpha: true,
        antialias: !small,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      shadows={false}
    >
      <StudioLights shadows={false} />
      <group scale={1.35} position={[0, 0, 0]} rotation={[-0.3, -0.62, 0]}>
        <CraneModel
          ref={handles}
          geometry={geometry}
          paperMaterial={paperMaterial}
          accentMaterial={accentMaterial}
        />
      </group>
      <CraneRig handles={handles} reduced={false} />
      {!small && (
        <ContactShadows
          position={[0, -1.02, 0]}
          opacity={0.3}
          scale={5}
          blur={2.8}
          far={2.1}
          resolution={512}
          color="#4a3c28"
        />
      )}
    </Canvas>
  );
}