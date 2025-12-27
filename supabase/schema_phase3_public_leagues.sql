
-- 1. Add visibility flag to leagues
alter table public.leagues 
add column is_public boolean default false;

-- 2. Create League Members table to track participation
create table public.league_members (
  id uuid default gen_random_uuid() primary key,
  league_id uuid references public.leagues(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(league_id, user_id) -- User can only join a league once
);

-- 3. RLS Policies for League Members
alter table public.league_members enable row level security;

-- Everyone can read members (to see who is in a league)
create policy "League members are viewable by everyone" 
on public.league_members for select using (true);

-- Authenticated users can insert themselves (Join)
create policy "Users can join public leagues" 
on public.league_members for insert 
with check (
  auth.uid() = user_id 
  and exists (
    select 1 from public.leagues 
    where id = league_id and is_public = true
  )
);

-- Super Admins can manage all members
create policy "Super Admins can manage all league members" 
on public.league_members for all 
using (public.is_super_admin());

-- Users can leave (delete their own row)
create policy "Users can leave leagues" 
on public.league_members for delete 
using (auth.uid() = user_id);
