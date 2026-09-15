import { describe, expect, it } from 'vitest';
import { calculateMatch, MATCH_WEIGHTS } from '@/lib/matching/engine';

const campaign = {
  niche: 'Beauty',
  targetLocation: 'India',
  platform: 'INSTAGRAM',
  followersMin: 100_000,
  followersMax: 200_000,
  engagementMin: 3,
  engagementMax: 6,
  cashBudget: 30_000,
  productValue: 5_000,
};

const creator = {
  niche: 'Beauty',
  location: 'Mumbai, India',
  audienceRegion: 'India',
  engagementRate: 4.8,
  expectedRateLow: 28_000,
  expectedRateHigh: 38_000,
  platforms: [{ platform: 'INSTAGRAM', audienceCount: 128_600, available: true }],
};

describe('explainable matching engine', () => {
  it('uses the required 30/20/15/15/10/10 weights', () => {
    expect(MATCH_WEIGHTS).toEqual({
      niche: 30,
      audienceLocation: 20,
      creatorSize: 15,
      engagement: 15,
      budget: 10,
      platform: 10,
    });
  });

  it('returns 100 for a creator aligned on every criterion', () => {
    const result = calculateMatch(campaign, creator);
    expect(result.score).toBe(100);
    expect(result.engineVersion).toBe('match-v1.0.0');
    expect(result.explanation).toContain('niche');
  });

  it('does not allow follower count to dominate a poor fit', () => {
    const result = calculateMatch(campaign, {
      ...creator,
      niche: 'Gaming',
      location: 'Berlin, Germany',
      audienceRegion: 'Europe',
      engagementRate: 0.7,
      expectedRateLow: 200_000,
      expectedRateHigh: 300_000,
    });
    expect(result.score).toBeLessThan(40);
  });

  it('awards partial size fit near a follower boundary', () => {
    const result = calculateMatch(campaign, {
      ...creator,
      platforms: [{ platform: 'INSTAGRAM', audienceCount: 85_000, available: true }],
    });
    expect(result.components.creatorSize).toBe(7.5);
  });

  it('uses proportional size tolerance even for small audience ranges', () => {
    const result = calculateMatch({ ...campaign, followersMin: 100, followersMax: 100 }, {
      ...creator,
      platforms: [{ platform: 'INSTAGRAM', audienceCount: 85, available: true }],
    });
    expect(result.components.creatorSize).toBe(7.5);
  });

  it('rejects creators without the required platform', () => {
    const result = calculateMatch(campaign, {
      ...creator,
      platforms: [{ platform: 'YOUTUBE', audienceCount: 128_600, available: true }],
    });
    expect(result.score).toBe(0);
    expect(result.explanation).toContain('Not eligible');
  });

  it('rejects creators without at least partial niche alignment', () => {
    const result = calculateMatch(campaign, { ...creator, niche: 'Gaming' });
    expect(result.score).toBe(0);
    expect(result.explanation).toContain('niche');
  });
});
