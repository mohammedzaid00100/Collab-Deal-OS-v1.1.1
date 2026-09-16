-- Fix Connect marketplace access.
-- The previous campaigns SELECT policy depended on campaign_matches, while the
-- campaign_matches SELECT policy depended on campaigns. PostgreSQL therefore
-- detected infinite RLS recursion when creators opened Connect.

DROP POLICY IF EXISTS campaigns_select_authorized ON public.campaigns;
DROP POLICY IF EXISTS campaigns_select_participants ON public.campaigns;
DROP POLICY IF EXISTS campaigns_select_connect_marketplace ON public.campaigns;

CREATE POLICY campaigns_select_connect_marketplace
ON public.campaigns
FOR SELECT
TO authenticated
USING (
  status = 'PUBLISHED'
  OR EXISTS (
    SELECT 1
    FROM public.brand_profiles bp
    WHERE bp.id = campaigns.brand_profile_id
      AND bp.user_id = auth.uid()
  )
);
