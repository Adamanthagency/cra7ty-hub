'use client';

import { ContactShadows } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PALETTE, useSharedPaperTexture, useDisposable } from './paper-material';
import { useIsSmallScreen } from '@/lib/use-env';

/**
 * A flat square of paper folding itself into a crane.
 *
 * The sheet is a genuine folded surface, not a bent ribbon. Thirteen stations
 * run along a spine and each station is three points — the crease, the left
 * edge, the right edge — so the paper carries a real centre crease along its
 * whole length. Both edges of every station rise by the same angle out of the
 * spine plane, which makes the cross section a shallow V with the crease at the
 * bottom.
 *
 * That one angle is the hinge the whole sequence turns on:
 *
 *  - at zero the sheet is dead flat and reads as a square,
 *  - opening it to about fifty degrees is a fold in half, and the square
 *    becomes a tent with two clear lit panels and one shadowed valley,
 *  - closing it again at the end is only sixteen degrees, which is a wing
 *    lying almost flat. Because the neck and tail strips stay narrow all the
 *    way through, lifting every edge at once raises the broad body panels into
 *    wings and leaves the head and tail untouched. That asymmetry is what
 *    makes the finish read as a bird rather than as a folded card.
 *
 * The pose is driven by keyframes rather than by integrated hinge angles, so
 * every frame is a legible state: flat square, tent, packet, scored square,
 * collapsed base, petal fold, spreading wings, crane. Spine and width
 * interpolate together, so the paper never tears and the surface stays closed.
 *
 * Rendering detail that matters: `flatShading` is what makes this look like
 * paper. Three.js derives the facet normal in the shader from screen-space
 * derivatives, so every panel catches the key light at its own value. The
 * normal attribute is kept correct as well, but the crisp creases come from
 * the flat shading.
 */

const STATIONS = 13;
const PANELS = STATIONS - 1;
/** Two triangles for each of the two halves of a panel. */
const TRIS_PER_PANEL = 4;
const VERTEX_COUNT = PANELS * TRIS_PER_PANEL * 3;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoother = (v: number) => v * v * v * (v * (v * 6 - 15) + 10);

interface Keyframe {
  /** timeline position this pose is held at */
  at: number;
  /** the crease point per station, in the plane the bird is built in */
  spine: readonly (readonly [number, number])[];
  /** half the width of the sheet at each station */
  halfWidth: readonly number[];
  /** the V angle of the sheet's cross section, in radians */
  fold: number;
  /** how hard the crease banding shows; flat poses need it painted on */
  band: number;
  /** the vermilion beak, faded in once the neck is a thin strip */
  accent: number;
  rotX: number;
  rotY: number;
}

const flat = (n: number) => new Array<number>(STATIONS).fill(n);

/**
 * The flat sheet. The run of the spine and the width across it both measure
 * 1.68, so this is a square, which is the only honest place to start.
 */
const FLAT_SPINE: readonly (readonly [number, number])[] = Array.from(
  { length: STATIONS },
  (_, i) => [-0.84 + 0.14 * i, 0] as const,
);

/** Folded in half: the far half retraces the near half, one layer below. */
const PACKET_SPINE: readonly (readonly [number, number])[] = [
  [-0.84, 0.05],
  [-0.7, 0.05],
  [-0.56, 0.05],
  [-0.42, 0.05],
  [-0.28, 0.05],
  [-0.14, 0.05],
  [0, 0],
  [-0.14, -0.05],
  [-0.28, -0.05],
  [-0.42, -0.05],
  [-0.56, -0.05],
  [-0.7, -0.05],
  [-0.84, -0.05],
];

/** Opened back out, with the creases still standing very slightly proud. */
const CREASE_SPINE: readonly (readonly [number, number])[] = FLAT_SPINE.map(
  ([x], i) => [x, 0.02 * Math.cos((Math.PI * i) / (STATIONS - 1))] as const,
);

/** The collapsed base: one short upright packet, nothing spread. */
const BASE_SPINE: readonly (readonly [number, number])[] = [
  [-0.42, 0.3],
  [-0.35, 0.24],
  [-0.28, 0.185],
  [-0.21, 0.135],
  [-0.14, 0.095],
  [-0.07, 0.065],
  [0, 0.05],
  [0.07, 0.05],
  [0.14, 0.065],
  [0.21, 0.095],
  [0.28, 0.135],
  [0.35, 0.185],
  [0.42, 0.245],
];

/** The petal fold: the layers drawn out, the tail and neck starting to lift. */
const PETAL_SPINE: readonly (readonly [number, number])[] = [
  [-0.76, 0.26],
  [-0.62, 0.21],
  [-0.48, 0.16],
  [-0.34, 0.11],
  [-0.2, 0.075],
  [-0.04, 0.05],
  [0.11, 0.05],
  [0.25, 0.075],
  [0.38, 0.12],
  [0.5, 0.19],
  [0.61, 0.25],
  [0.71, 0.31],
  [0.79, 0.35],
];

