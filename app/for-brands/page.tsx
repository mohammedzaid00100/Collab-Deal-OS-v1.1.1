import type { Metadata } from 'next';
import { ContentPage } from '@/components/public/content-page';

const title = 'For Brands | Creator Collaboration Platform | Collab Deal OS';
const description = 'Learn how brands publish creator collaboration opportunities, review interested creators, start private conversations, and manage offers with Collab Deal OS.';

export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: '/for-brands' },
  openGraph: { title, description, url: '/for-brands', type: 'website', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export default function ForBrandsPage() {
  return <ContentPage
    eyebrow="For brands"
    title="Creator Collaboration Platform for Brands"
    introduction="Publish collaboration opportunities, review creators who show interest, and manage conversations and offers in a structured workspace. Collab Deal OS helps bring campaign details together when they would otherwise be spread across DMs, email, spreadsheets, and notes."
    primaryLink="/signup?role=brand"
    primaryLabel="Create a brand account"
    sections={[
      { heading: 'Publish a collaboration opportunity', paragraphs: ['Create a brand profile and publish a deal with campaign details and expectations. Creators can discover the opportunity and decide whether to express interest.'] },
      { heading: 'Review interested creators', paragraphs: ['See who has commented or shown interest in your published deals. Review their profiles and relevant information before choosing whom to contact. Creator-entered social metrics are declared by the creator unless verified by an authorized official source.'] },
      { heading: 'Discover creators', paragraphs: ['Explore creator profiles in the brand workspace alongside interest in your own deals. Use the available profile information to assess fit for a campaign without treating self-reported metrics as independently verified.'] },
      { heading: 'Start a private conversation', paragraphs: ['Move from public discovery into direct messages after a connection exists. Discuss the campaign, deliverables, schedule, and expectations with the creator in one place.'] },
      { heading: 'Structure offers and terms', paragraphs: ['Create and manage collaboration offers and keep decisions tied to the campaign workflow. Any budget or offer value is a term discussed between the parties; Collab Deal OS does not collect payments or issue creator payouts.'] },
      { heading: 'Free during early access', paragraphs: ['Brands currently do not need a paid subscription to use Collab Deal OS. Review the pricing page for the current early-access terms.'] },
    ]}
    related={[
      { href: '/how-it-works', label: 'See the full collaboration flow' },
      { href: '/for-creators', label: 'Information for creators' },
      { href: '/pricing', label: 'Free early-access pricing' },
      { href: '/', label: 'Collab Deal OS homepage' },
    ]}
  />;
}
