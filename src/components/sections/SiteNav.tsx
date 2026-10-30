'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSiteContent } from '@/components/site-content-provider';
import { useOrder } from '@/lib/order-store';
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

/**
 * The nav item that owns the Order dropdown, by its stable id (the
 * admin's content_list_items.item_id — see site.ts navLinks). Its
 * children live in a second list so the admin edits them with the same
 * list editor as every other link, exactly as the footer columns do.
 * The group renders as a plain link instead whenever that list is empty.
 */
const ORDER_GROUP_ID = 'nav-order';
const ORDER_MENU_KEY = 'global.navigation.order-links';

/** Editorial caret: a hairline chevron that flips with the menu. */
function OrderChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      className={`h-2.5 w-2.5 transition-transform duration-300 ${
        open ? 'rotate-180' : ''
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

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
  const { navLinks, navOrderMenu, site } = useSiteContent();
  const { count, open } = useOrder();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Admin overrides (labels AND hrefs replace the seed lists).
  const linksOverride = useEditList('global.navigation.links');
  const orderOverride = useEditList(ORDER_MENU_KEY);
  const links = linksOverride
    ? linksOverride.map((item) => ({
        id: item.id,
        label: String(item.fields.label ?? ''),
        href: String(item.fields.href ?? ''),
      }))
    : navLinks;
  const orderMenu = orderOverride
    ? orderOverride.map((item) => ({
        label: String(item.fields.label ?? ''),
        href: String(item.fields.href ?? ''),
      }))
    : navOrderMenu;

  // Order is a group only while it has something to group.
  const isOrderGroup =
    orderMenu.length > 0 && links.some((l) => l.id === ORDER_GROUP_ID);

  const [orderOpen, setOrderOpen] = useState(false);
  // True while a mouse pointer is resting on the group. Hover already
  // opened the menu, so the trigger's click must not toggle it shut again
  // (it would close on the very click that meant to open it — and on touch
  // there is no hover at all, so the click is the only way in).
  const orderHover = useRef(false);

  const openOnHover = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    orderHover.current = true;
    setOrderOpen(true);
  };
  // Every close also hands the menu back from hover to the user, so the
  // next click on the trigger opens it again instead of doing nothing.
  const closeOrder = () => {
    orderHover.current = false;
    setOrderOpen(false);
  };
  const toggleOrder = () => {
    if (orderHover.current) return;
    setOrderOpen((v) => !v);
  };

  // A new page, a click away, or Escape always folds the menu back.
  useEffect(() => closeOrder(), [pathname]);
  useEffect(() => {
    if (!orderOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOrder();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Both rows carry the marker. On mobile the trigger sits in a
      // different <li> from the desktop group, so a contains() check
      // against that group would call this on mousedown and the click
      // that follows would toggle the menu straight back open — it would
      // then never appear to close at all.
      if (target?.closest('[data-order-menu]')) return;
      closeOrder();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [orderOpen]);

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

  /** Order lights up when any of its children is the current page. */
  const orderActive = orderMenu.some((child) => isActive(child.href));

  const orderLabel = (index: number) => (
    <Editable k={`global.navigation.links.items.${index}.label`}>
      {links[index]!.label}
    </Editable>
  );

  const orderChild = (child: { label: string; href: string }, j: number) => (
    <NavItem
      href={child.href}
      label={
        <Editable k={`${ORDER_MENU_KEY}.items.${j}.label`}>{child.label}</Editable>
      }
      active={isActive(child.href)}
      className="mono-label-xs text-ink-70 hover:text-ink"
    />
  );

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
            className="group flex items-center"
            aria-label={`${site.name}, home`}
          >
            <Image
              src="/logo.png"
              alt=""
              width={798}
              height={278}
              priority
              className="h-9 w-auto"
            />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-7">
              {links.map((link, i) =>
                isOrderGroup && link.id === ORDER_GROUP_ID ? (
                  <li
                    key={link.id}
                    data-order-menu=""
                    className="relative"
                    onPointerEnter={openOnHover}
                    onPointerLeave={(e) => {
                      if (e.pointerType !== 'mouse') return;
                      closeOrder();
                    }}
                  >
                    <button
                      type="button"
                      id="nav-order-trigger"
                      aria-haspopup="true"
                      aria-expanded={orderOpen}
                      aria-controls="nav-order-menu"
                      data-active={orderActive ? 'true' : undefined}
                      onClick={toggleOrder}
                      className="link-draw mono-label-xs inline-flex items-center gap-1.5 text-ink-70 hover:text-ink"
                    >
                      {orderLabel(i)}
                      <OrderChevron open={orderOpen} />
                    </button>

                    {orderOpen && (
                      <div
                        id="nav-order-menu"
                        className="absolute left-0 top-full z-50 pt-3"
                      >
                        <ul className="min-w-[10.5rem] border border-ink-24 bg-paper py-1.5">
                          {orderMenu.map((child, j) => (
                            <li key={j} className="px-3.5 py-1.5">
                              {orderChild(child, j)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ) : (
                  <li key={link.id}>
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
                )
              )}
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
          {links.map((link, i) =>
            isOrderGroup && link.id === ORDER_GROUP_ID ? (
              <li key={link.id} data-order-menu="">
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={orderOpen}
                  aria-controls="nav-order-menu-mobile"
                  data-active={orderActive ? 'true' : undefined}
                  // no hover on this row, so a plain toggle is right here
                  onClick={() => setOrderOpen((v) => !v)}
                  className="link-draw mono-label-xs inline-flex items-center gap-1.5 whitespace-nowrap text-ink-70"
                >
                  {orderLabel(i)}
                  <OrderChevron open={orderOpen} />
                </button>
              </li>
            ) : (
              <li key={link.id}>
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
            )
          )}
        </ul>
      </div>

      {/* Order submenu on mobile: a folded-out block, not a floating panel */}
      {orderOpen && isOrderGroup && (
        <div
          id="nav-order-menu-mobile"
          data-order-menu=""
          className="hairline-t bg-paper px-gutter py-3 md:hidden"
        >
          <ul>
            {orderMenu.map((child, j) => (
              <li key={j} className="py-1">
                {orderChild(child, j)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="hairline-t hidden h-px w-full bg-ink-12 md:block" aria-hidden="true" />
    </header>
    </EditableSection>
  );
}
