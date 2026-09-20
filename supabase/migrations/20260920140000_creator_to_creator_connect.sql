-- Collab Deal OS v1.2.0: Creator-to-Creator connect from deal comments.
-- Allows creators who comment on published deals to connect privately with each other.

-- 1. Drop not-null constraint on brand_profile_id to allow creator-to-creator conversations
alter table public.conversations
alter column brand_profile_id drop not null;

-- 2. Add conversation_type and participant_creator_profile_id columns
alter table public.conversations
add column if not exists conversation_type text not null default 'BRAND_CREATOR'
check (conversation_type in ('BRAND_CREATOR', 'CREATOR_CREATOR'));

alter table public.conversations
add column if not exists participant_creator_profile_id uuid
references public.creator_profiles(id) on delete cascade;

-- 3. Invariant check constraint for conversation types
alter table public.conversations
drop constraint if exists conversations_type_participants_check;

alter table public.conversations
add constraint conversations_type_participants_check
check (
  (conversation_type = 'BRAND_CREATOR' and brand_profile_id is not null and participant_creator_profile_id is null)
  or
  (conversation_type = 'CREATOR_CREATOR' and brand_profile_id is null and participant_creator_profile_id is not null and creator_profile_id <> participant_creator_profile_id)
);

-- 4. Symmetrical unique index for creator-to-creator conversations
-- Canonical ordering (least, greatest) guarantees no duplicate A->B and B->A conversations per deal.
create unique index if not exists conversations_creator_creator_unique_idx
on public.conversations (campaign_id, creator_profile_id, participant_creator_profile_id)
where conversation_type = 'CREATOR_CREATOR';

create index if not exists conversations_participant_creator_updated_idx
on public.conversations (participant_creator_profile_id, updated_at desc)
where participant_creator_profile_id is not null;

-- 5. Update RLS policies for conversations
drop policy if exists conversations_select_participant on public.conversations;

create policy conversations_select_participant
on public.conversations for select to authenticated
using (
  (
    conversation_type = 'BRAND_CREATOR'
    and (
      exists (
        select 1 from public.brand_profiles bp
        where bp.id = brand_profile_id and bp.user_id = auth.uid()
      )
      or exists (
        select 1 from public.creator_profiles cp
        where cp.id = creator_profile_id and cp.user_id = auth.uid()
      )
    )
  )
  or (
    conversation_type = 'CREATOR_CREATOR'
    and (
      exists (
        select 1 from public.creator_profiles cp
        where cp.id = creator_profile_id and cp.user_id = auth.uid()
      )
      or exists (
        select 1 from public.creator_profiles cp
        where cp.id = participant_creator_profile_id and cp.user_id = auth.uid()
      )
    )
  )
);

-- 6. Update RLS policies for conversation_messages
drop policy if exists conversation_messages_select_participant on public.conversation_messages;

create policy conversation_messages_select_participant
on public.conversation_messages for select to authenticated
using (
  exists (
    select 1
    from public.conversations c
    left join public.brand_profiles bp on bp.id = c.brand_profile_id
    left join public.creator_profiles cp on cp.id = c.creator_profile_id
    left join public.creator_profiles cp2 on cp2.id = c.participant_creator_profile_id
    where c.id = conversation_id
      and (
        (c.conversation_type = 'BRAND_CREATOR' and (bp.user_id = auth.uid() or cp.user_id = auth.uid()))
        or
        (c.conversation_type = 'CREATOR_CREATOR' and (cp.user_id = auth.uid() or cp2.user_id = auth.uid()))
      )
  )
);

drop policy if exists conversation_messages_insert_participant on public.conversation_messages;

create policy conversation_messages_insert_participant
on public.conversation_messages for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    left join public.brand_profiles bp on bp.id = c.brand_profile_id
    left join public.creator_profiles cp on cp.id = c.creator_profile_id
    left join public.creator_profiles cp2 on cp2.id = c.participant_creator_profile_id
    where c.id = conversation_id
      and (
        (c.conversation_type = 'BRAND_CREATOR' and (bp.user_id = auth.uid() or cp.user_id = auth.uid()))
        or
        (c.conversation_type = 'CREATOR_CREATOR' and (cp.user_id = auth.uid() or cp2.user_id = auth.uid()))
      )
  )
);

drop policy if exists conversation_messages_mark_read_participant on public.conversation_messages;

create policy conversation_messages_mark_read_participant
on public.conversation_messages for update to authenticated
using (
  sender_user_id <> auth.uid()
  and exists (
    select 1
    from public.conversations c
    left join public.brand_profiles bp on bp.id = c.brand_profile_id
    left join public.creator_profiles cp on cp.id = c.creator_profile_id
    left join public.creator_profiles cp2 on cp2.id = c.participant_creator_profile_id
    where c.id = conversation_id
      and (
        (c.conversation_type = 'BRAND_CREATOR' and (bp.user_id = auth.uid() or cp.user_id = auth.uid()))
        or
        (c.conversation_type = 'CREATOR_CREATOR' and (cp.user_id = auth.uid() or cp2.user_id = auth.uid()))
      )
  )
)
with check (
  sender_user_id <> auth.uid()
);

-- 7. Secure function to start or open a Creator-to-Creator conversation from deal comments
create or replace function public.start_creator_connect_conversation(
  target_creator_profile_id uuid,
  target_campaign_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_creator_profile_id uuid;
  first_creator_id uuid;
  second_creator_id uuid;
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select cp.id into caller_creator_profile_id
  from public.creator_profiles cp
  where cp.user_id = auth.uid();

  if caller_creator_profile_id is null then
    raise exception 'Creator account required';
  end if;

  if caller_creator_profile_id = target_creator_profile_id then
    raise exception 'You cannot message yourself';
  end if;

  if not exists (
    select 1 from public.creator_profiles cp
    where cp.id = target_creator_profile_id
  ) then
    raise exception 'Target creator profile not found';
  end if;

  if not exists (
    select 1 from public.campaigns c
    where c.id = target_campaign_id and c.status = 'PUBLISHED'
  ) then
    raise exception 'Target deal not found or not published';
  end if;

  if not exists (
    select 1 from public.campaign_comments cc
    where cc.campaign_id = target_campaign_id
      and cc.creator_profile_id = target_creator_profile_id
  ) then
    raise exception 'The creator must comment on this deal before a conversation can start';
  end if;

  -- Canonical ordering ensures A->B and B->A resolve to the identical record
  first_creator_id := least(caller_creator_profile_id, target_creator_profile_id);
  second_creator_id := greatest(caller_creator_profile_id, target_creator_profile_id);

  insert into public.conversations (
    campaign_id,
    brand_profile_id,
    creator_profile_id,
    participant_creator_profile_id,
    conversation_type
  ) values (
    target_campaign_id,
    null,
    first_creator_id,
    second_creator_id,
    'CREATOR_CREATOR'
  )
  on conflict (campaign_id, creator_profile_id, participant_creator_profile_id)
  where conversation_type = 'CREATOR_CREATOR'
  do update set updated_at = now()
  returning id into conv_id;

  return conv_id;
end;
$$;

revoke all on function public.start_creator_connect_conversation(uuid, uuid) from public, anon;
grant execute on function public.start_creator_connect_conversation(uuid, uuid) to authenticated;
