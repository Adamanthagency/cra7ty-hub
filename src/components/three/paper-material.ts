'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

/** Brand hexes mirrored from globals.css so three.js gets plain numbers. */
export const PALETTE = {
  paper: '#f4efe6',
  paperLight: '#fbf7f0',
  kraft: '#d9c7a7',
  vermilion: '#e5391f',
  moss: '#3e5641',
  ink: '#16130f',
} as const;

/**
 * A paper bump map drawn on a canvas at runtime: fine value noise plus a
 * scatter of short fibres. Generated once and shared by every material, so
 * the site never ships an image file and never requests one.
 */
export function createPaperTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // deterministic noise so the paper looks the same on every load
  let seed = 0x2f6e2b1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = 128 + (rand() - 0.5) * 44;
    data[i] = n;
    data[i + 1] = n;
    data[i + 2] = n;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  // fibres: the part of paper you feel rather than see
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < size * 1.8; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const length = 4 + rand() * 20;
    const angle = rand() * Math.PI;
    ctx.strokeStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    ctx.lineWidth = rand() * 1.2 + 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.needsUpdate = true;
  return texture;
}

/**
 * One shared bump texture for the whole app. Created lazily on first 3D mount
 * and released when the last consumer unmounts.
 */
let sharedTexture: THREE.CanvasTexture | null = null;
let sharedUsers = 0;

export function useSharedPaperTexture(enabled: boolean) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    if (!sharedTexture) sharedTexture = createPaperTexture();
    sharedUsers += 1;
    setTexture(sharedTexture);
    return () => {
      sharedUsers = Math.max(0, sharedUsers - 1);
      if (sharedUsers === 0 && sharedTexture) {
        sharedTexture.dispose();
        sharedTexture = null;
      }
    };
  }, [enabled]);

  return texture;
}

export interface PaperMaterialOptions {
  color?: string;
  roughness?: number;
  metalness?: number;
  flatShading?: boolean;
  bumpScale?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
}

/**
 * MeshStandardMaterial set up to read as paper: very rough, no metal, flat
 * shaded so the facets catch light differently, and bumped with the generated
 * fibre texture. Double sided, because paper really is thin.
 */
export function createPaperMaterial(
  bumpMap: THREE.Texture | null,
  options: PaperMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const {
    color = PALETTE.paperLight,
    roughness = 0.94,
    metalness = 0,
    flatShading = true,
    bumpScale = 0.012,
    side = THREE.DoubleSide,
    transparent = false,
    opacity = 1,
  } = options;

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    flatShading,
    side,
    transparent,
    opacity,
  });

  if (bumpMap) {
    material.bumpMap = bumpMap;
    material.bumpScale = bumpScale;
  }

  return material;
}

/**
 * Builds a resource once and disposes it when the component goes away.
 * Everything here is created on the client only, so dispose on cleanup is
 * safe: three.js rebuilds GPU state automatically if the object is used again.
 */
export function useDisposable<T>(
  factory: () => T,
  dispose: (value: T) => void,
  deps: unknown[],
): T {
  const value = useMemo(factory, deps); // eslint-disable-line react-hooks/exhaustive-deps
  // Held in a ref so an inline dispose callback cannot retrigger the effect on
  // every render, which would dispose a live resource mid-session.
  const disposeRef = useRef(dispose);
  disposeRef.current = dispose;
  useEffect(() => {
    const run = disposeRef.current;
    return () => run(value);
  }, [value]);
  return value;
}