/**
 * The crane. Proportioned against the hero bird: a level body through the
 * middle, a long tail rising at about twenty five degrees and a longer neck
 * climbing at about thirty, with the wing spread carried by the one broad run
 * of panels over the body. The neck and tail are both narrow enough to read as
 * spikes against the wing, which is what stops the bird looking like a wedge.
 */
const CRANE_SPINE: readonly (readonly [number, number])[] = [
  [-0.755, 0.328],
  [-0.624, 0.267],
  [-0.493, 0.209],
  [-0.361, 0.156],
  [-0.23, 0.103],
  [-0.09, 0.062],
  [0.057, 0.045],
  [0.205, 0.049],
  [0.345, 0.07],
  [0.476, 0.13],
  [0.591, 0.205],
  [0.698, 0.285],
  [0.796, 0.355],
];

/**
 * Which panels carry a crease line, and how hard. Evenly banded panels read as
 * stripes rather than as a score pattern, so this is deliberately uneven: a few
 * strong folds with weaker ones between them.
 */
const CREASE_PATTERN: readonly number[] = [1, 0, 0.5, 0, 1, 0, 0.25, 0.72, 0, 0.4, 0, 1];

/**
 * One pose per caption, each placed on the midpoint of the scroll range that
 * caption owns, so the picture on screen and the words under it agree. The
 * first two captions own separate folds; the middle four share the petal fold
 * and the base collapse; the last four share the neck, the tail and the wings.
 */
const KEYFRAMES: readonly Keyframe[] = [
  {
    at: 0,
    spine: FLAT_SPINE,
    halfWidth: flat(0.84),
    fold: 0,
    band: 1,
    accent: 0,
    // stood up against the reader, so the opening frame is a square on screen
    rotX: 1.02,
    rotY: -0.1,
  },
  {
    // Fold in half: the square hinges up about its centre crease.
    at: 0.042,
    spine: FLAT_SPINE,
    halfWidth: flat(0.84),
    fold: 0.92,
    band: 0.18,
    accent: 0,
    rotX: 0.42,
    rotY: -0.24,
  },
  {
    // Fold in half again: a short, deep, four layer packet.
    at: 0.125,
    spine: PACKET_SPINE,
    halfWidth: flat(0.42),
    fold: 1.16,
    band: 0.14,
    accent: 0,
    rotX: 0.26,
    rotY: -0.32,
  },
  {
    // Crease both diagonals: flat again, but scored.
    at: 0.208,
    spine: CREASE_SPINE,
    halfWidth: flat(0.8),
    fold: 0,
    band: 1,
    accent: 0,
    rotX: 0.74,
    rotY: -0.2,
  },
  {
    // Open to a square: the creases still standing.
    at: 0.292,
    spine: CREASE_SPINE,
    halfWidth: flat(0.8),
    fold: 0.05,
    band: 0.92,
    accent: 0,
    rotX: 0.6,
    rotY: -0.26,
  },
  {
    // Collapse the base: one short upright packet, nothing spread.
    at: 0.375,
    spine: BASE_SPINE,
    halfWidth: [0.045, 0.05, 0.055, 0.06, 0.065, 0.07, 0.07, 0.07, 0.065, 0.06, 0.055, 0.05, 0.045],
    fold: 0.08,
    band: 0.42,
    accent: 0,
    rotX: 0.34,
    rotY: -0.4,
  },
  {
    // Petal fold: the layers drawn out for the first time.
    at: 0.5,
    spine: PETAL_SPINE,
    halfWidth: [0.03, 0.05, 0.09, 0.2, 0.38, 0.52, 0.44, 0.3, 0.17, 0.1, 0.07, 0.045, 0.016],
    fold: 0.1,
    band: 0.26,
    accent: 0,
    rotX: 0.36,
    rotY: -0.48,
  },
  {
    // Repeat behind: the wings start to open out of the body.
    at: 0.66,
    spine: PETAL_SPINE.map((p, i) => [p[0] + (CRANE_SPINE[i][0] - p[0]) * 0.5, p[1] + (CRANE_SPINE[i][1] - p[1]) * 0.5] as const),
    halfWidth: [0.028, 0.045, 0.076, 0.158, 0.33, 0.51, 0.55, 0.37, 0.185, 0.093, 0.06, 0.038, 0.014],
    fold: 0.17,
    band: 0.1,
    accent: 0.2,
    rotX: 0.39,
    rotY: -0.57,
  },
  {
    // Reverse fold, neck up, tail up: the bird takes its shape.
    at: 0.83,
    spine: PETAL_SPINE.map((p, i) => [p[0] + (CRANE_SPINE[i][0] - p[0]) * 0.8, p[1] + (CRANE_SPINE[i][1] - p[1]) * 0.8] as const),
    halfWidth: [0.027, 0.042, 0.068, 0.132, 0.296, 0.504, 0.616, 0.416, 0.196, 0.088, 0.054, 0.035, 0.013],
    fold: 0.23,
    band: 0,
    accent: 0.7,
    rotX: 0.41,
    rotY: -0.64,
  },
  {
    // Set the wings: the same hinge at sixteen degrees, so the broad panels
    // spread sideways and stay separable instead of curling into a hull.
    at: 1,
    spine: CRANE_SPINE,
    halfWidth: [0.026, 0.04, 0.062, 0.115, 0.28, 0.5, 0.66, 0.44, 0.2, 0.085, 0.05, 0.032, 0.012],
    fold: 0.28,
    band: 0,
    accent: 1,
    rotX: 0.42,
    rotY: -0.68,
  },
];

