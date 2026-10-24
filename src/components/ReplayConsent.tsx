'use client';

import { useEffect, useState } from 'react';
import {
  readReplayConsent,
  subscribeReplayConsent,
  writeReplayConsent,
  type ReplayConsent,
} from '@/lib/replay-consent';
import { replayConfigured } from '@/lib/replay';
import { Close } from '@/components/primitives/Icons';
import { Editable } from '@/components/edit/Editable';
import { EditableSection } from '@/components/edit/EditableSection';

/**
 * The consent switch for session replay. Nothing is recorded until the visitor
 * presses "Allow"; "Turn off" withdraws the choice and stops the recording.
 *
 * It stays out of the way: one small card in the corner of the paper, in the
 * same mono label and hairline rules as the rest of the site.
 */
export function ReplayConsent() {
  const [choice, setChoice] = useState<ReplayConsent>('unknown');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const sync = () => setChoice(readReplayConsent());
    sync();
    setMounted(true);
    return subscribeReplayConsent(sync);
  }, []);

  // The choice lives in the browser, so render nothing until we can read it.
  if (!mounted || !replayConfigured) return null;

  if (choice === 'granted') {
    return (
      <EditableSection id="consent">
        <div className="fixed bottom-4 left-4 z-[70] flex items-center gap-3 border border-ink-12 bg-paper px-3 py-2 shadow-[0_10px_30px_-24px_rgba(22,19,15,0.6)]">
          <span className="mono-label-xs text-ink-55">
            <Editable k="global.consent.on-label">
              Session replay on
            </Editable>
          </span>
          <button
            type="button"
            onClick={() => writeReplayConsent('denied')}
            className="mono-label-xs text-ink underline decoration-ink-24 underline-offset-4 transition-colors hover:text-vermilion"
          >
            <Editable k="global.consent.turn-off-label">
              Turn off
            </Editable>
          </button>
        </div>
      </EditableSection>
    );
  }

  if (choice === 'denied') return null;

  return (
    <EditableSection id="consent">
    <section
      aria-label="Session replay consent"
      className="fixed bottom-4 left-4 right-4 z-[70] max-w-[26rem] border border-ink-12 bg-paper p-4 shadow-[0_10px_30px_-24px_rgba(22,19,15,0.6)] sm:right-auto"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mono-label-xs text-ink-55">
            <Editable k="global.consent.eyebrow">Session replay</Editable>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-70">
            <Editable k="global.consent.body">
              Allow a recording of this visit so we can see where the shop is
              confusing? Text and form fields are masked, and nothing is
              recorded until you choose.
            </Editable>
          </p>
        </div>
        <button
          type="button"
          onClick={() => writeReplayConsent('denied')}
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center border border-ink-12 transition-colors hover:border-ink"
          aria-label="Dismiss and keep replay off"
        >
          <Close size={12} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => writeReplayConsent('granted')} className="btn btn-primary">
          <span>
            <Editable k="global.consent.allow-label">Allow</Editable>
          </span>
        </button>
        <button type="button" onClick={() => writeReplayConsent('denied')} className="btn btn-secondary">
          <span>
            <Editable k="global.consent.decline-label">No thanks</Editable>
          </span>
        </button>
      </div>
    </section>
    </EditableSection>
  );
}
