-- PropDAO affiliate/referral tracking.
-- Server writes with the Supabase service role; authenticated affiliates can read their own rows.

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  ref_code text not null unique,
  commission_pct float8 not null default 20,
  payout_email text not null,
  status text not null default 'active',
  total_earned float8 not null default 0,
  total_paid_out float8 not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null,
  user_challenge_id text,
  sale_amount float8 not null default 0,
  commission_amt float8 not null default 0,
  status text not null default 'pending',
  converted_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (referred_user_id, challenge_id)
);

create table if not exists public.affiliate_clicks (
  id bigserial primary key,
  ref_code text not null,
  ip_hash text,
  clicked_at timestamptz not null default now()
);

create index if not exists idx_affiliates_ref_code on public.affiliates (ref_code);
create index if not exists idx_affiliates_user_id on public.affiliates (user_id);
create index if not exists idx_referrals_affiliate on public.referrals (affiliate_id);
create index if not exists idx_clicks_ref_code on public.affiliate_clicks (ref_code);

alter table public.affiliates enable row level security;
alter table public.referrals enable row level security;
alter table public.affiliate_clicks enable row level security;

drop policy if exists affiliate_self_select on public.affiliates;
create policy affiliate_self_select on public.affiliates
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists referral_self_select on public.referrals;
create policy referral_self_select on public.referrals
  for select
  to authenticated
  using (
    affiliate_id in (
      select id from public.affiliates where user_id = (select auth.uid())
    )
  );

drop policy if exists clicks_no_access on public.affiliate_clicks;
create policy clicks_no_access on public.affiliate_clicks
  for all
  using (false)
  with check (false);
