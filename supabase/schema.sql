-- ==============================================================================
-- Anxie AI Database Schema
-- Run this in the Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  is_premium boolean default false,
  free_tokens_remaining integer default 3,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);


-- 2. Distress Logs Table
create table if not exists public.distress_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  score_before integer not null,
  score_after integer not null,
  exercise_type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.distress_logs enable row level security;

create policy "Users can select own distress logs"
  on public.distress_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own distress logs"
  on public.distress_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own distress logs"
  on public.distress_logs for delete
  using (auth.uid() = user_id);


-- 3. AI Coping Journal Entries Table
create table if not exists public.journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  raw_entry text not null,
  reframed_entry text,
  distortions text[] default array[]::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.journal_entries enable row level security;

create policy "Users can view own journal entries"
  on public.journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own journal entries"
  on public.journal_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own journal entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);

