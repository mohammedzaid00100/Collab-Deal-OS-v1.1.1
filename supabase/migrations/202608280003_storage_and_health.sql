-- Private storage. Every object path begins with the owning auth user UUID.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('brand-logos', 'brand-logos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('campaign-assets', 'campaign-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('media-kits', 'media-kits', false, 15728640, array['application/pdf']),
  ('campaign-briefs', 'campaign-briefs', false, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy private_assets_select_owner on storage.objects for select to authenticated
using (
  bucket_id in ('avatars', 'brand-logos', 'campaign-assets', 'media-kits', 'campaign-briefs')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy private_assets_insert_owner on storage.objects for insert to authenticated
with check (
  bucket_id in ('avatars', 'brand-logos', 'campaign-assets', 'media-kits', 'campaign-briefs')
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    (bucket_id in ('avatars', 'media-kits') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'creator'
    ))
    or (bucket_id in ('brand-logos', 'campaign-assets', 'campaign-briefs') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'brand'
    ))
  )
);

create policy private_assets_update_owner on storage.objects for update to authenticated
using (
  bucket_id in ('avatars', 'brand-logos', 'campaign-assets', 'media-kits', 'campaign-briefs')
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    (bucket_id in ('avatars', 'media-kits') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'creator'
    ))
    or (bucket_id in ('brand-logos', 'campaign-assets', 'campaign-briefs') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'brand'
    ))
  )
)
with check (
  bucket_id in ('avatars', 'brand-logos', 'campaign-assets', 'media-kits', 'campaign-briefs')
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    (bucket_id in ('avatars', 'media-kits') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'creator'
    ))
    or (bucket_id in ('brand-logos', 'campaign-assets', 'campaign-briefs') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'brand'
    ))
  )
);

create policy private_assets_delete_owner on storage.objects for delete to authenticated
using (
  bucket_id in ('avatars', 'brand-logos', 'campaign-assets', 'media-kits', 'campaign-briefs')
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    (bucket_id in ('avatars', 'media-kits') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'creator'
    ))
    or (bucket_id in ('brand-logos', 'campaign-assets', 'campaign-briefs') and exists (
      select 1 from public.users u where u.id = auth.uid() and u.account_type = 'brand'
    ))
  )
);

create or replace function public.health_check()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('database', 'connected', 'checked_at', now());
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
