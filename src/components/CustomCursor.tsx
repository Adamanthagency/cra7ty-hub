'use client';

import { useEffect, useRef, useState } from 'react';

const INTERACTIVE =
  'a, button, [role="button"], input, textarea, select, summary, label, [data-cursor="grow"]';

/**
 * A small vermilion dot that grows over anything clickable. Desktop pointers
 * only: on a touch screen there is no cursor to replace, and under
 * prefers-reduced-motion the easing loop is exactly the kind of movement
 * that should not run. Both cases leave the native cursor alone.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pointer = window.matchMedia('(pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(pointer.matches && !reduced.matches);

    update();
    pointer.addEventListener('change', update);
    reduced.addEventListener('change', update);

    return () => {
      pointer.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove('cursor-custom');
      return;
    }
    document.documentElement.classList.add('cursor-custom');

    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const eased = { ...pointer };
    let scale = 1;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const onLeave = () => {
      if (dot.current) dot.current.style.opacity = '0';
    };
    const onEnter = () => {
      if (dot.current) dot.current.style.opacity = '1';
    };

    const loop = () => {
      eased.x += (pointer.x - eased.x) * 0.2;
      eased.y += (pointer.y - eased.y) * 0.2;

      const target = document.elementFromPoint(pointer.x, pointer.y);
      const over = target instanceof Element && target.closest(INTERACTIVE) !== null;
      scale += ((over ? 3.1 : 1) - scale) * 0.15;

      if (dot.current) {
        dot.current.style.transform = `translate3d(${eased.x}px, ${eased.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      }
      frame = window.requestAnimationFrame(loop);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerenter', onEnter);
    frame = window.requestAnimationFrame(loop);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerenter', onEnter);
      window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove('cursor-custom');
    };
  }, [enabled]);

  if (!enabled) return null;

  return <div ref={dot} className="cursor-dot" aria-hidden="true" />;
}