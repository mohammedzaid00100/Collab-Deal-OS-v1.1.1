import Link from 'next/link';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';

type ContentSection = { heading: string; paragraphs: string[] };

export function ContentPage({
  eyebrow,
  title,
  introduction,
  sections,
  primaryLink,
  primaryLabel,
  related,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: ContentSection[];
  primaryLink: string;
  primaryLabel: string;
  related: { href: string; label: string }[];
}) {
  return (
    <div className="public-content-page">
      <PublicHeader />
      <main className="public-content">
        <header className="public-content__hero">
          <p className="public-content__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="public-content__lead">{introduction}</p>
          <Link className="public-content__cta" href={primaryLink}>{primaryLabel} <span aria-hidden="true">→</span></Link>
        </header>
        <div className="public-content__sections">
          {sections.map(({ heading, paragraphs }) => (
            <section className="public-content__section" key={heading}>
              <h2>{heading}</h2>
              {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
        <nav className="public-content__related" aria-label="Explore Collab Deal OS">
          <h2>Explore Collab Deal OS</h2>
          <div>{related.map(({ href, label }) => <Link href={href} key={href}>{label} <span aria-hidden="true">→</span></Link>)}</div>
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
