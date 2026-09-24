import type { Metadata } from 'next';
import { ContentPage } from '@/components/public/content-page';

const title = 'How Collab Deal OS Works | Creator-Brand Marketplace';
const description = 'See how Collab Deal OS connects creators and brands through deal discovery, private conversations, structured offers, and collaboration management.';

export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: '/how-it-works' },
  openGraph: { title, description, url: '/how-it-works', type: 'website', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export default function HowItWorksPage() {
  return <ContentPage
    eyebrow="The collaboration flow"
    title="How Collab Deal OS Works"
    introduction="Collab Deal OS is a marketplace and deal-management workspace for creators and brands. It connects the steps from a published opportunity to a private discussion and a structured collaboration offer."
    primaryLink="/signup"
    primaryLabel="Get started for free"
    sections={[
      { heading: '1. A brand publishes a deal', paragraphs: ['A brand creates a collaboration opportunity with campaign details and expectations. Published deals give creators a starting point for discovering potential partnerships.'] },
      { heading: '2. Creators discover opportunities', paragraphs: ['Creators browse the available opportunities and inspect details such as platform, niche, deal type, and stated budget to find relevant campaigns.'] },
      { heading: '3. A creator shows interest', paragraphs: ['An interested creator can comment in the deal’s Connect area. The brand can then review the creator’s profile and interest; expressing interest alone does not create an offer or guarantee a collaboration.'] },
      { heading: '4. The brand reviews creators', paragraphs: ['Brands review interested creators and can also explore creator profiles. Profile information helps with the decision, while creator-entered social metrics remain creator-declared unless verified through an authorized official source.'] },
      { heading: '5. A private conversation begins', paragraphs: ['After a connection exists, the brand and creator can move into private messaging to discuss the campaign, deliverables, timing, and expectations directly.'] },
      { heading: '6. Offer terms are organized', paragraphs: ['Structured offers record the proposed collaboration terms and their status so both sides can review and discuss them within the platform. Budgets and offer values describe the deal; they are not payments processed by Collab Deal OS.'] },
      { heading: '7. Both sides manage the workflow', paragraphs: ['Creators and brands use their respective workspaces to follow relevant campaigns, conversations, offers, and collaboration activity. Creator-to-creator networking is also available where supported.'] },
      { heading: 'Cost and payments', paragraphs: ['Collab Deal OS is free for creators and brands during early access, with no paid subscription required right now. It does not process financial transactions, hold payment credentials, provide escrow, or automatically pay creators.'] },
    ]}
    related={[
      { href: '/for-creators', label: 'How creators use the platform' },
      { href: '/for-brands', label: 'How brands use the platform' },
      { href: '/pricing', label: 'Current pricing' },
      { href: '/', label: 'Collab Deal OS homepage' },
    ]}
  />;
}
