'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSiteContent } from '@/components/site-content-provider';
import { useOrder } from '@/lib/order-store';
import { CraneMark } from '@/components/primitives/Icons';
import { pad } from '@/lib/format';
import { Editable } from '@/components/edit/Editable';
import { EditableSection } from '@/components/edit/EditableSection';
import { useEditList } from '@/lib/edit/use-edit';

/**
 * Sticky, hairline-ruled and thin. The links sit inline on desktop and become
 * a horizontally scrollable index on mobile, which keeps the editorial feel
 * instead of dropping behind a hamburger. Real routes use next/link and carry
 * the active marker; `/#anchor` links stay plain <a> so the browser owns the
 * scroll, whether it starts on the home page or another one.
 */

/** Home-page anchors like /#bulk: never marked active, always native. */
const isHomeAnchor = (href: string) => href.startsWith('/#');

/** The path a route link matches on, with query and hash stripped. */
const basePath = (href: string) => href.split('?')[0].split('#')[0];

function NavItem({
  href,
  label,
  active,
  className,
}: {
  href: string;
  label: ReactNode;
  active: boolean;
  className: string;
}) {
  const cls = `link-draw ${className}`.trim();
  const dataActive = active ? 'true' : undefined;

  if (isHomeAnchor(href)) {
    return (
      <a href={href} className={cls} data-active={dataActive}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} data-active={dataActive}>
      {label}
    </Link>
  );
}

export function SiteNav() {
  const { navLinks, site } = useSiteContent();
  const { count, open } = useOrder();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Admin nav-links override (labels AND hrefs replace the seed list).
  const linksOverride = useEditList('global.navigation.links');
  const links = linksOverride
    ? linksOverride.map((item) => ({
        label: String(item.fields.label ?? ''),
        href: String(item.fields.href ?? ''),
      }))
    : navLinks;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** Query links (/shop?category=…) never carry the marker; the Shop tab does. */
  const isActive = (href: string) => {
    if (isHomeAnchor(href) || href.includes('?')) return false;
    const base = basePath(href);
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <EditableSection id="navigation">
    <header
      className={`sticky top-0 z-50 bg-paper transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_1px_0_rgba(22,19,15,0.1)]' : ''
      }`}
    >
      <div className="mx-auto w-full max-w-[104rem] px-gutter">
        <div className="flex h-[62px] items-center justify-between gap-6">
          <Link
            href="/"
            className="group flex items-baseline gap-2"
            aria-label={`${site.name}, home`}
          >
            <CraneMark size={18} className="translate-y-[1px] text-vermilion" />
            <span className="font-display text-[1.4rem] leading-none tracking-[-0.02em]">
              {site.name}
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-7">
              {links.map((link, i) => (
                <li key={i}>
                  <NavItem
                    href={link.href}
                    label={
                      <Editable k={`global.navigation.links.items.${i}.label`}>
                        {link.label}
                      </Editable>
                    }
                    active={isActive(link.href)}
                    className="mono-label-xs text-ink-70 hover:text-ink"
                  />
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            onClick={open}
            className="group flex items-center gap-2 border border-ink-24 px-3 py-2 transition-colors duration-300 hover:border-ink"
            aria-label={`Open order drawer, ${count} ${count === 1 ? 'item' : 'items'} in order`}
          >
            <span className="mono-label-xs">
              <Editable k="global.navigation.order-label">Order</Editable>
            </span>
            <span
              className={`mono-label-xs flex h-5 min-w-[1.25rem] items-center justify-center px-1 tabular-nums transition-colors duration-300 ${
                count > 0 ? 'bg-vermilion text-paper' : 'bg-ink-06 text-ink-55'
              }`}
            >
              {pad(count)}
            </span>
          </button>
        </div>
      </div>

      {/* mobile index row: scrollable, ruled above and below */}
      <div className="hairline-t hide-scrollbar overflow-x-auto md:hidden">
        <ul className="flex w-max items-center gap-6 px-gutter py-2.5">
          {links.map((link, i) => (
            <li key={i}>
              <NavItem
                href={link.href}
                label={
                  <Editable k={`global.navigation.links.items.${i}.label`}>
                    {link.label}
                  </Editable>
                }
                active={isActive(link.href)}
                className="mono-label-xs whitespace-nowrap text-ink-70"
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="hairline-t hidden h-px w-full bg-ink-12 md:block" aria-hidden="true" />
    </header>
    </EditableSection>
  );
}