interface Rig {
  /** crease x, crease y and half width per station */
  stations: Float32Array;
  /** cross section V angle, crease banding, beak accent, and the pose */
  fold: number;
  band: number;
  accent: number;
  rotX: number;
  rotY: number;
}

/** Interpolates every station and the pose into the rig for a timeline point. */
function sampleRig(t: number, rig: Rig) {
  let k = 0;
  while (k < KEYFRAMES.length - 2 && t > KEYFRAMES[k + 1].at) k += 1;
  const from = KEYFRAMES[k];
  const to = KEYFRAMES[k + 1];
  const u = smoother(clamp01((t - from.at) / (to.at - from.at)));
  const { stations } = rig;

  for (let i = 0; i < STATIONS; i += 1) {
    const o = i * 3;
    const a = from.spine[i];
    const b = to.spine[i];
    stations[o] = a[0] + (b[0] - a[0]) * u;
    stations[o + 1] = a[1] + (b[1] - a[1]) * u;
    stations[o + 2] = from.halfWidth[i] + (to.halfWidth[i] - from.halfWidth[i]) * u;
  }

  rig.fold = from.fold + (to.fold - from.fold) * u;
  rig.band = from.band + (to.band - from.band) * u;
  rig.accent = from.accent + (to.accent - from.accent) * u;
  rig.rotX = from.rotX + (to.rotX - from.rotX) * u;
  rig.rotY = from.rotY + (to.rotY - from.rotY) * u;
}

const COL_PAPER = new THREE.Color('#fffdf7');
/** One step down the brand ramp, used only to paint the creases on flat poses. */
const COL_BAND = new THREE.Color(PALETTE.paper);
const COL_ACCENT = new THREE.Color(PALETTE.vermilion);

interface SheetProps {
  progress: React.MutableRefObject<number>;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

function FoldSheet({ progress, geometry, material }: SheetProps) {
  const group = useRef<THREE.Group>(null);
  const rig = useMemo<Rig>(
    () => ({
      stations: new Float32Array(STATIONS * 3),
      fold: 0,
      band: 1,
      accent: 0,
      rotX: 1,
      rotY: 0,
    }),
    [],
  );

  const writeSheet = useMemo(
    () => (t: number) => {
      sampleRig(t, rig);

      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      const color = geometry.getAttribute('color') as THREE.BufferAttribute;
      const colors = color.array as Float32Array;

      const { stations } = rig;
      const lift = Math.sin(rig.fold);
      const reach = Math.cos(rig.fold);

      let v = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;

      /** Writes one triangle, taking the bounding box as it goes. */
      const tri = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
      ) => {
        array[v * 3] = ax;
        array[v * 3 + 1] = ay;
        array[v * 3 + 2] = az;
        array[v * 3 + 3] = bx;
        array[v * 3 + 4] = by;
        array[v * 3 + 5] = bz;
        array[v * 3 + 6] = cx;
        array[v * 3 + 7] = cy;
        array[v * 3 + 8] = cz;

        if (ax < minX) minX = ax;
        if (bx < minX) minX = bx;
        if (cx < minX) minX = cx;
        if (ax > maxX) maxX = ax;
        if (bx > maxX) maxX = bx;
        if (cx > maxX) maxX = cx;
        if (ay < minY) minY = ay;
        if (by < minY) minY = by;
        if (cy < minY) minY = cy;
        if (ay > maxY) maxY = ay;
        if (by > maxY) maxY = by;
        if (cy > maxY) maxY = cy;
        if (az < minZ) minZ = az;
        if (bz < minZ) minZ = bz;
        if (cz < minZ) minZ = cz;
        if (az > maxZ) maxZ = az;
        if (bz > maxZ) maxZ = bz;
        if (cz > maxZ) maxZ = cz;

        v += 3;
      };

      for (let panel = 0; panel < PANELS; panel += 1) {
        const o = panel * 3;
        const ax = stations[o];
        const ay = stations[o + 1];
        const aw = stations[o + 2];
        const bx = stations[o + 3];
        const by = stations[o + 4];
        const bw = stations[o + 5];

        const alift = aw * lift;
        const blift = bw * lift;
        const aReach = aw * reach;
        const bReach = bw * reach;

        // left half, then right half; both fold up out of the spine plane
        tri(ax, ay + alift, aReach, ax, ay, 0, bx, by, 0);
        tri(ax, ay + alift, aReach, bx, by, 0, bx, by + blift, bReach);
        tri(ax, ay + alift, -aReach, bx, by, 0, ax, ay, 0);
        tri(ax, ay + alift, -aReach, bx, by + blift, -bReach, bx, by, 0);

        // one value per panel, so creases read as crisp lines rather than
        // gradients bleeding across the fold
        const start = v - TRIS_PER_PANEL * 3;
        const mix = CREASE_PATTERN[panel] * rig.band;
        const accent = panel === PANELS - 1 ? rig.accent : 0;
        const r = COL_PAPER.r + (COL_BAND.r - COL_PAPER.r) * mix;
        const g = COL_PAPER.g + (COL_BAND.g - COL_PAPER.g) * mix;
        const b = COL_PAPER.b + (COL_BAND.b - COL_PAPER.b) * mix;
        for (let i = 0; i < TRIS_PER_PANEL * 3; i += 1) {
          const w = start + i;
          colors[w * 3] = r + (COL_ACCENT.r - r) * accent;
          colors[w * 3 + 1] = g + (COL_ACCENT.g - g) * accent;
          colors[w * 3 + 2] = b + (COL_ACCENT.b - b) * accent;
        }
      }

      position.needsUpdate = true;
      color.needsUpdate = true;
      geometry.computeVertexNormals();
      (geometry.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;

      return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      };
    },
    [geometry, rig],
  );

