import * as THREE from 'three';

/**
 * The origami crane, built from scratch.
 *
 * Every facet is a triangle pushed straight into a position array, so the
 * whole bird is about forty faces of flat-shaded paper. Nothing is loaded
 * from disk and nothing is imported, which is why the site works offline and
 * why the hero stays smooth on a mid-range phone.
 *
 * Orientation: the bird faces +X, up is +Y, the wings spread along Z.
 *
 * Vermilion is used the way the brief asks for it: a narrow band across the
 * wingtips and a short beak. Everything else is paper.
 */

export type CranePartKey =
  | 'body'
  | 'head'
  | 'neck'
  | 'tail'
  | 'wingLeft'
  | 'wingRight';

type Triangles = number[];

function pushTri(out: Triangles, a: number[], b: number[], c: number[]) {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

/**
 * A four-sided spike along an arbitrary axis: a ring of four points around
 * `base`, tapering to `apex`. Used for the neck, the beak and the tail, which
 * are all the same shape at different angles.
 */
function pushSpike(
  out: Triangles,
  base: THREE.Vector3,
  apex: THREE.Vector3,
  halfWidth: number,
) {
  const axis = apex.clone().sub(base).normalize();
  const reference =
    Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(axis, reference).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();

  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i += 1) {
    const theta = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ring.push(
      base
        .clone()
        .addScaledVector(side, Math.cos(theta) * halfWidth)
        .addScaledVector(up, Math.sin(theta) * halfWidth),
    );
  }

  for (let i = 0; i < 4; i += 1) {
    pushTri(
      out,
      [apex.x, apex.y, apex.z],
      [ring[i].x, ring[i].y, ring[i].z],
      [ring[(i + 1) % 4].x, ring[(i + 1) % 4].y, ring[(i + 1) % 4].z],
    );
  }
}

/** The body is two paper flaps meeting at a spine, so it is genuinely flat. */
function buildBody(): Triangles {
  const out: Triangles = [];
  const ring = [
    [0.38, 0.03, 0],
    [0.05, 0.14, 0],
    [-0.34, 0.05, 0],
    [0.0, -0.15, 0],
  ];
  const top = [0.03, 0.23, 0];
  const bottom = [0.0, -0.22, 0];

  for (let i = 0; i < 4; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    pushTri(out, top, a, b);
    pushTri(out, bottom, b, a);
  }
  return out;
}

/**
 * One wing, fanned out from a root on the spine. Two rings of points are
 * used so the vermilion can be a narrow band across the tip rather than half
 * the wing.
 */
function buildWing(side: 1 | -1): { paper: Triangles; accent: Triangles } {
  const paper: Triangles = [];
  const accent: Triangles = [];
  const z = (v: number) => v * side;

  const root = [0.03, 0.16, z(0.0)];
  // inner ring
  const a1 = [0.32, 0.19, z(0.4)];
  const a2 = [0.11, 0.25, z(0.52)];
  const a3 = [-0.18, 0.21, z(0.47)];
  // outer ring, where the accent band starts
  const b1 = [0.21, 0.25, z(0.68)];
  const b2 = [0.02, 0.3, z(0.77)];
  const b3 = [-0.13, 0.26, z(0.72)];
  const tip = [-0.02, 0.34, z(0.93)];

  pushTri(paper, root, a1, a2);
  pushTri(paper, root, a2, a3);
  pushTri(paper, root, a3, b3);
  pushTri(paper, root, b3, b2);
  pushTri(paper, root, b2, b1);
  pushTri(paper, root, b1, a1);

  // the band itself: a narrow chevron across the wingtip
  pushTri(accent, root, b3, tip);
  pushTri(accent, root, tip, b1);

  return { paper, accent };
}

export interface CraneGeometryParts {
  paper: Partial<Record<CranePartKey, THREE.BufferGeometry>>;
  accent: Partial<Record<CranePartKey, THREE.BufferGeometry>>;
}

function toGeometry(positions: Triangles) {
  const geometry = new THREE.BufferGeometry();
  // Non-indexed on purpose: computeVertexNormals then gives one normal per
  // facet, which is exactly the folded-paper look we are after.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function spike(base: [number, number, number], apex: [number, number, number], w: number) {
  const out: Triangles = [];
  pushSpike(out, new THREE.Vector3(...base), new THREE.Vector3(...apex), w);
  return out;
}

/** Builds every part of the crane. Caller disposes the result. */
export function createCraneGeometry(): CraneGeometryParts {
  const wingRight = buildWing(1);
  const wingLeft = buildWing(-1);

  const paper: CraneGeometryParts['paper'] = {
    body: toGeometry(buildBody()),
    // the long neck, all paper
    neck: toGeometry(spike([0.28, 0.02, 0], [0.76, 0.46, 0], 0.058)),
    // the tail, also paper: a crane's tail is not a red flag
    tail: toGeometry(spike([-0.3, 0.07, 0], [-0.82, 0.64, 0], 0.064)),
    wingLeft: toGeometry(wingLeft.paper),
    wingRight: toGeometry(wingRight.paper),
  };

  const accent: CraneGeometryParts['accent'] = {
    // a short beak, bent off the end of the neck
    head: toGeometry(spike([0.62, 0.33, 0], [0.9, 0.47, 0], 0.032)),
    wingLeft: toGeometry(wingLeft.accent),
    wingRight: toGeometry(wingRight.accent),
  };

  return { paper, accent };
}

/** Disposes every geometry in both maps. */
export function disposeCraneGeometry(parts: CraneGeometryParts) {
  const all = [...Object.values(parts.paper), ...Object.values(parts.accent)];
  all.forEach((geometry) => geometry?.dispose());
}