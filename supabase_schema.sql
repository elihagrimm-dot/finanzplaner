create extension if not exists pgcrypto;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy if not exists "users_can_read_own_entries"
on public.entries
for select
using (auth.uid() = user_id);

create policy if not exists "users_can_insert_own_entries"
on public.entries
for insert
with check (auth.uid() = user_id);

create policy if not exists "users_can_update_own_entries"
on public.entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "users_can_delete_own_entries"
on public.entries
for delete
using (auth.uid() = user_id);
