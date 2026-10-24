'use client';

import dynamic from 'next/dynamic';
import type { ModelKey } from '@/lib/types';
import { useShouldMount3D } from '@/lib/use-env';
import { ModelArt } from './fallbacks';

const ProductViewerScene = dynamic(() => import('./ProductViewerScene'), { ssr: false });

/**
 * The shop's model viewer. Swapping `model` swaps the object on screen; on a
 * device without WebGL the same model is drawn as a flat illustration so the
 * category row still says something.
 */
export function ProductViewer({
  model,
  className = '',
  label,
}: {
  model: ModelKey;
  className?: string;
  label?: string;
}) {
  const { can3D } = useShouldMount3D();

  return (
    <div className={`relative ${className}`.trim()}>
      {can3D ? (
        <>
          <ProductViewerScene model={model} />
          <p className="mono-label-xs pointer-events-none absolute bottom-0 left-0 text-ink-40">
            Drag to rotate
          </p>
        </>
      ) : (
        <ModelArt model={model} className="h-full w-full" label={label} />
      )}
    </div>
  );
}