import type { Metadata, Viewport } from 'next';
import './globals.css';
import './theme.css';
import { NativeBridge } from '@/components/mobile/native-bridge';
import { ServiceWorker } from '@/components/mobile/service-worker';

export const viewport: Viewport = { themeColor: '#7c3aed', viewportFit: 'cover' };

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
  'https://collab-deal-os.mohammedzaid00100.workers.dev',
  ),
  title: {
    default: 'Collab Deal OS · Creator-brand collaboration marketplace',
    template: '%s · Collab Deal OS',
  },
  description:
    'A creator-brand collaboration marketplace for discovering deals, negotiating in one place, and managing the path to payment.',
  openGraph: {
    title: 'Collab Deal OS',
    description: 'Real brands. Real creators. Clear deals.',
    type: 'website',
    images: [{ url: '/og.png', width: 1728, height: 941, alt: 'Collab Deal OS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Collab Deal OS',
    description: 'Real brands. Real creators. Clear deals.',
    images: ['/og.png'],
  },
  icons: { icon: '/favicon.svg' },
};

const themeScript = `(() => { try { const saved = localStorage.getItem('collab-deal-os-theme'); const t = saved === 'dark' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; if (t === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); } catch (_) { document.documentElement.dataset.theme = 'light'; document.documentElement.classList.remove('dark'); } })();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="antialiased"><NativeBridge /><ServiceWorker />{children}</body>
    </html>
  );
}
