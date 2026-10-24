'use client';

import dynamic from 'next/dynamic';
import { useShouldMount3D } from '@/lib/use-env';
import { CraneArt } from './fallbacks';

/**
 * The hero canvas is only ever mounted in the browser, and only once WebGL
 * has been confirmed. Everything else gets the drawn crane, which is the same
 * artwork used across the product cards, so nothing looks broken.
 */
const CraneHeroScene = dynamic(() => import('./CraneHeroScene'), {
  ssr: false,
  loading: () => <FallbackCrane className="h-full w-full" />,
});

function FallbackCrane({ className }: { className?: string }) {
  return <CraneArt className={className} title="A folded paper origami crane" />;
}

export function CraneHero({ className = '' }: { className?: string }) {
  const { can3D } = useShouldMount3D();

  return (
    <div
      className={`relative ${className}`.trim()}
      aria-hidden={can3D ? 'true' : undefined}
      role={can3D ? undefined : 'img'}
      aria-label={can3D ? undefined : 'A folded paper origami crane, floating'}
    >
      {can3D ? <CraneHeroScene /> : <FallbackCrane className="h-full w-full" />}
    </div>
  );
}