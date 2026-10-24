import * as THREE from 'three';

/**
 * Every product model, built procedurally. Same rules as the crane: flat
 * shaded, paper-coloured, no files, no network. `detail` scales the geometry
 * cost down for small screens so a mid-range Android keeps its frame rate.
 */

type Tri = number[];

function pushTri(out: Tri, a: number[], b: number[], c: number[]) {
  out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
}

function pushQuad(out: Tri, a: number[], b: number[], c: number[], d: number[]) {
  pushTri(out, a, b, c);
  pushTri(out, a, c, d);
}

function toGeometry(positions: Tri) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Rotate a flat position array around Y, then offset it. */
function transformTri(
  source: Tri,
  rotationY: number,
  offset: [number, number, number],
  scale = 1,
): Tri {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const out: Tri = [];
  for (let i = 0; i < source.length; i += 3) {
    const x = source[i] * scale;
    const y = source[i + 1] * scale;
    const z = source[i + 2] * scale;
    out.push(
      x * cos + z * sin + offset[0],
      y + offset[1],
      -x * sin + z * cos + offset[2],
    );
  }
  return out;
}

/* ---------------------------------------------------------------- plate -- */

/**
 * A lathe profile for a pressed plate: a shallow centre, a rising wall and a
 * rolled rim that folds back on itself. Tracing out and back gives a shell
 * rather than a solid disc.
 */
