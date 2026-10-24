'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Group } from 'three';
import type { Material } from 'three';
import type { CraneGeometryParts } from './crane';

/**
 * The crane as JSX. Handles are handed up so the hero can drive the wings and
 * the root rotation per frame without re-rendering React sixty times a second.
 */
export interface CraneHandles {
  root: Group | null;
  leftWing: Group | null;
  rightWing: Group | null;
}

export const CraneModel = forwardRef<
  CraneHandles,
  {
    geometry: CraneGeometryParts;
    paperMaterial: Material;
    accentMaterial: Material;
  }
>(function CraneModel({ geometry, paperMaterial, accentMaterial }, ref) {
  const root = useRef<Group>(null);
  const leftWing = useRef<Group>(null);
  const rightWing = useRef<Group>(null);

  useImperativeHandle(ref, () => ({
    get root() {
      return root.current;
    },
    get leftWing() {
      return leftWing.current;
    },
    get rightWing() {
      return rightWing.current;
    },
  }));

  return (
    <group ref={root}>
      <mesh geometry={geometry.paper.body} material={paperMaterial} />
      <mesh geometry={geometry.paper.neck} material={paperMaterial} />
      <mesh geometry={geometry.accent.head} material={accentMaterial} />
      <mesh geometry={geometry.accent.tail} material={accentMaterial} />

      <group ref={leftWing}>
        <mesh geometry={geometry.paper.wingLeft} material={paperMaterial} />
        <mesh geometry={geometry.accent.wingLeft} material={accentMaterial} />
      </group>
      <group ref={rightWing}>
        <mesh geometry={geometry.paper.wingRight} material={paperMaterial} />
        <mesh geometry={geometry.accent.wingRight} material={accentMaterial} />
      </group>
    </group>
  );
});