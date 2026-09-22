import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export const metadata: Metadata = {
  title: {
    absolute: 'Collab Deal OS | Creator-Brand Collaboration Marketplace',
  },
  description:
    'Collab Deal OS helps creators and brands discover collaboration opportunities, connect directly, discuss campaign terms, manage offers, and keep deals organized in one place.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Collab Deal OS | Creator-Brand Collaboration Marketplace',
    description:
      'Discover creator-brand collaborations, connect directly, discuss campaign terms, and manage offers in one structured marketplace.',
    url: '/',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1728,
        height: 941,
        alt: 'Collab Deal OS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Collab Deal OS | Creator-Brand Collaboration Marketplace',
    description:
      'Discover creator-brand collaborations, connect directly, discuss campaign terms, and manage offers in one structured marketplace.',
    images: ['/og.png'],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id':
        'https://collab-deal-os.mohammedzaid00100.workers.dev/#application',
      name: 'Collab Deal OS',
      url: 'https://collab-deal-os.mohammedzaid00100.workers.dev/',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Collab Deal OS is a creator-brand collaboration marketplace where creators and brands can discover opportunities, connect directly, discuss campaign terms, manage offers, and organize collaboration workflows.',
      isAccessibleForFree: true,
      brand: {
        '@id': 'https://collab-deal-os.mohammedzaid00100.workers.dev/#brand',
      },
      audience: [
        {
          '@type': 'Audience',
          audienceType: 'Creators',
        },
        {
          '@type': 'Audience',
          audienceType: 'Brands',
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://collab-deal-os.mohammedzaid00100.workers.dev/#website',
      name: 'Collab Deal OS',
      url: 'https://collab-deal-os.mohammedzaid00100.workers.dev/',
      description:
        'A creator-brand collaboration marketplace for discovering opportunities, connecting directly, discussing campaigns, and managing collaboration offers.',
      inLanguage: 'en',
      about: {
        '@id':
          'https://collab-deal-os.mohammedzaid00100.workers.dev/#application',
      },
    },
    {
      '@type': 'Brand',
      '@id': 'https://collab-deal-os.mohammedzaid00100.workers.dev/#brand',
      name: 'Collab Deal OS',
      url: 'https://collab-deal-os.mohammedzaid00100.workers.dev/',
      logo: 'https://collab-deal-os.mohammedzaid00100.workers.dev/brand-logo.png',
    },
  ],
};
const trustPoints = [
  ['Secure by design', 'Your deal data stays private'],
  ['Data-driven', 'Clear pricing and fit signals'],
  ['Built for growth', 'From first deal to full pipeline'],
  ['Fair and neutral', 'Balanced for both sides'],
] as const;

export default function Home() {
  return (
    <main className="landing-shell">
           <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

       <header className="site-header">
         <BrandLogo />

        <nav className="header-actions" aria-label="Account navigation">
          <Link className="text-link" href="/login">
            Sign in
          </Link>
          <Link className="button button--small button--primary" href="/signup">
            Get started
          </Link>
        </nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-glow hero-glow--one" />
        <div className="hero-glow hero-glow--two" />

        <div className="eyebrow">
          <span className="eyebrow-dot" />
          Real deals. Direct connections.
        </div>

        <h1 id="hero-title">
          Fair deals. Strong partnerships.
          <span>Built for creators and brands.</span>
        </h1>

        <p className="hero-copy">
          Discover the right collaborations, understand what every deal is worth,
          and improve the terms with clear, structured decisions.
        </p>

        <div className="role-grid" aria-label="Choose how you will use Collab Deal OS">
          <article className="role-card role-card--creator">
            <div className="role-card__topline">
              <span className="role-icon role-icon--creator" aria-hidden="true">
                <span className="role-icon__head" />
                <span className="role-icon__body" />
              </span>
              <span className="role-label">For creators</span>
            </div>

            <div>
              <h2>Know your deal value before you say yes.</h2>
              <p>
                Find relevant opportunities, evaluate offers, and make a
                well-supported counter with confidence.
              </p>
            </div>

            <div className="mini-insight" aria-label="Example fair deal range">
              <div>
                <span>Fair deal range</span>
                <strong>₹28k – ₹36k</strong>
              </div>
              <span className="score-pill">86 · Strong</span>
            </div>

            <Link className="button button--wide button--dark" href="/signup?role=creator">
              Continue as creator
              <ArrowRight className="arrow-icon" aria-hidden="true" />
            </Link>
          </article>

          <article className="role-card role-card--brand">
            <div className="role-card__topline">
              <span className="role-icon role-icon--brand" aria-hidden="true">
                <span className="role-icon__bar role-icon__bar--one" />
                <span className="role-icon__bar role-icon__bar--two" />
                <span className="role-icon__bar role-icon__bar--three" />
              </span>
              <span className="role-label">For brands</span>
            </div>

            <div>
              <h2>Find the right creator and structure a fair offer.</h2>
              <p>
                Compare creator fit, build clear campaign terms, and make every
                collaboration easier to approve.
              </p>
            </div>

            <div className="mini-insight" aria-label="Example creator match score">
              <div>
                <span>Creator match</span>
                <strong>Beauty · Instagram</strong>
              </div>
              <span className="score-pill score-pill--blue">94% match</span>
            </div>

            <Link className="button button--wide button--brand" href="/signup?role=brand">
              Continue as brand
              <ArrowRight className="arrow-icon" aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
      <section className="platform-overview" aria-labelledby="platform-overview-title">
        <div className="platform-overview__intro">
          <p className="platform-overview__eyebrow">How Collab Deal OS works</p>

          <h2 id="platform-overview-title">
            A creator-brand collaboration marketplace built around real deals.
          </h2>

          <p>
            Collab Deal OS gives creators and brands one structured place to
            discover collaboration opportunities, show interest, start private
            conversations, discuss campaign terms, and manage offers.
          </p>
        </div>

        <ol className="platform-flow" aria-label="Collaboration workflow">
          <li className="platform-flow__item">
            <span>01</span>
            <div>
              <strong>Brand publishes a deal</strong>
              <p>
                Brands create collaboration opportunities with campaign details
                and expectations.
              </p>
            </div>
          </li>

          <li className="platform-flow__item">
            <span>02</span>
            <div>
              <strong>Creator discovers it</strong>
              <p>
                Creators browse relevant opportunities and show interest in the
                deals that fit them.
              </p>
            </div>
          </li>

          <li className="platform-flow__item">
            <span>03</span>
            <div>
              <strong>Private conversation begins</strong>
              <p>
                Brands and creators move from discovery into direct,
                deal-specific messaging.
              </p>
            </div>
          </li>

          <li className="platform-flow__item">
            <span>04</span>
            <div>
              <strong>Offer terms are organized</strong>
              <p>
                Collaboration details, offers, and decisions stay structured in
                one workflow.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="trust-strip" aria-label="Platform values">
        {trustPoints.map(([title, description], index) => (
          <div className="trust-item" key={title}>
            <span className="trust-number" aria-hidden="true">
              0{index + 1}
            </span>
            <div>
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
