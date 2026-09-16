-- Collab Deal OS prototype withdrawal operations.
-- This is intentionally NOT a real payment rail. It gives the user wallet and
-- the internal developer tool one shared source of truth for withdrawal states.

create table if not exists public.prototype_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_type public.account_type not null,
  amount_inr bigint not null check (amount_inr >= 100),
  upi_id text not null check (char_length(trim(upi_id)) between 5 and 120),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'COMPLETED', 'REJECTED')),
  operator_note text check (operator_note is null or char_length(operator_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  rejected_at timestamptz
);

create index if not exists prototype_withdrawal_requests_user_created_idx
on public.prototype_withdrawal_requests (user_id, created_at desc);

create index if not exists prototype_withdrawal_requests_status_created_idx
on public.prototype_withdrawal_requests (status, created_at desc);

alter table public.prototype_withdrawal_requests enable row level security;

drop trigger if exists prototype_withdrawal_requests_set_updated_at on public.prototype_withdrawal_requests;
create trigger prototype_withdrawal_requests_set_updated_at
before update on public.prototype_withdrawal_requests
for each row execute function public.set_updated_at();

drop policy if exists prototype_withdrawals_select_owner on public.prototype_withdrawal_requests;
create policy prototype_withdrawals_select_owner
on public.prototype_withdrawal_requests
for select to authenticated
using (user_id = auth.uid());

drop policy if exists prototype_withdrawals_insert_owner on public.prototype_withdrawal_requests;
create policy prototype_withdrawals_insert_owner
on public.prototype_withdrawal_requests
for insert to authenticated
with check (
  user_id = auth.uid()
  and account_type = (
    select u.account_type from public.users u where u.id = auth.uid()
  )
);

revoke all on public.prototype_withdrawal_requests from anon, authenticated;
grant select, insert on public.prototype_withdrawal_requests to authenticated;
