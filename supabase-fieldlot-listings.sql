-- Fieldlot (бъдеща фаза): публикувани обяви
-- Няма имплементация в този repo още — само схема за Supabase.
-- Изпълни в SQL Editor, когато добавиш backend за listings.

create table if not exists public.fieldlot_listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null,
  title text not null,
  body text not null,
  full_name text not null,
  company_name text not null default '',
  business_email text not null,
  phone text not null default '',
  subscribe_alerts boolean not null default false,
  user_id uuid references auth.users (id) on delete set null
);

create index if not exists fieldlot_listings_created_at_idx
  on public.fieldlot_listings (created_at desc);

create index if not exists fieldlot_listings_user_id_idx
  on public.fieldlot_listings (user_id);

alter table public.fieldlot_listings enable row level security;

create policy "fieldlot_listings_block_anon"
  on public.fieldlot_listings
  for all
  using (false)
  with check (false);
