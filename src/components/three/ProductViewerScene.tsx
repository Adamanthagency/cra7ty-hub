'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { ModelKey } from '@/lib/types';
import { PALETTE, useSharedPaperTexture } from './paper-material';
import { ProductModel } from './ProductModel';

/**
 * A slow sway rather than a full turn. A continuously spinning model spends
 * a third of its time edge-on, which is the one angle no paper object has
 * anything to say at. Dragging still gives a full rotation.
 */
function IdleTurn({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const target = Math.sin(t * 0.22) * 0.5;
    group.current.rotation.y += (target - group.current.rotation.y) * Math.min(1, delta * 2);
  });
  return <group ref={group}>{children}</group>;
}

/**
 * A draggable viewer for the paper goods. One camera, one light rig, and the
 * active model swapped by key. Transparent background keeps the page showing
 * through, which is what lets the viewer sit on the kraft band.
 */
export default function ProductViewerScene({ model }: { model: ModelKey }) {
  const bump = useSharedPaperTexture(true);
  // low detail when the canvas is small; the shape reads the same, the
  // triangle count does not
  const detail: 'low' | 'high' = typeof window !== 'undefined' && window.innerWidth < 768 ? 'low' : 'high';

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.85, 2.55], fov: 34 }}
      gl={{ alpha: true, antialias: detail === 'high', powerPreference: 'high-performance' }}
    >
      <hemisphereLight args={[PALETTE.paperLight, PALETTE.kraft, 0.9]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2.6, 3.4, 2.4]} intensity={1.7} color={PALETTE.paperLight} />
      <directionalLight position={[-2.4, 0.2, -2]} intensity={0.45} color={PALETTE.paper} />
      <IdleTurn>
        <ProductModel model={model} detail={detail} bump={bump} />
      </IdleTurn>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.75}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.78}
      />
    </Canvas>
  );
}