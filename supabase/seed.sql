-- Local development seed. These configuration records are illustrative and
-- must not be presented as independently verified market facts.

insert into public.pricing_benchmarks (
  benchmark_key, niche, platform, region, currency, configuration,
  source_label, effective_from, engine_version, is_active
)
values
  (
    'IN_CREATOR_BASE_V1', null, null, 'IN', 'INR',
    '{
      "baseCpmInr":450,
      "viewRateFallback":0.20,
      "avgViewsWeight":0.80,
      "followerWeight":0.20,
      "engagementReferenceLow":1.0,
      "engagementReferenceHigh":8.0,
      "engagementMultiplierMin":0.80,
      "engagementMultiplierMax":1.35,
      "deliverableMultipliers":{
        "Instagram Reel":1.00,"Instagram Feed Post":0.65,"Instagram Story":0.35,
        "TikTok Video":0.90,"YouTube Integration":1.35,"UGC Video":0.85,"Other":0.75
      },
      "productionFloors":{
        "Instagram Reel":1800,"Instagram Feed Post":1200,"Instagram Story":600,
        "TikTok Video":1600,"YouTube Integration":3000,"UGC Video":1800,"Other":1200
      },
      "formatMultiplier":1.0,
      "demandMultiplier":1.0,
      "productRealizationRate":0.50,
      "rightsBaseRates":{"CREATOR_CHANNELS_ONLY":0,"BRAND_ORGANIC":0.08,"MULTI_CHANNEL_ORGANIC":0.15},
      "rightsDailyRate":0.0015,
      "rightsCap":0.60,
      "paidAdsBaseRate":0.25,
      "paidAdsMonthlyRate":0.10,
      "adsCap":1.20,
      "whitelistingRate":0.35,
      "exclusivityMonthlyRate":0.08,
      "exclusivityCap":0.80,
      "territoryRates":{"LOCAL":0,"NATIONAL":0.03,"MULTI_COUNTRY":0.08,"GLOBAL":0.15},
      "rushThresholdDays":7,
      "rushRate":0.12,
      "urgentThresholdDays":3,
      "urgentRate":0.25,
      "fitMaxAdjustment":0.10,
      "minimumDealValue":1000,
      "minRangeWidth":0.15,
      "maxRangeWidth":0.40,
      "roundingIncrement":100,
      "confidenceCap":68
    }'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  ),
  (
    'IN_INSTAGRAM_V1', null, 'INSTAGRAM', 'IN', 'INR',
    '{"formatMultiplier":1.00}'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  ),
  (
    'IN_YOUTUBE_V1', null, 'YOUTUBE', 'IN', 'INR',
    '{"formatMultiplier":1.25}'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  ),
  (
    'IN_TIKTOK_V1', null, 'TIKTOK', 'IN', 'INR',
    '{"formatMultiplier":0.95}'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  ),
  (
    'IN_FACEBOOK_V1', null, 'FACEBOOK', 'IN', 'INR',
    '{"formatMultiplier":0.90}'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  ),
  (
    'IN_BEAUTY_INSTAGRAM_V1', 'Beauty', 'INSTAGRAM', 'IN', 'INR',
    '{"demandMultiplier":1.08}'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  ),
  (
    'IN_TECH_YOUTUBE_V1', 'Technology', 'YOUTUBE', 'IN', 'INR',
    '{"demandMultiplier":1.12}'::jsonb,
    'Collab Deal OS development baseline — illustrative only', '2026-01-01', 'pricing-v1.0.0', true
  )
on conflict do nothing;