  // Start flat before the first frame so nothing flashes half folded.
  writeSheet(0);

  useFrame(() => {
    const centre = writeSheet(clamp01(progress.current));
    if (!group.current) return;
    // Keep the pose centred however far the sheet collapses, and let the pose
    // itself carry the camera round from the opening square to the hero angle.
    group.current.position.set(-centre.x, -centre.y, -centre.z);
    group.current.rotation.set(rig.rotX, rig.rotY, 0);
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

export default function FoldSequenceScene({
  progress,
}: {
  /** written by the host from the ScrollTrigger; read once per frame */
  progress: React.MutableRefObject<number>;
}) {
  const small = useIsSmallScreen();
  const bump = useSharedPaperTexture(true);

  const geometry = useDisposable(() => {
    const geo = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(VERTEX_COUNT * 3), 3);
    position.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', position);

    const colors = new THREE.BufferAttribute(new Float32Array(VERTEX_COUNT * 3), 3);
    colors.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < VERTEX_COUNT; i += 1) {
      colors.setXYZ(i, COL_PAPER.r, COL_PAPER.g, COL_PAPER.b);
    }
    geo.setAttribute('color', colors);

    geo.computeVertexNormals();
    (geo.getAttribute('normal') as THREE.BufferAttribute).setUsage(
      THREE.DynamicDrawUsage,
    );
    return geo;
  }, (g) => g.dispose(), []);

  const material = useDisposable(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#fffdf7',
      vertexColors: true,
      // One normal per facet, taken in the shader. This is the whole reason
      // the sheet reads as folded paper instead of as folded card.
      flatShading: true,
      roughness: 0.93,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    if (bump) {
      mat.bumpMap = bump;
      mat.bumpScale = 0.008;
    }
    return mat;
  }, (m) => m.dispose(), [bump]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.45, 3.55], fov: 32 }}
      gl={{ alpha: true, antialias: !small, powerPreference: 'high-performance' }}
    >
      {/* A hard key against a soft fill. Facets only read as folded when they
          fall into visibly different values, so the ambient stays low. */}
      <ambientLight intensity={0.28} />
      <hemisphereLight args={[PALETTE.paperLight, PALETTE.kraft, 0.42]} />
      <directionalLight position={[2.6, 3.4, 2.4]} intensity={2.6} color={PALETTE.paperLight} />
      <directionalLight position={[-2.8, 0.6, -2.2]} intensity={0.38} color={PALETTE.paper} />
      <directionalLight position={[0, -2.4, 1.2]} intensity={0.2} color={PALETTE.kraft} />
      <FoldSheet progress={progress} geometry={geometry} material={material} />
      {!small && (
        <ContactShadows
          position={[0, -1.05, 0]}
          opacity={0.24}
          scale={5}
          blur={3}
          far={2.6}
          resolution={512}
          color="#4a3c28"
        />
      )}
    </Canvas>
  );
}