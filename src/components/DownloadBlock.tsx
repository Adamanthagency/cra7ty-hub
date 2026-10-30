'use client';

import Link from 'next/link';
import { Editable } from '@/components/edit/Editable';
import { useSiteContent } from '@/components/site-content-provider';
import { whatsappLink } from '@/lib/whatsapp';

/**
 * The digital-download block (Tiers 5 + 8) — one component, two homes:
 * the checkout success page and the My Order (/tracker) result view.
 * Those two moments, plus the confirmation email, are the only three
 * places a file is ever handed over.
 *
 * THREE STATES (copy seeded in the admin so it is editable like
 * everything else):
 *   available   → a Download button and a note that this is the one
 *                 time it works.
 *   downloaded  → the file was used: no button, no resend, nothing to
 *                 click but the two recovery paths the client asked
 *                 for — buy it again, or message the studio.
 *   missing     → the file itself is gone (admin deleted it). No dead
 *                 link and no error — a WhatsApp path to the studio.
 *
 * THE RESEND FLOW IS GONE ON PURPOSE (Tier 8). It used to be reachable
 * from this component; with one download per file there is nothing to
 * resend, and offering a button that re-issues a link would contradict
 * the rule the client confirmed. `identity` went with it: it existed
 * only to authenticate the resend call.
 */

export interface DownloadItem {
  /**
   * The grant row's id — one per FILE. Two files on one product share
   * productId and name, so this is what the list keys on.
   */
  id: string;
  productId: string;
  name: string;
  filename: string;
  state: 'available' | 'downloaded' | 'missing';
  url?: string;
  downloadedAt?: string;
}

export function DownloadBlock({
  downloads,
  orderNumber,
}: {
  downloads: DownloadItem[];
  orderNumber: string;
}) {
  const { site } = useSiteContent();

  if (downloads.length === 0) return null;

  const hasDownloaded = downloads.some((item) => item.state === 'downloaded');
  const hasMissing = downloads.some((item) => item.state === 'missing');
  const allMissing = downloads.every((item) => item.state === 'missing');

  return (
    <div className="space-y-4">
      <p className="mono-label-xs text-ink-55">
        <Editable k="tracker.downloads.title">Your downloads</Editable>
      </p>

      <ul className="space-y-3">
        {downloads.map((item) => (
          <li
            key={item.id}
            className="border border-ink-24 bg-kraft/40 px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-sm text-ink">{item.name}</p>
                <p className="mono-label-xs mt-1 break-all text-ink-55">
                  {item.filename}
                </p>
              </div>

              {item.state === 'available' && item.url && (
                <a
                  href={item.url}
                  className="btn btn-primary shrink-0"
                  aria-label={`Download ${item.filename}`}
                >
                  <span>
                    <Editable k="tracker.downloads.download-label">
                      Download
                    </Editable>
                  </span>
                </a>
              )}
            </div>

            {item.state === 'available' && (
              <p className="mono-label-xs mt-3 text-ink-40">
                <Editable k="tracker.downloads.once-note">
                  Each file downloads once — save it before you close
                  this page.
                </Editable>
              </p>
            )}

            {item.state === 'downloaded' && (
              <p className="mono-label-xs mt-3 text-ink-55">
                <Editable k="tracker.downloads.locked-note">
                  Already downloaded — this file can only be downloaded
                  once, so it is no longer available here.
                </Editable>
              </p>
            )}

            {item.state === 'missing' && (
              <p className="mono-label-xs mt-3 text-vermilion">
                <Editable k="tracker.downloads.missing-note">
                  This file is no longer available — message the studio and
                  we will sort it out.
                </Editable>
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* A used file: the two recovery paths the client confirmed —
          repurchase, or talk to the studio. One action row for the
          order, not one per file. */}
      {hasDownloaded && (
        <div className="space-y-3 border-t border-ink-24 pt-4">
          <p className="text-sm text-ink-70">
            <Editable k="tracker.downloads.recover-note">
              Downloaded files cannot be downloaded again. If you need
              them back, buy them again — or message the studio and we
              will help.
            </Editable>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={whatsappLink(
                `Hello Cra7ty Hub, I need help with a download for order ${orderNumber}.`,
                site.whatsappNumber,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary inline-flex"
            >
              <span>
                <Editable k="tracker.statuses.help-label">
                  Message the studio
                </Editable>
              </span>
            </a>
            <Link href="/shop" className="btn btn-secondary inline-flex">
              <span>
                <Editable k="tracker.downloads.buy-again-label">
                  Buy it again
                </Editable>
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Nothing usable anywhere: WhatsApp is the only real path. */}
      {allMissing && hasMissing && (
        <a
          href={whatsappLink(
            `Hello Cra7ty Hub, I need help with the download for order ${orderNumber}.`,
            site.whatsappNumber,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary inline-flex"
        >
          <span>
            <Editable k="tracker.statuses.help-label">
              Message the studio
            </Editable>
          </span>
        </a>
      )}
    </div>
  );
}
