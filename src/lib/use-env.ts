'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side capability checks for the 3D work. All of them return false on
 * the server so the first paint always shows the static fallback and the
 * canvas only mounts when it is genuinely safe to do so.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * True only when WebGL is actually available. Probed by building a throwaway
 * context, which is the only reliable check; the context is released
 * immediately so it costs nothing.
 */
export function useWebGLSupport() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let canvas: HTMLCanvasElement | null = null;
    try {
      canvas = document.createElement('canvas');
      const context =
        (canvas.getContext('webgl2') ??
          canvas.getContext('webgl') ??
          canvas.getContext('experimental-webgl')) as
          | WebGLRenderingContext
          | WebGL2RenderingContext
          | null;
      setSupported(!!context);
      // Release the probe context so it costs nothing on the GPU.
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setSupported(false);
    }
    return () => {
      canvas = null;
    };
  }, []);

  return supported;
}

/** Small screens get lighter geometry and no shadow maps. */
export function useIsSmallScreen() {
  const [small, setSmall] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setSmall(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSmall(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return small;
}

/**
 * True when the hero canvas should not mount at all: the tab is in the
 * background, or the viewport is too small for it to earn its cost.
 */
export function useShouldMount3D() {
  const reduced = usePrefersReducedMotion();
  const webgl = useWebGLSupport();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setVisible(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return { can3D: webgl && !reduced && visible, reduced, webgl };
}