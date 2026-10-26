'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { staticSiteContent, type SiteContent } from '@/lib/site-content';

/**
 * Carries the content snapshot (built server-side by src/lib/content.ts)
 * into the client components. One value per render pass, passed as a plain
 * serializable prop — no fetching happens in the browser.
 *
 * The default context value is the /data snapshot, so a component rendered
 * outside the provider behaves exactly like the pre-Stage-3 site (and the
 * no-database fallback path is the same code path).
 */
const SiteContentContext = createContext<SiteContent>(staticSiteContent);

export function SiteContentProvider({
  content,
  children,
}: {
  content: SiteContent;
  children: ReactNode;
}) {
  return (
    <SiteContentContext.Provider value={content}>
      {children}
    </SiteContentContext.Provider>
  );
}

/** The whole snapshot: structured copy for components to render from. */
export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext);
}

/**
 * The raw value of one admin content key ({total} already interpolated),
 * or undefined when the key was never seeded — Editable uses this as the
 * base for every editable node on every visit.
 */
export function useContentField(k: string): string | undefined {
  return useContext(SiteContentContext).values[k];
}
