import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, JetBrains_Mono, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';
import { getContentSnapshot } from '@/lib/content';
import { SiteContentProvider } from '@/components/site-content-provider';
import { OrderProvider } from '@/lib/order-store';
import { CustomCursor } from '@/components/CustomCursor';
import { SiteNav } from '@/components/sections/SiteNav';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { OrderDrawer } from '@/components/OrderDrawer';
import { EditBridgeGate } from '@/components/edit/EditBridgeGate';
import { ReplayAnalytics } from '@/components/ReplayAnalytics';
import { ReplayConsent } from '@/components/ReplayConsent';

/* Display: big, tight, with an italic for the one emphasised word. */
const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

/* Body and UI. */
const body = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

/* Numbers, prices, labels. */
const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContentSnapshot();

  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${site.name} — ${site.tagline}`,
      template: `%s — ${site.name}`,
    },
    description: site.description,
    applicationName: site.name,
    keywords: [
      'origami Lagos',
      'handfolded paper cranes',
      'paper party supplies Nigeria',
      'paper plates wholesale',
      'event favours Lagos',
      'gift wrap Nigeria',
      'custom origami orders',
    ],
    authors: [{ name: site.name }],
    creator: site.name,
    publisher: site.name,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: site.url,
      siteName: site.name,
      title: `${site.name} — ${site.tagline}`,
      description: site.description,
      locale: site.locale,
      images: [
        {
          url: '/og.svg',
          width: 1200,
          height: 630,
          alt: 'Cra7ty Hub — handfolded origami and paper goods, Lagos',
          type: 'image/svg+xml',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${site.name} — ${site.tagline}`,
      description: site.description,
      images: ['/og.svg'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#f4efe6',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = await getContentSnapshot();

  return (
    <html
      lang="en-NG"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="bg-paper text-ink antialiased">
        <SiteContentProvider content={content}>
          <a href="#main" className="sr-only-focusable">
            Skip to content
          </a>
          {/* paper grain, felt rather than seen */}
          <div className="grain-layer" aria-hidden="true" />

          <OrderProvider>
            <SiteNav />
            <main id="main">{children}</main>
            <SiteFooter />
            <OrderDrawer />
          </OrderProvider>

          <CustomCursor />

          {/* edit-mode bridge gate: null-rendering; imports the bridge only
              when framed by the admin with ?cra7ty-edit=1 */}
          <EditBridgeGate />

          {/* session replay: mounted once, browser only, consent gated */}
          <ReplayAnalytics />
          <ReplayConsent />
        </SiteContentProvider>
      </body>
    </html>
  );
}
