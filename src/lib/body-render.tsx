import type { ReactNode } from 'react';

/**
 * Renders a blog body — an array of markdown block strings — as React
 * elements, for the seven constructs the admin's Tiptap editor supports
 * (bold, italic, H2, H3, blockquote, divider, link) plus plain paragraphs.
 *
 * SAFETY: nothing here emits raw HTML. Every character of the source text
 * becomes a React text node, which React escapes, so a `<script>` written
 * into a post renders as visible text and can never execute. The only
 * structured output is the element types below and validated link hrefs
 * (path starting with `/`, or `https://` — the same rule the admin's
 * content-validation applies). No dangerouslySetInnerHTML, by design.
 *
 * Block grammar mirrors the admin's body-converter exactly:
 *   ## text    → h2
 *   ### text   → h3
 *   > text     → blockquote
 *   ---        → divider
 *   anything   → paragraph (soft line breaks join with a space, as the
 *                admin's markdownToHtml does)
 * Inline: **bold**, *italic*, [label](/path|https://…).
 */

/** One inline token: **bold**, *italic* or [label](url). */
const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\))/;

/** Only site paths and https URLs become hrefs; everything else stays text. */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (url.startsWith('/') && !url.startsWith('//') && !url.toLowerCase().startsWith('/\\')) {
    return url;
  }
  if (url.startsWith('https://')) return url;
  return null;
}

/** Inline markdown → React nodes. Text nodes are escaped by React itself. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN);
  const nodes: ReactNode[] = [];

  parts.forEach((part, i) => {
    if (!part) return;
    const key = `${keyBase}-${i}`;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(<strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>);
      return;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      nodes.push(<em key={key}>{renderInline(part.slice(1, -1), key)}</em>);
      return;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]!);
      if (href) {
        nodes.push(
          <a key={key} href={href} className="underline decoration-ink-24 underline-offset-4 hover:decoration-ink">
            {renderInline(link[1]!, key)}
          </a>,
        );
        return;
      }
      // Unsafe or non-allowlisted URL: keep the label, drop the link.
      nodes.push(<span key={key}>{renderInline(link[1]!, key)}</span>);
      return;
    }

    nodes.push(<span key={key}>{part}</span>);
  });

  return nodes;
}

/** One markdown block → one element. */
function renderBlock(block: string, index: number): ReactNode {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const first = lines[0]!;

  if (first.startsWith('### ')) {
    return (
      <h3 key={index} className="pt-3 font-display text-xl leading-snug text-ink md:text-2xl">
        {renderInline(lines.join(' ').slice(4), `b${index}`)}
      </h3>
    );
  }
  if (first.startsWith('## ')) {
    return (
      <h2 key={index} className="pt-5 font-display text-2xl leading-snug text-ink md:text-3xl">
        {renderInline(lines.join(' ').slice(3), `b${index}`)}
      </h2>
    );
  }
  if (/^---+$/.test(first) && lines.length === 1) {
    return <hr key={index} className="border-0 border-t border-ink-12" />;
  }
  if (lines.every((line) => line.startsWith('> '))) {
    return (
      <blockquote key={index} className="border-l-2 border-ink-24 pl-5 italic text-ink-70">
        <p className="text-base leading-relaxed">{renderInline(lines.map((l) => l.slice(2)).join(' '), `b${index}`)}</p>
      </blockquote>
    );
  }

  return (
    <p key={index} className="text-base leading-relaxed text-ink-70">
      {renderInline(lines.join(' '), `b${index}`)}
    </p>
  );
}

/**
 * A post body. Paragraph markup and the `space-y-5` rhythm are unchanged
 * from the plain-paragraph renderer this replaced, so posts made of plain
 * paragraphs render exactly as they did before; headings, quotes and
 * dividers simply join the same rhythm with extra top padding.
 */
export function Body({
  blocks,
  className = 'mt-10 space-y-5',
}: {
  blocks: readonly string[];
  className?: string;
}) {
  return <div className={className}>{blocks.map((block, i) => renderBlock(block, i))}</div>;
}
