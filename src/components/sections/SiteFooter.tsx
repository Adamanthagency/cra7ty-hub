'use client';

import Link from 'next/link';
import { useSiteContent } from '@/components/site-content-provider';
import { whatsappLink } from '@/lib/whatsapp';
import { Container } from '@/components/primitives/Container';
import { CraneMark } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { EditableSection } from '@/components/edit/EditableSection';
import { useEditList } from '@/lib/edit/use-edit';
import type { EditListItem } from '@/lib/edit/edit-state';

/**
 * Ink ground, oversized wordmark, and the three ways to reach the studio.
 * The wordmark is clipped by the container edge on purpose: print likes a
 * crop.
 *
 * Client component (was server): the three link lists and the column
 * headings come from the admin through `set-list`, which arrives via the
 * edit store — the same reason Faq and Process are client. With no
 * override the seed copy renders exactly as before.
 */

interface LinkRow {
  label: string;
  href: string;
}

const toLinks = (
  override: EditListItem[] | null,
  fallback: readonly LinkRow[],
): LinkRow[] =>
  override
    ? override.map((item) => ({
        label: String(item.fields.label ?? ''),
        href: String(item.fields.href ?? ''),
      }))
    : [...fallback];

export function SiteFooter() {
  const { footer, site } = useSiteContent();
  const columnsOverride = useEditList('global.footer.columns');
  const shopLinks = useEditList('global.footer.shop-links');
  const ordersLinks = useEditList('global.footer.orders-links');
  const studioLinks = useEditList('global.footer.studio-links');

  // The three seeded columns map to the three admin lists by position:
  // Shop → shop-links, Orders → orders-links, Studio → studio-links.
  const linkLists = [shopLinks, ordersLinks, studioLinks];

  return (
    <EditableSection id="footer">
    <footer id="footer-contact" className="relative overflow-hidden bg-ink text-paper">
      <div className="mx-auto w-full max-w-[104rem] px-gutter pt-16 md:pt-24">
        <div className="grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 md:col-span-5">
            <p className="mono-label-xs text-paper-60">{site.city}</p>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-paper-70">
              <Editable k="global.footer.small-print">
                {footer.smallPrint}
              </Editable>
            </p>
            <address className="mt-6 not-italic">
              <p className="mono-label-xs text-paper-60">
                <Editable k="global.footer.studio-label">Studio</Editable>
              </p>
              <p className="mt-2 text-sm text-paper-70">{site.studio}</p>
            </address>
          </div>

          {footer.columns.map((column, i) => {
            const heading =
              columnsOverride !== null
                ? String(columnsOverride[i]?.fields.heading ?? column.heading)
                : column.heading;
            const links = toLinks(linkLists[i], column.links);

            return (
              <nav
                key={i}
                aria-label={heading}
                className="col-span-6 md:col-span-2"
              >
                <h2 className="mono-label-xs text-paper-60">
                  <Editable k={`global.footer.columns.items.${i}.heading`}>
                    {heading}
                  </Editable>
                </h2>
                <ul className="mt-4 space-y-2">
                  {links.map((link, j) => (
                    <li key={j}>
                      {/* home anchors stay native <a>; routes use next/link */}
                      {link.href.startsWith('/#') ? (
                        <a
                          href={link.href}
                          className="link-draw text-sm text-paper-70 hover:text-paper"
                        >
                          <Editable
                            k={`global.footer.${['shop-links', 'orders-links', 'studio-links'][i]}.items.${j}.label`}
                          >
                            {link.label}
                          </Editable>
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="link-draw text-sm text-paper-70 hover:text-paper"
                        >
                          <Editable
                            k={`global.footer.${['shop-links', 'orders-links', 'studio-links'][i]}.items.${j}.label`}
                          >
                            {link.label}
                          </Editable>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}

          <div id="contact" className="col-span-12 md:col-span-1 md:col-start-12">
            <h2 className="mono-label-xs text-paper-60">
              <Editable k="global.footer.reach-label">Reach us</Editable>
            </h2>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href={whatsappLink(
                    `Hello Cra7ty Hub, I would like to ask about ${site.name}.`,
                    site.whatsappNumber,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-draw mono-label-xs text-paper hover:text-vermilion"
                >
                  <Editable k="global.footer.whatsapp-label">
                    WhatsApp
                  </Editable>
                </a>
              </li>
              <li>
                <a
                  href={site.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-draw mono-label-xs text-paper hover:text-vermilion"
                >
                  <Editable k="global.footer.instagram-label">
                    Instagram
                  </Editable>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="link-draw mono-label-xs break-words text-paper hover:text-vermilion"
                >
                  {site.email}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* the oversized wordmark, cropped by the page edge */}
      <div className="mt-14 w-full border-t border-paper-12 px-gutter pt-8 md:mt-20">
        <p className="flex items-center gap-3 whitespace-nowrap font-display text-[clamp(3.5rem,17vw,15rem)] leading-[0.8] tracking-[-0.035em] text-paper">
          <CraneMark size={40} className="hidden shrink-0 text-vermilion sm:block" />
          <span className="-ml-[0.06em]">{site.name}</span>
        </p>
      </div>

      <Container className="pb-8 pt-6">
        <div className="flex flex-col gap-3 border-t border-paper-12 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="mono-label-xs text-paper-60">
            © {new Date().getFullYear()} {site.name} — {site.studio}
          </p>
          <p className="mono-label-xs text-paper-60">
            {site.whatsappDisplay} · Est. {site.foundedYear}
          </p>
        </div>
      </Container>
    </footer>
    </EditableSection>
  );
}
