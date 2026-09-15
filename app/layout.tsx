import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NativeBridge } from '@/components/mobile/native-bridge';
import { ServiceWorker } from '@/components/mobile/service-worker';

export const viewport: Viewport = { themeColor: '#7c3aed', viewportFit: 'cover' };

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: {
    default: 'Collab Deal OS · Fair creator-brand deals',
    template: '%s · Collab Deal OS',
  },
  description:
    'AI-powered deal intelligence for creators and brands to discover, evaluate, and improve collaborations.',
  openGraph: {
    title: 'Collab Deal OS',
    description: 'Fair deals. Strong partnerships.',
    type: 'website',
    images: [{ url: '/og.png', width: 1728, height: 941, alt: 'Collab Deal OS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Collab Deal OS',
    description: 'Fair deals. Strong partnerships.',
    images: ['/og.png'],
  },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><NativeBridge /><ServiceWorker />{children}</body>
    </html>
  );
}
