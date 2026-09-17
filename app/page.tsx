import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

const trustPoints = [
  ['Secure by design', 'Your deal data stays private'],
  ['Data-driven', 'Clear pricing and fit signals'],
  ['Built for growth', 'From first deal to full pipeline'],
  ['Fair and neutral', 'Balanced for both sides'],
] as const;

export default function Home() {
  return (
    <main className="landing-shell">
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
