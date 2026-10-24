'use client';

import type { BufferGeometry, Material, Texture } from 'three';
import type { ModelKey } from '@/lib/types';
import { PALETTE, createPaperMaterial, useDisposable } from './paper-material';
import {
  createBoxGeometry,
  createCupGeometry,
  createFlowerCentre,
  createFlowerGeometry,
  createPlateGeometry,
  createSheetStack,
  createSpoonGeometry,
  createStemGeometry,
} from './product-models';
import { createCraneGeometry, disposeCraneGeometry, type CraneGeometryParts } from './crane';
import { CraneModel } from './CraneModel';

type Vec3 = [number, number, number];

interface Placement {
  position: Vec3;
  rotation: Vec3;
  scale: number;
}

/** Where each model sits so it reads well from the single viewer camera. */
const placements: Record<ModelKey, Placement> = {
  crane: { position: [0, 0.02, 0], rotation: [0.14, 0.55, 0], scale: 0.95 },
  plate: { position: [0, 0, 0], rotation: [-0.42, 0.35, 0], scale: 1.2 },
  spoon: { position: [0, 0, 0], rotation: [0.2, -0.55, -0.4], scale: 2.2 },
  box: { position: [0, -0.05, 0], rotation: [0.1, -0.62, 0], scale: 1.3 },
  flower: { position: [0, 0.14, 0], rotation: [-0.6, 0.2, 0], scale: 1.15 },
  cup: { position: [0, -0.42, 0], rotation: [0, 0.4, 0], scale: 1.5 },
  sheet: { position: [0, -0.28, 0], rotation: [-0.5, 0.3, 0], scale: 1.25 },
};

interface Entry {
  geometry: BufferGeometry;
  material: Material;
}

interface Bundle {
  /** set only for the crane, which needs its wings grouped to be posed */
  crane: CraneGeometryParts | null;
  entries: Entry[];
  /** paper, kraft, vermilion, moss — in that order */
  materials: Material[];
  dispose: () => void;
}

/**
 * Builds the active model only. Swapping the key rebuilds the bundle and the
 * previous one is disposed, so the viewer never piles up geometry as a reader
 * walks across the categories.
 */
function useProductBundle(
  model: ModelKey,
  detail: 'low' | 'high',
  bump: Texture | null,
): Bundle {
  const paper = useDisposable(
    () => createPaperMaterial(bump, { color: PALETTE.paperLight, bumpScale: 0.01 }),
    (m) => m.dispose(),
    [bump],
  );
  const kraft = useDisposable(
    () => createPaperMaterial(bump, { color: PALETTE.kraft, bumpScale: 0.01 }),
    (m) => m.dispose(),
    [bump],
  );
  const vermilion = useDisposable(
    () => createPaperMaterial(bump, { color: PALETTE.vermilion, bumpScale: 0.01 }),
    (m) => m.dispose(),
    [bump],
  );
  const moss = useDisposable(
    () => createPaperMaterial(bump, { color: PALETTE.moss, bumpScale: 0.01 }),
    (m) => m.dispose(),
    [bump],
  );

  return useDisposable<Bundle>(
    () => {
      const entries: Entry[] = [];
      let crane: CraneGeometryParts | null = null;
      let disposeGeometry: () => void = () => {};

      switch (model) {
        case 'crane': {
          crane = createCraneGeometry();
          disposeGeometry = () => disposeCraneGeometry(crane!);
          break;
        }
        case 'plate':
          entries.push({ geometry: createPlateGeometry(detail), material: kraft });
          break;
        case 'cup':
          entries.push({ geometry: createCupGeometry(detail), material: paper });
          break;
        case 'spoon':
          entries.push({ geometry: createSpoonGeometry(detail), material: kraft });
          break;
        case 'box':
          entries.push({ geometry: createBoxGeometry(detail), material: kraft });
          break;
        case 'flower': {
          const rings = createFlowerGeometry(detail);
          const centre = createFlowerCentre(detail);
          const stem = createStemGeometry();
          entries.push({ geometry: rings[0], material: kraft });
          if (rings[1]) entries.push({ geometry: rings[1], material: paper });
          if (rings[2]) entries.push({ geometry: rings[2], material: vermilion });
          entries.push({ geometry: centre, material: moss });
          entries.push({ geometry: stem, material: kraft });
          disposeGeometry = () => {
            rings.forEach((g) => g.dispose());
            centre.dispose();
            stem.dispose();
          };
          break;
        }
        case 'sheet': {
          const stack = createSheetStack(detail);
          const tones = [kraft, paper, vermilion];
          stack.forEach((geometry, i) =>
            entries.push({ geometry, material: tones[i % tones.length] }),
          );
          disposeGeometry = () => stack.forEach((g) => g.dispose());
          break;
        }
      }

      return {
        crane,
        entries,
        materials: [paper, kraft, vermilion, moss],
        dispose: () => {
          disposeGeometry();
          if (!crane) entries.forEach((e) => e.geometry.dispose());
        },
      };
    },
    (bundle) => bundle.dispose(),
    [model, detail, paper, kraft, vermilion, moss],
  );
}

export function ProductModel({
  model,
  detail,
  bump,
}: {
  model: ModelKey;
  detail: 'low' | 'high';
  bump: Texture | null;
}) {
  const bundle = useProductBundle(model, detail, bump);
  const place = placements[model] ?? placements.plate;
  const [paperMaterial, , vermilionMaterial] = bundle.materials;

  return (
    <group position={place.position} rotation={place.rotation} scale={place.scale}>
      {bundle.crane ? (
        <CraneModel
          geometry={bundle.crane}
          paperMaterial={paperMaterial}
          accentMaterial={vermilionMaterial}
        />
      ) : (
        bundle.entries.map((entry, i) => (
          <mesh key={i} geometry={entry.geometry} material={entry.material} />
        ))
      )}
    </group>
  );
}