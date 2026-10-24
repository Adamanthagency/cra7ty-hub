'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useOrder } from '@/lib/order-store';
import { whatsappOrderLink, whatsappLink } from '@/lib/whatsapp';
import { naira, pad } from '@/lib/format';
import { site } from '@/data/site';
import { Close, Minus, Plus, ArrowRight } from '@/components/primitives/Icons';
import { ModelArt } from '@/components/three/fallbacks';
import { Editable } from '@/components/edit/Editable';
import { EditableSection } from '@/components/edit/EditableSection';

/**
 * The one place an order becomes a real conversation. It holds the lines,
 * the running total in naira, and the button that hands the whole thing to
 * WhatsApp as a message the studio can read on a phone.
 */
export function OrderDrawer() {
  const { isOpen, close, lines, setQuantity, remove, clear, total, count } = useOrder();
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Move focus in on open, and put it back where it came from on close.
  // AnimatePresence mounts the panel one commit after `isOpen` flips, so the
  // ref is not reliably populated inside the effect — hence the frame, then a
  // short timer as a second chance, with the panel itself as the fallback.
  useEffect(() => {
    if (!isOpen) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    let frame = 0;
    let timer = 0;
    const focusIn = () => {
      const target = closeButton.current ?? panel.current;
      target?.focus();
    };
    frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(focusIn, 40);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      restoreFocus.current?.focus?.();
    };
  }, [isOpen]);

  // keep Tab inside the panel while it is open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const hasItems = lines.length > 0;

  return (
    <EditableSection id="order-drawer">
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.28 }}
            onClick={close}
            aria-hidden="true"
          />

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-drawer-title"
            className="fixed right-0 top-0 z-[90] flex h-[100dvh] w-full max-w-[27rem] flex-col border-l border-ink-12 bg-paper shadow-[-18px_0_40px_-30px_rgba(22,19,15,0.5)]"
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { x: '100%' }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'tween', duration: reduced ? 0.15 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-12 px-6 py-5">
              <div>
                <p className="mono-label-xs text-ink-55">
                  <Editable k="global.order-drawer.eyebrow">
                    Your order
                  </Editable>
                </p>
                <h2 id="order-drawer-title" className="mt-2 font-display text-3xl leading-none">
                  {hasItems ? (
                    <>
                      {pad(count)}{' '}
                      <Editable k="global.order-drawer.count-suffix">
                        items
                      </Editable>
                    </>
                  ) : (
                    <Editable k="global.order-drawer.empty-header">
                      Empty
                    </Editable>
                  )}
                </h2>
              </div>
              <button
                ref={closeButton}
                type="button"
                onClick={close}
                className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center border border-ink-12 transition-colors hover:border-ink"
                aria-label="Close order drawer"
              >
                <Close size={14} />
              </button>
            </header>

            {hasItems ? (
              <>
                <ul className="flex-1 overflow-y-auto px-6">
                  {lines.map((line) => (
                    <li
                      key={line.productId}
                      className="flex gap-4 border-b border-ink-06 py-5 last:border-b-0"
                    >
                      <div className="h-16 w-16 shrink-0 bg-kraft-30 p-1">
                        <ModelArt model={line.model} className="h-full w-full" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg leading-tight">{line.name}</p>
                        <p className="mono-label-xs mt-1 text-ink-55">
                          {naira(line.unitPrice)}{' '}
                          <Editable k="global.order-drawer.each-suffix">
                            each
                          </Editable>
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center border border-ink-12">
                            <button
                              type="button"
                              onClick={() => setQuantity(line.productId, line.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-ink-06"
                              aria-label={`Decrease quantity of ${line.name}`}
                            >
                              <Minus size={12} />
                            </button>
                            <output
                              className="mono-label-xs w-9 text-center tabular-nums"
                              aria-live="polite"
                              aria-label={`Quantity of ${line.name}`}
                            >
                              {pad(line.quantity)}
                            </output>
                            <button
                              type="button"
                              onClick={() => setQuantity(line.productId, line.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-ink-06"
                              aria-label={`Increase quantity of ${line.name}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <span className="mono-label tabular-nums">
                            {naira(line.quantity * line.unitPrice)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(line.productId)}
                        className="mono-label-xs self-start text-ink-40 underline decoration-ink-24 underline-offset-4 transition-colors hover:text-vermilion"
                      >
                        <Editable k="global.order-drawer.remove-label">
                          Remove
                        </Editable>
                        <span className="sr-only"> {line.name} from the order</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <footer className="border-t border-ink-12 px-6 py-5">
                  <div className="flex items-baseline justify-between">
                    <span className="mono-label text-ink-70">
                      <Editable k="global.order-drawer.total-label">
                        Order total
                      </Editable>
                    </span>
                    <span className="font-display text-4xl leading-none tabular-nums">
                      {naira(total)}
                    </span>
                  </div>

                  {/* the one place an order leaves the site: never in a snapshot */}
                  <a
                    href={whatsappOrderLink(lines)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-ph-sensitive="order-handoff"
                    className="btn btn-primary ph-no-capture mt-5 w-full"
                  >
                    <span>
                      <Editable k="global.order-drawer.send-label">
                        Send order on WhatsApp
                      </Editable>
                      <ArrowRight size={14} />
                    </span>
                  </a>

                  <p className="mono-label-xs mt-3 text-ink-40">
                    <Editable k="global.order-drawer.send-caption">
                      Opens a message with every line, the quantities and the
                      total. Nothing is charged here.
                    </Editable>
                  </p>

                  <button
                    type="button"
                    onClick={clear}
                    className="mono-label-xs mt-4 text-ink-55 underline decoration-ink-24 underline-offset-4 transition-colors hover:text-vermilion"
                  >
                    <Editable k="global.order-drawer.clear-label">
                      Clear order
                    </Editable>
                  </button>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-start justify-center px-6">
                <p className="font-display text-3xl leading-tight">
                  <Editable k="global.order-drawer.empty-headline">
                    Nothing in the order yet.
                  </Editable>
                </p>
                <p className="mt-4 max-w-prose text-sm text-ink-70">
                  <Editable k="global.order-drawer.empty-body">
                    Add a few things and we will build the message for you —
                    every line, every quantity, the total, ready to send to{' '}
                    {site.whatsappDisplay}.
                  </Editable>
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/#shop" onClick={close} className="btn btn-primary">
                    <span>
                      <Editable k="global.order-drawer.browse-label">
                        Browse the shop
                      </Editable>
                    </span>
                  </Link>
                  <a
                    href={whatsappLink(
                      'Hello Cra7ty Hub, I would like to ask about a custom order.',
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    <span>
                      <Editable k="global.order-drawer.ask-label">
                        Ask a question
                      </Editable>
                    </span>
                  </a>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </EditableSection>
  );
}