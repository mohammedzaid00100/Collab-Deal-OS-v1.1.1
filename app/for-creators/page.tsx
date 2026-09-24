import type { Metadata } from 'next';
import { ContentPage } from '@/components/public/content-page';

const title = 'For Creators | Brand Collaboration Marketplace | Collab Deal OS';
const description = 'Learn how creators discover brand collaboration opportunities, show interest, connect privately with brands, and manage offers using Collab Deal OS.';

export const metadata: Metadata = {
  title: { absolute: title }, description,
  alternates: { canonical: '/for-creators' },
  openGraph: { title, description, url: '/for-creators', type: 'website', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export default function ForCreatorsPage() {
  return <ContentPage
    eyebrow="For creators"
    title="Creator Collaboration Marketplace for Brand Partnerships"
    introduction="Collab Deal OS brings published brand opportunities, conversations, and collaboration offers into one place. Browse deals, express interest in the ones that fit, and discuss terms directly with brands."
    primaryLink="/signup?role=creator"
    primaryLabel="Create a creator account"
    sections={[
      { heading: 'Discover brand collaboration opportunities', paragraphs: ['Browse published opportunities and review the campaign details before deciding where to participate. The opportunity listing helps you compare deal types, platforms, niches, locations, and stated budgets.'] },
      { heading: 'Show interest in a deal', paragraphs: ['Use the deal’s Connect area to comment and express interest. This gives the brand a way to review interested creators before moving the discussion into a private conversation. Showing interest does not guarantee selection or payment.'] },
      { heading: 'Discuss the collaboration privately', paragraphs: ['Once a connection exists, creators and brands can use direct messaging to talk through campaign expectations, deliverables, timing, and terms. The conversation stays connected to the collaboration workflow.'] },
      { heading: 'Review structured offers', paragraphs: ['Review offer details and decisions in the creator workspace. Offer terms may include cash amounts or products as negotiated deal terms; Collab Deal OS does not process payouts or store payment credentials.'] },
      { heading: 'Keep your profile and activity organized', paragraphs: ['Create a creator profile and follow relevant collaboration activity from your workspace. Social metrics entered on a profile are creator-declared unless an authorized official source verifies them.'] },
      { heading: 'Free during early access', paragraphs: ['Creators currently do not need a paid subscription to use Collab Deal OS. See the pricing page for the current early-access status.'] },
    ]}
    related={[
      { href: '/how-it-works', label: 'How the marketplace works' },
      { href: '/for-brands', label: 'Information for brands' },
      { href: '/pricing', label: 'Free early-access pricing' },
      { href: '/', label: 'Collab Deal OS homepage' },
    ]}
  />;
}
