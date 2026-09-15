-- Collab Deal OS: Connect marketplace comments and direct messaging.
-- Published campaigns are the real deal posts shown to creators.

create table public.campaign_comments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_comments_campaign_created_idx
on public.campaign_comments (campaign_id, created_at desc);
create index campaign_comments_creator_created_idx
on public.campaign_comments (creator_profile_id, created_at desc);
create trigger campaign_comments_set_updated_at
before update on public.campaign_comments
for each row execute function public.set_updated_at();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  brand_profile_id uuid not null references public.brand_profiles(id) on delete cascade,
  creator_profile_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, brand_profile_id, creator_profile_id)
);

create index conversations_brand_updated_idx
on public.conversations (brand_profile_id, updated_at desc);
create index conversations_creator_updated_idx
on public.conversations (creator_profile_id, updated_at desc);
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index conversation_messages_conversation_created_idx
on public.conversation_messages (conversation_id, created_at asc);
create index conversation_messages_unread_idx
on public.conversation_messages (conversation_id, created_at desc)
where read_at is null;

alter table public.campaign_comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- Creators need to be visible to brands from Connect comments.
create policy creator_profiles_select_connect_visible
on public.creator_profiles for select to authenticated
using (onboarding_complete and is_discoverable);

-- Creators need brand identity for published deal cards and conversations.
create policy brand_profiles_select_connect_visible
on public.brand_profiles for select to authenticated
using (onboarding_complete);

create policy campaign_comments_select_visible
on public.campaign_comments for select to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and (
        c.status = 'PUBLISHED'
        or exists (
          select 1 from public.brand_profiles bp
          where bp.id = c.brand_profile_id and bp.user_id = auth.uid()
        )
      )
  )
);

create policy campaign_comments_insert_creator
on public.campaign_comments for insert to authenticated
with check (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_profile_id and cp.user_id = auth.uid()
  )
  and exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and c.status = 'PUBLISHED'
  )
);

create policy campaign_comments_update_owner
on public.campaign_comments for update to authenticated
using (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_profile_id and cp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_profile_id and cp.user_id = auth.uid()
  )
);

create policy campaign_comments_delete_owner
on public.campaign_comments for delete to authenticated
using (
  exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_profile_id and cp.user_id = auth.uid()
  )
);

create policy conversations_select_participant
on public.conversations for select to authenticated
using (
  exists (
    select 1 from public.brand_profiles bp
    where bp.id = brand_profile_id and bp.user_id = auth.uid()
  )
  or exists (
    select 1 from public.creator_profiles cp
    where cp.id = creator_profile_id and cp.user_id = auth.uid()
  )
);

create policy conversation_messages_select_participant
on public.conversation_messages for select to authenticated
using (
  exists (
    select 1
    from public.conversations c
    left join public.brand_profiles bp on bp.id = c.brand_profile_id
    left join public.creator_profiles cp on cp.id = c.creator_profile_id
    where c.id = conversation_id
      and (bp.user_id = auth.uid() or cp.user_id = auth.uid())
  )
);

create policy conversation_messages_insert_participant
on public.conversation_messages for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    left join public.brand_profiles bp on bp.id = c.brand_profile_id
    left join public.creator_profiles cp on cp.id = c.creator_profile_id
    where c.id = conversation_id
      and (bp.user_id = auth.uid() or cp.user_id = auth.uid())
  )
);

create policy conversation_messages_mark_read_participant
on public.conversation_messages for update to authenticated
using (
  sender_user_id <> auth.uid()
  and exists (
    select 1
    from public.conversations c
    left join public.brand_profiles bp on bp.id = c.brand_profile_id
    left join public.creator_profiles cp on cp.id = c.creator_profile_id
    where c.id = conversation_id
      and (bp.user_id = auth.uid() or cp.user_id = auth.uid())
  )
)
with check (
  sender_user_id <> auth.uid()
);

create or replace function public.start_connect_conversation(
  target_creator_profile_id uuid,
  target_campaign_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_brand_profile_id uuid;
  conversation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select bp.id into current_brand_profile_id
  from public.brand_profiles bp
  where bp.user_id = auth.uid();

  if current_brand_profile_id is null then
    raise exception 'Brand account required';
  end if;

  if not exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id
      and c.brand_profile_id = current_brand_profile_id
  ) then
    raise exception 'You can only message creators from your own deals';
  end if;

  if not exists (
    select 1 from public.campaign_comments cc
    where cc.campaign_id = target_campaign_id
      and cc.creator_profile_id = target_creator_profile_id
  ) then
    raise exception 'The creator must comment on this deal before a conversation can start';
  end if;

  insert into public.conversations (campaign_id, brand_profile_id, creator_profile_id)
  values (target_campaign_id, current_brand_profile_id, target_creator_profile_id)
  on conflict (campaign_id, brand_profile_id, creator_profile_id)
  do update set updated_at = now()
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke all on public.campaign_comments, public.conversations, public.conversation_messages
from anon, authenticated;
grant select, insert, update, delete on public.campaign_comments to authenticated;
grant select on public.conversations to authenticated;
grant select, insert, update on public.conversation_messages to authenticated;

revoke all on function public.start_connect_conversation(uuid, uuid) from public;
grant execute on function public.start_connect_conversation(uuid, uuid) to authenticated;