export function createPlateGeometry(detail: 'low' | 'high' = 'high') {
  const profile = [
    [0.0, 0.0],
    [0.14, 0.004],
    [0.3, 0.014],
    [0.42, 0.038],
    [0.49, 0.074],
    [0.525, 0.101],
    [0.548, 0.104],
    [0.553, 0.09],
    [0.535, 0.072],
    [0.505, 0.077],
    [0.47, 0.062],
    [0.41, 0.03],
    [0.29, 0.009],
    [0.13, 0.0],
    [0.0, -0.006],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const segments = detail === 'low' ? 24 : 44;
  const geometry = new THREE.LatheGeometry(profile, segments);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/* ------------------------------------------------------------------ cup -- */

/** An 8oz cup shell: up the inside, over a rolled rim, back down the outside. */
export function createCupGeometry(detail: 'low' | 'high' = 'high') {
  const profile = [
    [0.0, 0.008],
    [0.22, 0.01],
    [0.245, 0.06],
    [0.29, 0.34],
    [0.325, 0.62],
    [0.34, 0.74],
    [0.352, 0.762],
    [0.368, 0.75],
    [0.362, 0.72],
    [0.35, 0.6],
    [0.315, 0.34],
    [0.27, 0.055],
    [0.245, 0.0],
    [0.0, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const segments = detail === 'low' ? 20 : 40;
  const geometry = new THREE.LatheGeometry(profile, segments);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/* ---------------------------------------------------------------- spoon -- */

/** The spoon outline is drawn once as a 2D shape, then extruded thin. */
export function createSpoonGeometry(detail: 'low' | 'high' = 'high') {
  const shape = new THREE.Shape();
  shape.moveTo(-0.028, 0);
  shape.lineTo(0.028, 0);
  shape.bezierCurveTo(0.031, 0.1, 0.035, 0.16, 0.042, 0.195);
  shape.bezierCurveTo(0.098, 0.208, 0.116, 0.3, 0.076, 0.336);
  shape.bezierCurveTo(0.03, 0.368, -0.03, 0.368, -0.076, 0.336);
  shape.bezierCurveTo(-0.116, 0.3, -0.098, 0.208, -0.042, 0.195);
  shape.bezierCurveTo(-0.035, 0.16, -0.031, 0.1, -0.028, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelOffset: 0,
    bevelSegments: detail === 'low' ? 1 : 2,
    curveSegments: detail === 'low' ? 6 : 14,
    steps: 1,
  });
  geometry.center();
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/* ------------------------------------------------------------------ box -- */

/**
 * An origami gift box: an open tray plus a blintz lid whose four flaps meet
 * in the middle. Each flap is split along a raised crease so the flat shading
 * catches four distinct tones instead of one.
 */
export function createBoxGeometry(detail: 'low' | 'high' = 'high') {
  const half = 0.6;
  const height = 0.42;
  const splay = 0.05;
  const lip = 0.035;
  const out: Tri = [];

  const b = half;
  const t = half + splay;
  const y0 = -height / 2;
  const y1 = height / 2;

  // tray floor, facing down
  pushQuad(out, [-b, y0, b], [b, y0, b], [b, y0, -b], [-b, y0, -b]);

  // four walls, leaning out
  pushQuad(out, [-b, y0, b], [b, y0, b], [t, y1, t], [-t, y1, t]);
  pushQuad(out, [b, y0, -b], [-b, y0, -b], [-t, y1, -t], [t, y1, -t]);
  pushQuad(out, [b, y0, b], [b, y0, -b], [t, y1, -t], [t, y1, t]);
  pushQuad(out, [-b, y0, -b], [-b, y0, b], [-t, y1, t], [-t, y1, -t]);

  // inner lip, so the tray reads as a box and not a funnel
  const i = t - 0.02;
  pushQuad(out, [-i, y1 - lip, i], [i, y1 - lip, i], [t, y1, t], [-t, y1, t]);
  pushQuad(out, [i, y1 - lip, -i], [-i, y1 - lip, -i], [-t, y1, -t], [t, y1, -t]);
  pushQuad(out, [i, y1 - lip, i], [i, y1 - lip, -i], [t, y1, -t], [t, y1, t]);
  pushQuad(out, [-i, y1 - lip, -i], [-i, y1 - lip, i], [-t, y1, t], [-t, y1, -t]);

  // blintz lid: four flaps folded in to a raised centre point
  const centre: number[] = [0, y1 + 0.1, 0];
  const flap: [number, number, number][][] = [
    [[-t, y1, t], [t, y1, t]],
    [[t, y1, -t], [-t, y1, -t]],
    [[t, y1, t], [t, y1, -t]],
    [[-t, y1, -t], [-t, y1, t]],
  ];
  flap.forEach(([a, c]) => {
    // pull the outer corners in so neighbouring flaps overlap, blintz style
    const mid: number[] = [(a[0] + c[0]) / 2, y1 + 0.018, (a[2] + c[2]) / 2];
    if (detail === 'low') {
      pushTri(out, a, mid, centre);
      pushTri(out, mid, c, centre);
      return;
    }
    // high detail adds the diagonal crease each flap carries in real paper
    const inner = 0.62;
    const m1: number[] = [
      a[0] + (mid[0] - a[0]) * inner,
      y1 + 0.032,
      a[2] + (mid[2] - a[2]) * inner,
    ];
    const m2: number[] = [
      c[0] + (mid[0] - c[0]) * inner,
      y1 + 0.032,
      c[2] + (mid[2] - c[2]) * inner,
    ];
    pushTri(out, a, m1, centre);
    pushTri(out, m1, m2, centre);
    pushTri(out, m1, c, m2);
  });

  return toGeometry(out);
}

/* --------------------------------------------------------------- flower -- */

/** One petal: a strip with a raised crease down the centre line. */
function petalTriangles(): Tri {
  const centre: number[][] = [
    [0, 0, 0],
    [0, 0.05, 0.13],
    [0, 0.09, 0.26],
    [0, 0.1, 0.36],
  ];
  const left: number[][] = [
    [-0.034, 0, 0.0],
    [-0.1, 0.03, 0.15],
    [-0.072, 0.06, 0.3],
    [-0.018, 0.08, 0.36],
  ];
  const right: number[][] = left.map(([x, y, z]) => [-x, y, z]);

  const out: Tri = [];
  for (let i = 0; i < centre.length - 1; i += 1) {
    pushQuad(out, centre[i], left[i], left[i + 1], centre[i + 1]);
    pushQuad(out, centre[i], centre[i + 1], right[i + 1], right[i]);
  }
  return out;
}

/**
 * Three rings of petals merged into three meshes, so a full bloom costs three
 * draw calls rather than twenty-four.
 */
export function createFlowerGeometry(detail: 'low' | 'high' = 'high') {
  const petal = petalTriangles();
  const rings = detail === 'low'
    ? [
        { count: 6, scale: 0.78, y: 0.0, tilt: 0.34, offset: 0 },
        { count: 6, scale: 0.58, y: 0.055, tilt: 0.16, offset: 0.5 },
      ]
    : [
        { count: 8, scale: 0.86, y: 0.0, tilt: 0.38, offset: 0 },
        { count: 8, scale: 0.64, y: 0.06, tilt: 0.18, offset: 0.35 },
        { count: 6, scale: 0.42, y: 0.115, tilt: 0.04, offset: 0.2 },
      ];

  return rings.map((ring) => {
    const positions: Tri = [];
    for (let i = 0; i < ring.count; i += 1) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.offset;
      // tilt each petal outward by sliding it along Y as it radiates
      const scaled = transformTri(petal, angle, [0, ring.y, 0], ring.scale);
      for (let v = 1; v < scaled.length; v += 3) {
        scaled[v] += Math.abs(scaled[v + 1]) * ring.tilt;
      }
      positions.push(...scaled);
    }
    return toGeometry(positions);
  });
}

/** A folded card stem under the bloom, so the flower is not floating. */
export function createStemGeometry() {
  const out: Tri = [];
  const h = 0.62;
  const w = 0.018;
  pushQuad(out, [-w, -h, 0], [w, -h, 0], [w, 0, 0], [-w, 0, 0]);
  return toGeometry(out);
}

/** The small moss-green dome in the middle of the bloom. */
export function createFlowerCentre(detail: 'low' | 'high' = 'high') {
  const profile = [
    [0.0, 0.075],
    [0.035, 0.06],
    [0.062, 0.028],
    [0.07, 0.0],
    [0.0, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, detail === 'low' ? 8 : 16);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/* ---------------------------------------------------------------- sheet -- */

/**
 * A stack of loose sheets with hand-set offsets, in three tones. Merged per
 * tone, so the whole pack is three draw calls.
 */
export function createSheetStack(detail: 'low' | 'high' = 'high') {
  const count = detail === 'low' ? 6 : 10;
  const tones: THREE.BufferGeometry[] = [];
  const thickness = 0.016;
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };

  const perTone = Math.ceil(count / 3);
  for (let tone = 0; tone < 3; tone += 1) {
    const positions: Tri = [];
    for (let i = 0; i < perTone; i += 1) {
      const index = tone * perTone + i;
      if (index >= count) break;
      const s = 0.86 - index * 0.008;
      const dx = (rand() - 0.5) * 0.06;
      const dz = (rand() - 0.5) * 0.06;
      const dy = index * thickness;
      const ry = (rand() - 0.5) * 0.14;
      const h = s / 2;
      const sheet: Tri = [];
      pushQuad(sheet, [-h, 0, h], [h, 0, h], [h, 0, -h], [-h, 0, -h]);
      pushQuad(sheet, [-h, thickness, h], [h, thickness, h], [h, thickness, -h], [-h, thickness, -h]);
      pushQuad(sheet, [-h, 0, -h], [h, 0, -h], [h, thickness, -h], [-h, thickness, -h]);
      pushQuad(sheet, [h, 0, h], [-h, 0, h], [-h, thickness, h], [h, thickness, h]);
      pushQuad(sheet, [-h, 0, -h], [-h, 0, h], [-h, thickness, h], [-h, thickness, -h]);
      pushQuad(sheet, [h, 0, h], [h, 0, -h], [h, thickness, -h], [h, thickness, h]);
      positions.push(...transformTri(sheet, ry, [dx, dy, dz]));
    }
    if (positions.length) tones.push(toGeometry(positions));
  }
  return tones;
}